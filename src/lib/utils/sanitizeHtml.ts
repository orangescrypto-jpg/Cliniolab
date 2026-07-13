/**
 * Sanitizes admin/moderator-authored HTML before it's ever rendered via
 * dangerouslySetInnerHTML. This is a real security boundary — a
 * compromised admin/moderator account, or someone pasting HTML copied
 * from an untrusted source, are both realistic ways a <script> tag could
 * otherwise end up live on the site.
 *
 * Deliberately written without DOMParser/jsdom: this project runs on
 * Cloudflare Pages/Workers, where DOMParser is not guaranteed to exist,
 * and no DOM library is currently a dependency. A silent fallback to a
 * weaker sanitizer on every real production render would defeat the
 * point of building this at all, so instead this is a self-contained
 * tokenizer that works identically in any JS runtime.
 *
 * Approach: walk the string, classify each tag as allowed/disallowed,
 * strip disallowed tags AND their content entirely for dangerous ones
 * (script/style/iframe/object/embed/form), and for allowed tags strip
 * every attribute except an explicit per-tag allowlist. Intentionally
 * conservative — favors stripping something borderline over risking an
 * XSS vector.
 */

const DANGEROUS_TAGS_STRIP_CONTENT = new Set(['script', 'style', 'object', 'embed', 'form']);

const ALLOWED_TAGS = new Set([
  'p', 'br', 'hr',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'strong', 'b', 'em', 'i', 'u', 's', 'mark', 'small', 'sub', 'sup',
  'ul', 'ol', 'li',
  'blockquote', 'pre', 'code',
  'a', 'img', 'figure', 'figcaption',
  'table', 'thead', 'tbody', 'tr', 'th', 'td',
  'div', 'span', 'iframe',
]);

// Only these two video-embed origins are ever allowed through as <iframe>.
// Every other iframe (including ones with these hostnames buried in a
// query string or fragment to fool a naive substring check) is stripped.
// isSafeEmbedSrc() below does a real URL-parse, not a substring match.
const EMBED_HOST_ALLOWLIST = new Set(['www.youtube.com', 'youtube.com', 'player.vimeo.com']);

const ALLOWED_ATTRS: Record<string, Set<string>> = {
  a: new Set(['href', 'title', 'target', 'rel']),
  img: new Set(['src', 'alt', 'title', 'width', 'height', 'style']),
  table: new Set(['border']),
  td: new Set(['colspan', 'rowspan', 'style']),
  th: new Set(['colspan', 'rowspan', 'style']),
  p: new Set(['style']),
  h1: new Set(['style']), h2: new Set(['style']), h3: new Set(['style']),
  h4: new Set(['style']), h5: new Set(['style']), h6: new Set(['style']),
  span: new Set(['style']),
  div: new Set(['style']),
  figure: new Set(['style']),
  mark: new Set(['style']),
  // iframe intentionally NOT given a normal attrs entry — it's handled by
  // a dedicated branch in rebuildOpeningTag() that only ever emits a
  // fixed, hardcoded set of attributes for a verified embed URL.
};
const GLOBAL_ALLOWED_ATTRS = new Set(['class', 'id']);

// Whitelisted CSS *properties* for the `style` attribute, each with its
// own value validator. This is not "allow the style attribute" — every
// property must appear here, and every value is checked, so things like
// `background:url(javascript:...)` or `expression(...)` can't get through
// even though `style` itself is now permitted on a few tags.
const STYLE_PROPERTY_VALIDATORS: Record<string, (value: string) => boolean> = {
  'text-align': (v) => /^(left|right|center|justify)$/.test(v.trim()),
  color: (v) => isSafeCssColorOrLength(v) && /^(#[0-9a-f]{3,8}|rgb|rgba|hsl|hsla|[a-z]+)/i.test(v.trim()),
  'background-color': (v) => isSafeCssColorOrLength(v) && /^(#[0-9a-f]{3,8}|rgb|rgba|hsl|hsla|[a-z]+)/i.test(v.trim()),
  width: (v) => /^\d{1,4}(px|%)$/.test(v.trim()),
  'max-width': (v) => /^\d{1,4}(px|%)$/.test(v.trim()),
};

function isSafeCssColorOrLength(value: string): boolean {
  const v = value.trim().toLowerCase();
  // Blocks url(), expression(), javascript:, and any other function call
  // except the handful of legitimate color functions checked separately.
  if (/url\s*\(|expression\s*\(|javascript:|import/.test(v)) return false;
  return true;
}

function sanitizeStyleValue(styleValue: string): string {
  const kept: string[] = [];
  for (const decl of styleValue.split(';')) {
    const idx = decl.indexOf(':');
    if (idx === -1) continue;
    const prop = decl.slice(0, idx).trim().toLowerCase();
    const val = decl.slice(idx + 1).trim();
    const validator = STYLE_PROPERTY_VALIDATORS[prop];
    if (validator && val && validator(val)) {
      kept.push(`${prop}: ${val.replace(/"/g, '')}`);
    }
  }
  return kept.join('; ');
}

function isSafeEmbedSrc(value: string): { ok: boolean; normalizedSrc?: string } {
  try {
    const url = new URL(value.trim());
    if (url.protocol !== 'https:') return { ok: false };
    if (!EMBED_HOST_ALLOWLIST.has(url.hostname)) return { ok: false };
    const isYouTube = url.hostname.endsWith('youtube.com') && url.pathname.startsWith('/embed/');
    const isVimeo = url.hostname === 'player.vimeo.com' && url.pathname.startsWith('/video/');
    if (!isYouTube && !isVimeo) return { ok: false };
    return { ok: true, normalizedSrc: url.toString() };
  } catch {
    return { ok: false };
  }
}

function isSafeUrlValue(value: string): boolean {
  const trimmed = value.trim().toLowerCase();
  if (trimmed.startsWith('javascript:')) return false;
  if (trimmed.startsWith('vbscript:')) return false;
  if (trimmed.startsWith('data:')) return false;
  return true;
}

function parseAttributes(attrString: string): { name: string; value: string }[] {
  const attrs: { name: string; value: string }[] = [];
  const attrRegex = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*(?:=\s*("([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
  let match: RegExpExecArray | null;
  while ((match = attrRegex.exec(attrString)) !== null) {
    const name = match[1];
    const value = match[3] ?? match[4] ?? match[5] ?? '';
    attrs.push({ name, value });
  }
  return attrs;
}

function rebuildOpeningTag(tag: string, attrString: string): string {
  const attrs = parseAttributes(attrString);

  // iframe is never handled by the generic allowlist path below — only a
  // verified YouTube/Vimeo embed URL produces output, with a fixed,
  // hardcoded attribute set. Every other iframe attribute the author
  // wrote (onload, srcdoc, sandbox overrides, etc.) is discarded outright.
  if (tag === 'iframe') {
    const srcAttr = attrs.find((a) => a.name.toLowerCase() === 'src');
    if (!srcAttr) return '';
    const { ok, normalizedSrc } = isSafeEmbedSrc(srcAttr.value);
    if (!ok || !normalizedSrc) return '';
    return `<iframe src="${normalizedSrc.replace(/"/g, '&quot;')}" width="100%" height="360" frameborder="0" sandbox="allow-scripts allow-same-origin allow-presentation" allowfullscreen loading="lazy" title="Embedded video">`;
  }

  const allowedForTag = new Set([...(ALLOWED_ATTRS[tag] ?? []), ...GLOBAL_ALLOWED_ATTRS]);
  const kept: string[] = [];
  let target = '';

  for (const { name, value } of attrs) {
    const lowerName = name.toLowerCase();
    if (lowerName.startsWith('on')) continue;
    if (!allowedForTag.has(lowerName)) continue;
    if ((lowerName === 'href' || lowerName === 'src') && !isSafeUrlValue(value)) continue;
    if (lowerName === 'target') target = value;

    if (lowerName === 'style') {
      const cleanStyle = sanitizeStyleValue(value);
      if (!cleanStyle) continue;
      kept.push(`style="${cleanStyle.replace(/"/g, '&quot;')}"`);
      continue;
    }

    const safeValue = value.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
    kept.push(`${lowerName}="${safeValue}"`);
  }

  if (tag === 'a' && target === '_blank' && !kept.some((a) => a.startsWith('rel='))) {
    kept.push('rel="noopener noreferrer"');
  }

  return kept.length > 0 ? `<${tag} ${kept.join(' ')}>` : `<${tag}>`;
}

export function sanitizeHtml(input: string): string {
  let output = '';
  let i = 0;
  let skippingTag: string | null = null;
  let skipDepth = 0;

  const tagRegex = /<\/?([a-zA-Z][a-zA-Z0-9]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/g;

  while (i < input.length) {
    tagRegex.lastIndex = i;
    const match = tagRegex.exec(input);

    if (!match || match.index !== i) {
      if (!skippingTag) {
        const nextTagIndex = input.indexOf('<', i);
        const chunkEnd = nextTagIndex === -1 ? input.length : nextTagIndex;
        output += escapeStray(input.slice(i, chunkEnd));
        i = chunkEnd === i ? i + 1 : chunkEnd;
      } else {
        i++;
      }
      continue;
    }

    const [fullMatch, rawTag, attrString] = match;
    const tag = rawTag.toLowerCase();
    const isClosing = fullMatch.startsWith('</');

    if (skippingTag) {
      if (tag === skippingTag) {
        if (isClosing) {
          skipDepth--;
          if (skipDepth <= 0) skippingTag = null;
        } else {
          skipDepth++;
        }
      }
      i = match.index + fullMatch.length;
      continue;
    }

    if (DANGEROUS_TAGS_STRIP_CONTENT.has(tag) && !isClosing) {
      skippingTag = tag;
      skipDepth = 1;
      i = match.index + fullMatch.length;
      continue;
    }

    if (!ALLOWED_TAGS.has(tag)) {
      i = match.index + fullMatch.length;
      continue;
    }

    if (tag === 'iframe' && !isClosing) {
      const rebuilt = rebuildOpeningTag(tag, attrString);
      if (!rebuilt) {
        // Failed embed verification — treat exactly like a dangerous tag:
        // drop this iframe and everything inside it, including whatever
        // fallback markup an attacker put between the tags.
        skippingTag = 'iframe';
        skipDepth = 1;
        i = match.index + fullMatch.length;
        continue;
      }
      output += rebuilt;
      i = match.index + fullMatch.length;
      continue;
    }

    output += isClosing ? `</${tag}>` : rebuildOpeningTag(tag, attrString);
    i = match.index + fullMatch.length;
  }

  return output;
}

function escapeStray(text: string): string {
  return text.replace(/&(?!#?\w+;)/g, '&amp;').replace(/</g, '&lt;');
}

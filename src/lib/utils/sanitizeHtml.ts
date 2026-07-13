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
 * (script/object/embed/form), and for allowed tags strip every attribute
 * except an explicit per-tag allowlist. Intentionally conservative —
 * favors stripping something borderline over risking an XSS vector.
 *
 * <style> blocks are a special case (see sanitizeStyleBlock below): they
 * are NOT stripped outright anymore. Instead their contents are parsed as
 * text, dangerous constructs (@import, expression(), javascript:, unsafe
 * url(), etc.) are rejected, every selector is auto-prefixed with a
 * per-post scope class so author CSS can never restyle anything outside
 * the post body, and the survivors are re-emitted inside a single
 * <style> tag. The rendered content itself must be wrapped by the caller
 * in a matching `.post-content-{scopeId}` container for this to work —
 * see wrapWithScopeClass() / the scopeId param on sanitizeHtml().
 */

const DANGEROUS_TAGS_STRIP_CONTENT = new Set(['script', 'object', 'embed', 'form']);

const ALLOWED_TAGS = new Set([
  'p', 'br', 'hr',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'strong', 'b', 'em', 'i', 'u', 's', 'mark', 'small', 'sub', 'sup',
  'ul', 'ol', 'li', 'dl', 'dt', 'dd',
  'blockquote', 'pre', 'code',
  'a', 'img', 'figure', 'figcaption',
  'table', 'thead', 'tbody', 'tr', 'th', 'td', 'caption', 'colgroup', 'col',
  'div', 'span', 'iframe', 'style',
  'article', 'section', 'header', 'footer', 'main', 'nav', 'aside',
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
  article: new Set(['style']),
  section: new Set(['style']),
  header: new Set(['style']),
  footer: new Set(['style']),
  main: new Set(['style']),
  nav: new Set(['style']),
  aside: new Set(['style']),
  // iframe intentionally NOT given a normal attrs entry — it's handled by
  // a dedicated branch in rebuildOpeningTag() that only ever emits a
  // fixed, hardcoded set of attributes for a verified embed URL.
  // style intentionally NOT given a normal attrs entry either — its
  // *contents*, not attributes, are what matter, and those are handled by
  // sanitizeStyleBlock() via the skippingTag capture-and-transform path.
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
  width: (v) => isSafeCssColorOrLength(v) && /^\d{1,4}(px|%|em|rem)$/.test(v.trim()),
  'max-width': (v) => isSafeCssColorOrLength(v) && /^\d{1,4}(px|%|em|rem)$/.test(v.trim()),
  'font-family': (v) => isSafeCssColorOrLength(v) && /^[a-z0-9\s,'"\-]{1,120}$/i.test(v.trim()),
  'font-size': (v) => isSafeCssColorOrLength(v) && /^\d{1,3}(\.\d{1,2})?(px|%|em|rem|pt)$/.test(v.trim()),
  'font-weight': (v) => /^(normal|bold|bolder|lighter|[1-9]00)$/.test(v.trim()),
  'line-height': (v) => /^\d{1,2}(\.\d{1,2})?(px|%|em|rem)?$/.test(v.trim()),
  padding: (v) => isSafeCssColorOrLength(v) && /^(\d{1,4}(px|%|em|rem)\s*){1,4}$/.test(v.trim()),
  margin: (v) => isSafeCssColorOrLength(v) && /^(-?\d{1,4}(px|%|em|rem)\s*){1,4}$/.test(v.trim()),
  border: (v) => isSafeCssColorOrLength(v) && /^\d{1,3}px\s+(solid|dashed|dotted|double|none)\s+(#[0-9a-f]{3,8}|rgb\([^)]*\)|rgba\([^)]*\)|[a-z]+)$/i.test(v.trim()),
  'border-radius': (v) => isSafeCssColorOrLength(v) && /^(\d{1,4}(px|%)\s*){1,4}$/.test(v.trim()),
  'box-shadow': (v) =>
    isSafeCssColorOrLength(v) &&
    /^(-?\d{1,3}px\s+){2,3}\d{0,3}px\s*(#[0-9a-f]{3,8}|rgb\([^)]*\)|rgba\([^)]*\)|[a-z]+)$/i.test(v.trim()),
  display: (v) => /^(block|inline|inline-block|flex|inline-flex|grid|inline-grid|none)$/.test(v.trim()),
  'flex-direction': (v) => /^(row|row-reverse|column|column-reverse)$/.test(v.trim()),
  gap: (v) => isSafeCssColorOrLength(v) && /^(\d{1,4}(px|%|em|rem)\s*){1,2}$/.test(v.trim()),
  'align-items': (v) => /^(flex-start|flex-end|center|baseline|stretch)$/.test(v.trim()),
  'justify-content': (v) =>
    /^(flex-start|flex-end|center|space-between|space-around|space-evenly)$/.test(v.trim()),
  'grid-template-columns': (v) =>
    isSafeCssColorOrLength(v) && /^(\d{1,4}(px|%|fr)\s*|repeat\(\d{1,2},\s*[\w%]+\)\s*)+$/.test(v.trim()),
};

function isSafeCssColorOrLength(value: string): boolean {
  const v = value.trim().toLowerCase();
  // Blocks url(), expression(), javascript:, and any other function call
  // except the handful of legitimate color/measurement functions checked
  // separately by each property's own regex.
  if (/url\s*\(|expression\s*\(|javascript:|import|@/.test(v)) return false;
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

// ---------------------------------------------------------------------
// Scoped <style> block sanitization
// ---------------------------------------------------------------------

// Selectors/tokens that must never survive, anywhere in a rule, because
// they'd let author CSS reach outside the post's own render container.
// Matched case-insensitively against each selector's own text, not the
// whole stylesheet, so a legitimate class like `.card-shadow` doesn't get
// caught by a substring match against `body`.
const GLOBAL_SELECTOR_BLOCKLIST = new Set([
  'html', 'body', '*', ':root', 'head', 'title', 'meta', 'link',
]);

// Site-wide component/layout classes an attacker (or a careless paste
// from Homverax-style markup) might target to restyle chrome outside the
// post body. Extend this list if new global class names are introduced.
const SITE_WIDE_CLASS_BLOCKLIST = new Set([
  'navbar', 'nav', 'header', 'footer', 'sidebar', 'app-shell', 'app-root',
  'modal', 'modal-overlay', 'toast', 'dropdown-menu', 'admin-panel',
  'prose', // the post renderer's own wrapper class — don't let author CSS retarget it globally
]);

function isDangerousCssChunk(css: string): boolean {
  const lower = css.toLowerCase();
  if (lower.includes('@import')) return true;
  if (lower.includes('expression(')) return true;
  if (lower.includes('javascript:')) return true;
  if (lower.includes('-moz-binding')) return true;
  return false;
}

function isSafeCssUrl(rawUrl: string): boolean {
  const trimmed = rawUrl.trim().replace(/^["']|["']$/g, '');
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) return true; // relative, same-origin
  try {
    const url = new URL(trimmed);
    return url.protocol === 'https:';
  } catch {
    return false;
  }
}

/** Rejects a declaration block if it contains any url(...) that isn't https:// or a same-origin relative path. */
function hasOnlySafeUrls(declBlock: string): boolean {
  const urlRegex = /url\(\s*("([^"]*)"|'([^']*)'|([^)]*))\s*\)/gi;
  let match: RegExpExecArray | null;
  while ((match = urlRegex.exec(declBlock)) !== null) {
    const raw = match[2] ?? match[3] ?? match[4] ?? '';
    if (!isSafeCssUrl(raw)) return false;
  }
  return true;
}

/**
 * Prefixes every selector in a comma-separated selector list with the
 * post's scope class, e.g. `h2, .callout` -> `.post-content-42 h2,
 * .post-content-42 .callout`. This is a text-level transform (no real CSS
 * parser), matching the rest of this file's dependency-free approach.
 * Rejects (drops) any individual selector that:
 *  - is exactly one of the global blocklist tokens (html, body, *, :root, ...)
 *  - references an ID/class in SITE_WIDE_CLASS_BLOCKLIST
 *  - uses :is()/:where()/:has(), which are blocked outright rather than
 *    inspected, since their arguments could otherwise smuggle an
 *    unscoped selector past this text-level check
 */
function scopeSelectorList(selectorList: string, scopeClass: string): string | null {
  const parts = selectorList.split(',').map((s) => s.trim()).filter(Boolean);
  if (parts.length === 0) return null;

  const scoped: string[] = [];
  for (const selector of parts) {
    const lower = selector.toLowerCase();

    if (GLOBAL_SELECTOR_BLOCKLIST.has(lower)) continue;

    // Reject bare `*` combined with combinators too (`* > *`, `*, foo`).
    if (/(^|[\s>+~])\*($|[\s>+~])/.test(` ${lower} `)) continue;

    // Reject any compound selector containing a site-wide blocked class/id.
    const hitsBlockedClass = [...SITE_WIDE_CLASS_BLOCKLIST].some((cls) =>
      new RegExp(`[.#]${cls}\\b`, 'i').test(selector)
    );
    if (hitsBlockedClass) continue;

    if (/:(is|where|has)\s*\(/i.test(selector)) continue;

    scoped.push(`.${scopeClass} ${selector}`);
  }

  return scoped.length > 0 ? scoped.join(', ') : null;
}

/**
 * Parses and sanitizes the text contents of a <style> block, scoping
 * every surviving selector to `.{scopeClass}`. Text-based (no real CSS
 * parser), consistent with the rest of this file. Comments are stripped
 * first so `/* html { ... } *\/`-style tricks can't hide dangerous rules
 * from the checks below, and so nothing from inside a comment leaks into
 * output.
 */
function sanitizeStyleBlock(cssText: string, scopeClass: string): string {
  const withoutComments = cssText.replace(/\/\*[\s\S]*?\*\//g, '');

  const output: string[] = [];
  // Match `selector { declarations }` blocks one at a time. Nested braces
  // (e.g. @media) are handled by the @-rule branch below, which is
  // dropped entirely, since safely scoping arbitrary nested @-rules is
  // out of scope for a text-level sanitizer.
  const ruleRegex = /([^{}]+)\{([^{}]*)\}/g;
  let match: RegExpExecArray | null;

  while ((match = ruleRegex.exec(withoutComments)) !== null) {
    const rawSelector = match[1].trim();
    const rawDecls = match[2];

    if (!rawSelector || !rawDecls) continue;

    // Drop @-rules outright (at-rule bodies aren't real selectors, and
    // @import/@font-face/@keyframes etc. all have their own attack
    // surface that a text-level scoper can't safely reason about).
    if (rawSelector.startsWith('@')) continue;

    if (isDangerousCssChunk(rawSelector) || isDangerousCssChunk(rawDecls)) continue;
    if (!hasOnlySafeUrls(rawDecls)) continue;

    const scopedSelector = scopeSelectorList(rawSelector, scopeClass);
    if (!scopedSelector) continue;

    // Re-validate each declaration line for dangerous function calls one
    // more time at the per-declaration level (belt-and-braces alongside
    // the whole-block check above), then keep the raw property: value
    // text as-is — a <style> block is explicitly opt-in richer CSS
    // support, scoped by selector rather than restricted to a fixed
    // property list the way inline style="" is. Dangerous *mechanisms*
    // (@import, expression, javascript:, unsafe url()) are blocked;
    // ordinary properties are not restricted to a fixed list here.
    const cleanedDecls = rawDecls
      .split(';')
      .map((d) => d.trim())
      .filter(Boolean)
      .filter((d) => !isDangerousCssChunk(d))
      .join('; ');

    if (!cleanedDecls) continue;

    output.push(`${scopedSelector} { ${cleanedDecls}; }`);
  }

  return output.join('\n');
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

// Default scope used when no scopeId is supplied by the caller (e.g. the
// per-block editor preview in HtmlBlockView, which sanitizes fragments
// outside the context of a specific post). Any <style> blocks pasted
// there still get scoped — just to a shared, harmless default class —
// rather than silently dropped or left unscoped.
const DEFAULT_SCOPE_ID = 'default';

function scopeClassFor(scopeId?: string | number): string {
  const raw = String(scopeId ?? DEFAULT_SCOPE_ID);
  // Keep the class name predictable and safe regardless of what's passed
  // in (post IDs are expected to be numeric/slug-like, but don't trust
  // that blindly since this ends up in emitted CSS/HTML).
  const safe = raw.replace(/[^a-zA-Z0-9_-]/g, '');
  return `post-content-${safe || DEFAULT_SCOPE_ID}`;
}

/**
 * Wraps already-sanitized post HTML in the matching scope container so
 * that scoped selectors emitted by sanitizeStyleBlock() actually apply.
 * Call this around the *rendered* content, using the same scopeId you
 * passed into sanitizeHtml().
 */
export function wrapWithScopeClass(html: string, scopeId?: string | number): string {
  return `<div class="${scopeClassFor(scopeId)}">${html}</div>`;
}

/**
 * If the input is a full HTML document (starts with <!DOCTYPE>, <html>,
 * or contains a <head>/<body> split) rather than a fragment, extract just
 * the <body> contents. This lets someone paste a complete exported HTML
 * page (e.g. from an authoring tool) as post content and get the
 * expected result — the visible body, with its <style> block preserved
 * and scoped — instead of having the entire document silently stripped
 * because <html>/<head>/<body>/<title>/<meta> aren't in ALLOWED_TAGS.
 *
 * Any <style> tag(s) originally inside <head> are relocated to the front
 * of the extracted body content so sanitizeHtml's normal style-capture
 * path still finds and scopes them — <head> itself is never treated as
 * "inside body" by the tag walker.
 */
function unwrapFullDocument(html: string): string {
  const hasDoctype = /^\s*<!DOCTYPE/i.test(html);
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);

  if (!hasDoctype && !bodyMatch) return html;

  const headMatch = html.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
  const headStyles = headMatch ? [...headMatch[1].matchAll(/<style[^>]*>[\s\S]*?<\/style>/gi)].map((m) => m[0]).join('\n') : '';

  const bodyContent = bodyMatch ? bodyMatch[1] : html.replace(/<!DOCTYPE[^>]*>/i, '').replace(/<\/?html[^>]*>/gi, '');

  return headStyles ? `${headStyles}\n${bodyContent}` : bodyContent;
}

export function sanitizeHtml(input: string, scopeId?: string | number): string {
  const scopeClass = scopeClassFor(scopeId);
  const unwrapped = unwrapFullDocument(input);

  let output = '';
  let i = 0;
  let skippingTag: string | null = null;
  let skipDepth = 0;
  let styleCapture: string | null = null; // accumulates raw text inside a <style> block being captured

  const tagRegex = /<\/?([a-zA-Z][a-zA-Z0-9]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/g;
  const source = unwrapped;

  while (i < source.length) {
    tagRegex.lastIndex = i;
    const match = tagRegex.exec(source);

    if (!match || match.index !== i) {
      if (styleCapture !== null) {
        const nextTagIndex = source.indexOf('<', i);
        const chunkEnd = nextTagIndex === -1 ? source.length : nextTagIndex;
        styleCapture += source.slice(i, chunkEnd);
        i = chunkEnd === i ? i + 1 : chunkEnd;
      } else if (!skippingTag) {
        const nextTagIndex = source.indexOf('<', i);
        const chunkEnd = nextTagIndex === -1 ? source.length : nextTagIndex;
        output += escapeStray(source.slice(i, chunkEnd));
        i = chunkEnd === i ? i + 1 : chunkEnd;
      } else {
        i++;
      }
      continue;
    }

    const [fullMatch, rawTag, attrString] = match;
    const tag = rawTag.toLowerCase();
    const isClosing = fullMatch.startsWith('</');

    // Capturing a <style> block's raw text content until its closing tag.
    if (styleCapture !== null) {
      if (tag === 'style' && isClosing) {
        const sanitized = sanitizeStyleBlock(styleCapture, scopeClass);
        if (sanitized) {
          output += `<style>\n${sanitized}\n</style>`;
        }
        styleCapture = null;
        i = match.index + fullMatch.length;
        continue;
      }
      // Anything else encountered while inside <style>...</style> (e.g. a
      // tag-like sequence inside a CSS content string) is treated as
      // literal text, not markup — append the raw source, not a rebuilt
      // tag, since this is CSS text, not HTML.
      styleCapture += fullMatch;
      i = match.index + fullMatch.length;
      continue;
    }

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

    if (tag === 'style' && !isClosing) {
      // Self-closing/empty <style/> — nothing to capture.
      if (fullMatch.endsWith('/>')) {
        i = match.index + fullMatch.length;
        continue;
      }
      styleCapture = '';
      i = match.index + fullMatch.length;
      continue;
    }
    if (tag === 'style' && isClosing) {
      // Stray closing </style> with no matching open — ignore.
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

  // Input ended while still inside an unterminated <style> block — drop
  // it rather than emit a dangling/partial style tag.
  return output;
}

function escapeStray(text: string): string {
  return text.replace(/&(?!#?\w+;)/g, '&amp;').replace(/</g, '&lt;');
}

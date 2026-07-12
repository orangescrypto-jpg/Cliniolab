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

const DANGEROUS_TAGS_STRIP_CONTENT = new Set(['script', 'style', 'iframe', 'object', 'embed', 'form']);

const ALLOWED_TAGS = new Set([
  'p', 'br', 'hr',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'strong', 'b', 'em', 'i', 'u', 's', 'mark', 'small', 'sub', 'sup',
  'ul', 'ol', 'li',
  'blockquote', 'pre', 'code',
  'a', 'img',
  'table', 'thead', 'tbody', 'tr', 'th', 'td',
  'div', 'span',
]);

const ALLOWED_ATTRS: Record<string, Set<string>> = {
  a: new Set(['href', 'title', 'target', 'rel']),
  img: new Set(['src', 'alt', 'title', 'width', 'height']),
  table: new Set(['border']),
  td: new Set(['colspan', 'rowspan']),
  th: new Set(['colspan', 'rowspan']),
};
const GLOBAL_ALLOWED_ATTRS = new Set(['class', 'id']);

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
  const allowedForTag = new Set([...(ALLOWED_ATTRS[tag] ?? []), ...GLOBAL_ALLOWED_ATTRS]);
  const kept: string[] = [];
  let target = '';

  for (const { name, value } of attrs) {
    const lowerName = name.toLowerCase();
    if (lowerName.startsWith('on')) continue;
    if (!allowedForTag.has(lowerName)) continue;
    if ((lowerName === 'href' || lowerName === 'src') && !isSafeUrlValue(value)) continue;
    if (lowerName === 'target') target = value;
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

    output += isClosing ? `</${tag}>` : rebuildOpeningTag(tag, attrString);
    i = match.index + fullMatch.length;
  }

  return output;
}

function escapeStray(text: string): string {
  return text.replace(/&(?!#?\w+;)/g, '&amp;').replace(/</g, '&lt;');
}

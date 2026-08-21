/**
 * Normalizes text for duplicate-detection comparisons across bulk upload
 * pipelines (abbreviations/glossary, quiz titles, question prompts).
 *
 * Goes further than a plain `.toLowerCase()` so that near-duplicates that
 * differ only in punctuation, whitespace, or trivial formatting are still
 * caught — e.g. "ACE Inhibitor" vs "ACE-Inhibitor" vs "ace  inhibitor."
 * would all normalize to the same key.
 */
export function normalizeForDedup(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '') // strip accents
    .replace(/[^\w\s]/g, '') // strip punctuation
    .replace(/\s+/g, ' ')
    .trim();
}

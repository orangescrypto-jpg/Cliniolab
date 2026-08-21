import type { QuestionOption } from '@/types';

/**
 * Some legacy bulk-uploaded rows have `correct_answer` stored as a bare
 * option letter ("A"-"D", optionally with a trailing "." or ")") instead
 * of the actual option id ("option_1" etc). Those rows were imported
 * before the bulk-upload letter-mapping fix and live in D1 as-is — we
 * deliberately do NOT rewrite them there, since old quiz_attempts rows
 * already reference the original option ids and rewriting stored data
 * retroactively risks breaking other things that read it as-is.
 *
 * Instead we resolve the *effective* correct answer at grading/display
 * time: if `correctAnswer` already matches an option id, use it as-is;
 * if it looks like a bare letter, map it positionally (A=1st option,
 * B=2nd, etc); otherwise fall back to matching against option text.
 * This makes old quizzes gradeable/re-attemptable correctly without
 * touching a single row in D1. Used by both the server-side grading
 * path (attemptService) and Study Mode's client-side grading.
 */
export function resolveEffectiveCorrectAnswer(
  correctAnswer: string,
  options: QuestionOption[] | null | undefined
): string {
  const raw = correctAnswer.trim();
  if (!options || options.length === 0) return raw;

  // Already a valid option id - nothing to resolve.
  if (options.some((o) => o.id === raw)) return raw;

  // Bare letter form: "A", "b", "C.", "d)" etc.
  const letterMatch = raw.match(/^([A-Za-z])[.)]?$/);
  if (letterMatch) {
    const index = letterMatch[1].toUpperCase().charCodeAt(0) - 'A'.charCodeAt(0);
    if (index >= 0 && index < options.length) {
      return options[index].id;
    }
  }

  // Fall back to exact option-text match (case-insensitive).
  const textMatch = options.find(
    (o) => o.text.trim().toLowerCase() === raw.toLowerCase()
  );
  if (textMatch) return textMatch.id;

  // Nothing resolvable - return as-is (will simply never match a
  // submitted option id, same as current broken behavior).
  return raw;
}

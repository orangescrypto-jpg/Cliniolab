/**
 * localStorage-backed session drafts.
 *
 * IMPORTANT: This is a device-local, best-effort cache only. It exists to
 * survive an accidental refresh/tab-close mid-session. It is never the
 * source of truth for scores, attempt history, or anything that needs to
 * be visible across devices — that all lives in D1 via the submit/attempt
 * APIs. Drafts are cleared as soon as the thing they were backing up
 * either completes (quiz submitted) or becomes stale (quiz updated).
 *
 * All reads/writes are wrapped in try/catch because localStorage can throw
 * (private browsing, storage quota, disabled storage, SSR) and none of
 * that should ever break the actual quiz-taking flow.
 */

const PREFIX = 'cliniolab:draft:';

function key(namespace: string, quizId: string): string {
  return `${PREFIX}${namespace}:${quizId}`;
}

export function loadDraft<T>(namespace: string, quizId: string): T | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(key(namespace, quizId));
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function saveDraft<T>(namespace: string, quizId: string, value: T): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key(namespace, quizId), JSON.stringify(value));
  } catch {
    // Storage full/unavailable — silently skip, this is a best-effort cache.
  }
}

export function clearDraft(namespace: string, quizId: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(key(namespace, quizId));
  } catch {
    // no-op
  }
}

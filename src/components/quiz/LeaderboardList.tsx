import type { LeaderboardEntry } from '@/types';

/** Deterministic color for an initials avatar, based on the name itself
 *  so a given person always gets the same color across renders/pages. */
const AVATAR_PALETTE = [
  'bg-pulse-500',
  'bg-flag-500',
  'bg-ink-500',
  'bg-critical-400',
  'bg-pulse-700',
  'bg-flag-700',
] as const;

function avatarColorFor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_PALETTE[hash % AVATAR_PALETTE.length];
}

function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Small trophy glyph for #1, kept as inline SVG so no icon lib is needed. */
function TrophyIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M7 4h10v3a5 5 0 0 1-5 5 5 5 0 0 1-5-5V4Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M7 5H4a3 3 0 0 0 3 3M17 5h3a3 3 0 0 1-3 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M12 12v3M9 19h6M10 19v-2.5a2 2 0 0 1 4 0V19" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

/** Row-level accent for the top 3 - a gold/silver/bronze feel using the
 *  existing palette rather than introducing literal gold/silver hexes. */
function rankStyles(rank: number): { row: string; badge: string; rankText: string } {
  if (rank === 1) {
    return {
      row: 'bg-flag-50/60',
      badge: 'bg-flag-500 text-white',
      rankText: 'text-flag-600',
    };
  }
  if (rank === 2) {
    return {
      row: '',
      badge: 'bg-ink-200 text-ink-700',
      rankText: 'text-ink-500',
    };
  }
  if (rank === 3) {
    return {
      row: '',
      badge: 'bg-flag-200 text-flag-700',
      rankText: 'text-flag-600',
    };
  }
  return { row: '', badge: 'bg-ink-50 text-ink-400', rankText: 'text-ink-400' };
}

export function LeaderboardList({
  entries,
  title,
  currentUserId,
  currentUserRank,
  primaryMetric = 'points',
}: {
  entries: LeaderboardEntry[];
  title: string;
  /** Signed-in visitor's id, if any - used to highlight their row inline. */
  currentUserId?: string | null;
  /**
   * Signed-in visitor's rank on this specific board, if known and outside
   * the visible `entries` list. Only render the "you're #N" nudge when
   * this is a real, fetched value - never estimate or invent a rank.
   */
  currentUserRank?: number | null;
  /**
   * Which number leads visually (larger/bolder) in each row.
   * 'points' (default) suits multi-quiz boards (general, category) where
   * total score reflects volume + consistency across many attempts.
   * 'average' suits a single-quiz board, where points and % are really
   * the same score twice - leading with accuracy reads more naturally
   * than leading with a raw point total for just one quiz.
   */
  primaryMetric?: 'points' | 'average';
}) {
  if (entries.length === 0) {
    return (
      <div className="rounded-lg border border-ink-100 bg-white p-6 text-sm text-ink-400">
        No attempts yet — be the first on the {title.toLowerCase()}.
      </div>
    );
  }

  const viewerIsRanked = currentUserId != null && entries.some((e) => e.userId === currentUserId);
  const showViewerNudge =
    currentUserId != null && !viewerIsRanked && typeof currentUserRank === 'number';

  return (
    <div className="overflow-hidden rounded-lg border border-ink-100 bg-white">
      <div className="flex items-center gap-2 border-b border-ink-100 px-5 py-3">
        <TrophyIcon className="h-5 w-5 text-flag-500" />
        <h3 className="font-display text-base font-semibold text-ink-800">{title}</h3>
      </div>
      <ol>
        {entries.map((entry) => {
          const styles = rankStyles(entry.rank);
          const isViewer = currentUserId != null && entry.userId === currentUserId;
          return (
            <li
              key={entry.userId}
              className={`flex items-center justify-between gap-3 border-b border-ink-50 px-5 py-3 last:border-b-0 ${
                styles.row
              } ${isViewer ? 'ring-1 ring-inset ring-pulse-400' : ''}`}
            >
              <div className="flex min-w-0 items-center gap-3">
                <span
                  className={`flex h-6 w-6 flex-none items-center justify-center rounded-full font-mono text-xs font-semibold ${styles.badge}`}
                >
                  {entry.rank <= 3 ? entry.rank : `#${entry.rank}`}
                </span>
                <span
                  className={`flex h-8 w-8 flex-none items-center justify-center rounded-full text-xs font-semibold text-white ${avatarColorFor(
                    entry.displayName
                  )}`}
                  aria-hidden="true"
                >
                  {initialsFor(entry.displayName)}
                </span>
                <span className="truncate text-sm font-medium text-ink-700">
                  {entry.displayName}
                  {isViewer && <span className="ml-1.5 text-xs font-normal text-pulse-600">(you)</span>}
                </span>
              </div>
              <div className="flex flex-none items-center gap-4 font-mono text-xs text-ink-400">
                <span className="hidden sm:inline">
                  {primaryMetric === 'points' ? `${entry.quizzesTaken} quizzes` : 'best attempt'}
                </span>
                <div className="text-right">
                  {primaryMetric === 'points' ? (
                    <>
                      <div className="text-sm font-semibold text-pulse-600">{entry.totalScore} pts</div>
                      <div className="text-[11px] text-ink-400">{Math.round(entry.averagePercentage)}% avg</div>
                    </>
                  ) : (
                    <>
                      <div className="text-sm font-semibold text-pulse-600">
                        {Math.round(entry.averagePercentage)}% avg
                      </div>
                      <div className="text-[11px] text-ink-400">{entry.totalScore} pts</div>
                    </>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
      {showViewerNudge && (
        <div className="border-t border-ink-100 bg-ink-50/60 px-5 py-3 text-sm text-ink-600">
          You&apos;re currently <span className="font-semibold text-ink-800">#{currentUserRank}</span> —
          take a quiz to climb the board.
        </div>
      )}
      {currentUserId == null && (
        <div className="border-t border-ink-100 bg-ink-50/60 px-5 py-3 text-sm text-ink-600">
          <a href="/register" className="font-medium text-pulse-600 hover:underline">
            Sign up
          </a>{' '}
          and take a quiz to get on the board.
        </div>
      )}
    </div>
  );
}

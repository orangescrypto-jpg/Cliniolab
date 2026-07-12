import type { LeaderboardEntry } from '@/types';

export function LeaderboardList({ entries, title }: { entries: LeaderboardEntry[]; title: string }) {
  if (entries.length === 0) {
    return (
      <div className="rounded-lg border border-ink-100 bg-white p-6 text-sm text-ink-400">
        No attempts yet — be the first on the {title.toLowerCase()}.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-ink-100 bg-white">
      <div className="border-b border-ink-100 px-5 py-3">
        <h3 className="font-display text-base font-semibold text-ink-800">{title}</h3>
      </div>
      <ol>
        {entries.map((entry) => (
          <li
            key={entry.userId}
            className="flex items-center justify-between border-b border-ink-50 px-5 py-3 last:border-b-0"
          >
            <div className="flex items-center gap-3">
              <span
                className={`font-mono text-sm font-semibold ${
                  entry.rank <= 3 ? 'text-flag-500' : 'text-ink-400'
                }`}
              >
                #{entry.rank}
              </span>
              <span className="text-sm font-medium text-ink-700">{entry.displayName}</span>
            </div>
            <div className="flex items-center gap-4 font-mono text-xs text-ink-400">
              <span>{entry.quizzesTaken} quizzes</span>
              <span className="font-semibold text-pulse-600">{Math.round(entry.averagePercentage)}%</span>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

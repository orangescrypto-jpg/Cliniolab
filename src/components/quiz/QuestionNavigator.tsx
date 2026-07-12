'use client';

/**
 * CBT-style question navigator grid, shared across Study, Quiz, and Exam
 * modes. Shows every question number so the user can jump directly to any
 * question, and color-codes each number by status (current / answered /
 * flagged / unanswered) the way standard computer-based testing UIs do.
 */
export interface NavigatorQuestionState {
  answered: boolean;
  flagged?: boolean;
}

interface QuestionNavigatorProps {
  total: number;
  current: number; // 0-indexed
  states: NavigatorQuestionState[];
  onJump: (index: number) => void;
  className?: string;
}

export function QuestionNavigator({
  total,
  current,
  states,
  onJump,
  className = '',
}: QuestionNavigatorProps) {
  return (
    <div className={className}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pb-3 text-xs text-ink-400">
        <LegendDot className="bg-pulse-500" label="Current" />
        <LegendDot className="bg-pulse-100 ring-1 ring-inset ring-pulse-300" label="Answered" />
        <LegendDot className="bg-flag-400" label="Flagged" />
        <LegendDot className="bg-white ring-1 ring-inset ring-ink-200" label="Unanswered" />
      </div>
      <div className="grid grid-cols-8 gap-1.5 sm:grid-cols-10">
        {Array.from({ length: total }, (_, i) => {
          const state = states[i] ?? { answered: false, flagged: false };
          const isCurrent = i === current;

          let classes =
            'relative flex h-8 w-8 items-center justify-center rounded-md text-xs font-medium transition-colors';
          if (isCurrent) {
            classes += ' bg-pulse-500 text-white';
          } else if (state.answered) {
            classes += ' bg-pulse-50 text-pulse-700 ring-1 ring-inset ring-pulse-300 hover:bg-pulse-100';
          } else {
            classes += ' bg-white text-ink-500 ring-1 ring-inset ring-ink-200 hover:bg-ink-50';
          }

          return (
            <button
              key={i}
              type="button"
              onClick={() => onJump(i)}
              aria-label={`Go to question ${i + 1}${state.answered ? ', answered' : ', unanswered'}${state.flagged ? ', flagged' : ''}`}
              aria-current={isCurrent ? 'true' : undefined}
              className={classes}
            >
              {i + 1}
              {state.flagged && (
                <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-flag-400" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function LegendDot({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`h-2.5 w-2.5 rounded-full ${className}`} />
      {label}
    </span>
  );
}

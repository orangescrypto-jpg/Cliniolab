import Link from 'next/link';
import { Card, DifficultyBadge, difficultyEdgeClass } from '@/components/ui/Card';
import { ShareButton } from '@/components/quiz/ShareButton';
import { BookmarkButton } from '@/components/ui/BookmarkButton';
import type { QuizWithStats } from '@/types';

export function QuizCard({ quiz }: { quiz: QuizWithStats }) {
  return (
    <Link href={`/quizzes/${quiz.id}`}>
      <Card className={`p-5 transition-shadow hover:shadow-md ${difficultyEdgeClass(quiz.difficulty)}`}>
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-display text-lg font-semibold text-ink-800">{quiz.title}</h3>
          <div className="flex items-center gap-2">
            {quiz.pricing === 'paid' && (
              <span className="rounded bg-flag-50 px-2 py-0.5 text-xs font-semibold text-flag-600">Paid</span>
            )}
            <DifficultyBadge difficulty={quiz.difficulty} />
            <BookmarkButton kind="quiz" targetId={quiz.id} />
          </div>
        </div>
        {quiz.description && (
          <p className="mt-1 line-clamp-2 text-sm text-ink-500">{quiz.description}</p>
        )}
        <div className="mt-4 flex items-center gap-4 font-mono text-xs text-ink-400">
          <span>{quiz.questionCount} Qs</span>
          <span>
            {quiz.mode === 'exam' ? 'Exam / CBT Mode' : quiz.mode === 'study' ? 'Study Mode' : 'Quiz Mode'}
          </span>
          <span>{quiz.attemptCount} attempts</span>
          {quiz.averageScorePercent !== null && (
            <span>Avg {Math.round(quiz.averageScorePercent)}%</span>
          )}
          {quiz.commentCount > 0 && (
            <span>{quiz.commentCount} {quiz.commentCount === 1 ? 'comment' : 'comments'}</span>
          )}
        </div>
        {(quiz.categoryName || quiz.subcategoryName) && (
          <div className="mt-3 text-xs text-ink-400">
            {quiz.categoryName} {quiz.subcategoryName ? `· ${quiz.subcategoryName}` : ''}
          </div>
        )}
        {quiz.creatorName && (
          <div className="mt-1 text-xs text-ink-400">By {quiz.creatorName}</div>
        )}
        {quiz.visibility === 'public' && (
          <div
            className="mt-3"
            onClick={(e) => e.preventDefault()} // don't trigger the card's Link navigation
          >
            <ShareButton
              url={typeof window !== 'undefined' ? `${window.location.origin}/quizzes/${quiz.id}` : ''}
              title={quiz.title}
            />
          </div>
        )}
      </Card>
    </Link>
  );
}

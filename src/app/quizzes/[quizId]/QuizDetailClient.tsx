'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/AuthProvider';
import { QuizRunner } from '@/components/quiz/QuizRunner';
import { StudyModeRunner } from '@/components/quiz/StudyModeRunner';
import { CommentThread } from '@/components/quiz/CommentThread';
import { ShareButton } from '@/components/quiz/ShareButton';
import { QuizLeaderboardSection } from '@/components/quiz/QuizLeaderboardSection';
import { RelatedQuizzes } from '@/components/quiz/RelatedQuizzes';
import { Button } from '@/components/ui/Button';
import { Card, DifficultyBadge } from '@/components/ui/Card';
import type { Quiz, QuizQuestion } from '@/types';

const MODE_LABELS: Record<Quiz['mode'], string> = {
  study: 'Study Mode',
  quiz: 'Quiz Mode',
  exam: 'Exam / CBT Mode',
};

function formatNaira(kobo: number): string {
  return `₦${(kobo / 100).toLocaleString('en-NG')}`;
}

export function QuizDetailClient({ quizId }: { quizId: string }) {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [questions, setQuestions] = useState<Omit<QuizQuestion, 'correctAnswer'>[]>([]);
  const [studyQuestions, setStudyQuestions] = useState<QuizQuestion[]>([]);
  const [started, setStarted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetching, setFetching] = useState(false);
  const [requiresPurchase, setRequiresPurchase] = useState(false);
  const [purchasing, setPurchasing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Lightweight preview load so the owner sees a Delete option before
  // committing to "Start" (which pulls full question sets).
  useEffect(() => {
    if (!user) return;
    fetch(`/api/quizzes/${quizId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.quiz) setQuiz((prev) => prev ?? data.quiz);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quizId, user]);

  const isOwner = !!user && !!quiz && (quiz.creatorId === user.id || user.role === 'admin' || user.role === 'moderator');

  async function handleDelete() {
    if (!confirm('Delete this quiz permanently? This cannot be undone.')) return;
    setDeleteError(null);
    setDeleting(true);
    try {
      const res = await fetch(`/api/quizzes/${quizId}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setDeleteError(data.error ?? `Failed to delete quiz (${res.status})`);
        return;
      }
      router.push('/quizzes');
    } catch {
      setDeleteError('Network error while deleting. Please try again.');
    } finally {
      setDeleting(false);
    }
  }

  async function handleStart() {
    setFetching(true);
    setError(null);
    setRequiresPurchase(false);
    try {
      // Peek at the quiz's mode first via the normal endpoint (which
      // never leaks correctAnswer), then only hit the study-only endpoint
      // if the quiz is actually in Study Mode.
      const res = await fetch(`/api/quizzes/${quizId}`);
      const data = await res.json();
      if (!res.ok) {
        if (data.requiresPurchase) {
          setQuiz(data.quiz ?? null);
          setRequiresPurchase(true);
        } else {
          setError(data.error ?? 'Failed to load quiz');
        }
        return;
      }

      if (data.quiz.mode === 'study') {
        const studyRes = await fetch(`/api/quizzes/${quizId}/study`);
        const studyData = await studyRes.json();
        if (!studyRes.ok) {
          if (studyData.requiresPurchase) {
            setQuiz(studyData.quiz ?? null);
            setRequiresPurchase(true);
          } else {
            setError(studyData.error ?? 'Failed to load quiz');
          }
          return;
        }
        setQuiz(studyData.quiz);
        setStudyQuestions(studyData.questions);
      } else {
        setQuiz(data.quiz);
        setQuestions(data.questions);
      }
      setStarted(true);
    } finally {
      setFetching(false);
    }
  }

  async function handlePurchase() {
    setPurchasing(true);
    setError(null);
    try {
      const res = await fetch(`/api/quizzes/${quizId}/purchase`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Failed to start checkout');
        return;
      }
      window.location.href = data.authorizationUrl;
    } finally {
      setPurchasing(false);
    }
  }

  if (loading) return null;

  if (!user) {
    return (
      <div className="mx-auto max-w-xl px-6 py-24 text-center">
        <h1 className="font-display text-2xl font-semibold text-ink-800">Login required</h1>
        <p className="mt-2 text-ink-500">You need an account to attempt this quiz.</p>
        <Button className="mt-6" onClick={() => (window.location.href = '/login')}>
          Log in
        </Button>
      </div>
    );
  }

  if (started && quiz) {
    if (quiz.mode === 'study') {
      return <StudyModeRunner quiz={quiz} questions={studyQuestions} />;
    }
    return <QuizRunner quiz={quiz} questions={questions} submitEndpoint={`/api/quizzes/${quizId}/attempt`} />;
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <Card className="p-8">
        <div className="flex items-start justify-between gap-3">
          <div>
            {quiz && <DifficultyBadge difficulty={quiz.difficulty} />}
            <h1 className="mt-2 font-display text-2xl font-semibold text-ink-800">
              {quiz?.title ?? 'Quiz'}
            </h1>
            {quiz && (
              <span className="mt-1 inline-block font-mono text-xs uppercase tracking-wide text-pulse-600">
                {MODE_LABELS[quiz.mode]}
              </span>
            )}
          </div>
          {quiz && quiz.visibility === 'public' && typeof window !== 'undefined' && (
            <ShareButton url={window.location.href} title={quiz.title} />
          )}
        </div>
        {quiz?.description && <p className="mt-2 text-ink-500">{quiz.description}</p>}
        {error && <p className="mt-4 text-sm text-critical-500">{error}</p>}
        {deleteError && <p className="mt-4 text-sm text-critical-500">{deleteError}</p>}

        {isOwner && (
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => router.push(`/quizzes/${quizId}/edit`)}
            >
              Edit
            </Button>
            <Button variant="danger" size="sm" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Deleting…' : 'Delete permanently'}
            </Button>
          </div>
        )}

        {requiresPurchase && quiz ? (
          <div className="mt-6 rounded-md border border-flag-200 bg-flag-50 p-4">
            <p className="text-sm font-medium text-ink-800">
              This is a paid quiz{quiz.priceKobo ? ` — ${formatNaira(quiz.priceKobo)}` : ''}.
            </p>
            <Button className="mt-3" onClick={handlePurchase} disabled={purchasing}>
              {purchasing ? 'Redirecting to payment…' : 'Purchase to unlock'}
            </Button>
          </div>
        ) : (
          <Button className="mt-6" onClick={handleStart} disabled={fetching}>
            {fetching ? 'Loading…' : 'Start'}
          </Button>
        )}
      </Card>

      <QuizLeaderboardSection quizId={quizId} />
      <CommentThread endpoint={`/api/quizzes/${quizId}/comments`} />
      <RelatedQuizzes endpoint={`/api/quizzes/${quizId}/related`} />
    </div>
  );
}

'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { QuestionNavigator } from '@/components/quiz/QuestionNavigator';
import type { AttemptResult, Quiz, QuizQuestion } from '@/types';

interface QuizRunnerProps {
  quiz: Quiz;
  questions: Omit<QuizQuestion, 'correctAnswer'>[];
  submitEndpoint: string;
}

/** Fisher-Yates shuffle, returns a new array without mutating the input. */
function shuffleArray<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function QuizRunner({ quiz, questions: rawQuestions, submitEndpoint }: QuizRunnerProps) {
  const router = useRouter();

  // Shuffle once per attempt (on mount), not on every render, so the order
  // doesn't jump around as the user answers. Option IDs are preserved so
  // grading (which matches on option id) is unaffected by display order.
  const [questions] = useState(() => {
    let list = rawQuestions;
    if (quiz.shuffleQuestions) list = shuffleArray(list);
    if (quiz.shuffleOptions) {
      list = list.map((q) =>
        q.options ? { ...q, options: shuffleArray(q.options) } : q
      );
    }
    return list;
  });

  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [startedAt] = useState(() => Date.now());
  const [remainingSeconds, setRemainingSeconds] = useState(quiz.timeLimitSeconds ?? 0);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<AttemptResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [flaggedQuestionIds, setFlaggedQuestionIds] = useState<Set<string>>(new Set());
  const [flaggingQuestionId, setFlaggingQuestionId] = useState<string | null>(null);
  const [flagError, setFlagError] = useState<string | null>(null);
  // "Mark for review" during the attempt (CBT-style), distinct from the
  // post-result "report this question" flag above.
  const [markedForReview, setMarkedForReview] = useState<Set<string>>(new Set());

  function toggleMarkForReview(questionId: string) {
    setMarkedForReview((prev) => {
      const next = new Set(prev);
      if (next.has(questionId)) next.delete(questionId);
      else next.add(questionId);
      return next;
    });
  }

  // Whether this attempt is timed — true for exam mode (always) and for
  // quiz mode when the creator opted into a time limit for a speed-drill.
  const hasTimer = !!quiz.timeLimitSeconds;

  useEffect(() => {
    if (!hasTimer || result) return;
    const interval = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          void handleSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasTimer, result]);

  const question = questions[current];
  const progressPercent = useMemo(
    () => Math.round(((current + 1) / questions.length) * 100),
    [current, questions.length]
  );
  const navigatorStates = useMemo(
    () =>
      questions.map((q) => ({
        answered: answers[q.id] !== undefined && answers[q.id] !== '',
        flagged: markedForReview.has(q.id),
      })),
    [questions, answers, markedForReview]
  );

  async function handleSubmit() {
    if (submitting || result) return;
    setSubmitting(true);
    setError(null);
    try {
      const timeTakenSeconds = Math.round((Date.now() - startedAt) / 1000);
      const res = await fetch(submitEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          answers: Object.entries(answers).map(([questionId, submittedAnswer]) => ({
            questionId,
            submittedAnswer,
          })),
          timeTakenSeconds,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Failed to submit attempt');
        setSubmitting(false);
        return;
      }
      setResult(data.result);
    } catch {
      setError('Network error while submitting. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleFlagQuestion(questionId: string) {
    if (flaggedQuestionIds.has(questionId) || flaggingQuestionId) return;
    setFlaggingQuestionId(questionId);
    setFlagError(null);
    try {
      const res = await fetch(`/api/quizzes/${quiz.id}/questions/${questionId}/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) {
        setFlagError(data.error ?? 'Failed to flag question');
        return;
      }
      setFlaggedQuestionIds((prev) => new Set(prev).add(questionId));
    } catch {
      setFlagError('Network error while flagging. Please try again.');
    } finally {
      setFlaggingQuestionId(null);
    }
  }

  if (result) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16">
        <Card className="p-8 text-center">
          <p className="font-mono text-xs uppercase tracking-widest text-pulse-600">Result</p>
          <p className="mt-4 font-display text-5xl font-semibold text-ink-800">
            {Math.round(result.percentage)}%
          </p>
          <p className="mt-2 text-ink-500">
            {result.score} / {result.totalQuestions} correct
          </p>
          {!result.countedForLeaderboard && (
            <p className="mt-3 text-xs text-flag-600">
              This quiz allows unlimited retakes, so only your first attempt is saved to your
              dashboard and the leaderboard. This attempt&apos;s score is shown here but wasn&apos;t recorded.
            </p>
          )}
          <div className="mt-8 space-y-4 text-left">
            {result.perQuestion.map((pq, i) => {
              const resolve = (value: string | null) => {
                if (value === null) return null;
                const match = pq.options.find((o) => o.id === value);
                return match ? match.text : value;
              };
              const submittedText = resolve(pq.submittedAnswer);
              const correctText = resolve(pq.correctAnswer);
              return (
              <div key={pq.questionId} className={`rounded-md border p-4 ${pq.isCorrect ? 'border-pulse-200 bg-pulse-50' : 'border-critical-200 bg-critical-50'}`}>
                <p className="text-sm font-medium text-ink-700">{i + 1}. {pq.prompt}</p>
                <p className="mt-1 text-sm text-ink-500">Your answer: {submittedText ?? '—'}</p>
                {!pq.isCorrect && (
                  <p className="text-sm text-ink-500">Correct answer: {correctText}</p>
                )}
                {pq.explanation && (
                  <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-ink-600">
                    {pq.explanation}
                  </p>
                )}
                {quiz.allowFlagging && (
                  <div className="mt-2">
                    {flaggedQuestionIds.has(pq.questionId) ? (
                      <p className="text-xs font-medium text-pulse-600">
                        Flagged — thanks, the creator has been notified.
                      </p>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleFlagQuestion(pq.questionId)}
                        disabled={flaggingQuestionId === pq.questionId}
                        className="text-xs font-medium text-ink-400 underline decoration-dotted hover:text-critical-500 disabled:opacity-50"
                      >
                        {flaggingQuestionId === pq.questionId ? 'Flagging…' : 'Flag this question'}
                      </button>
                    )}
                  </div>
                )}
              </div>
              );
            })}
          </div>
          {flagError && <p className="mt-3 text-xs text-critical-500">{flagError}</p>}
          <Button className="mt-8" onClick={() => router.push('/dashboard')}>
            Go to dashboard
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <div className="flex items-center justify-between text-sm text-ink-400">
        <span>Question {current + 1} of {questions.length}</span>
        {hasTimer && (
          <span className="font-mono text-critical-500">
            {Math.floor(remainingSeconds / 60)}:{String(remainingSeconds % 60).padStart(2, '0')}
          </span>
        )}
      </div>
      <div className="mt-2 h-1 w-full rounded-full bg-ink-100">
        <div className="h-1 rounded-full bg-pulse-500 transition-all" style={{ width: `${progressPercent}%` }} />
      </div>

      <QuestionNavigator
        total={questions.length}
        current={current}
        states={navigatorStates}
        onJump={(i) => setCurrent(i)}
        className="mt-6"
      />

      <Card className="mt-8 p-6">
        <h2 className="font-display text-lg font-medium text-ink-800">{question.prompt}</h2>
        <div className="mt-3">
          <button
            type="button"
            onClick={() => toggleMarkForReview(question.id)}
            className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
              markedForReview.has(question.id)
                ? 'border-flag-400 bg-flag-50 text-flag-600'
                : 'border-ink-100 text-ink-400 hover:bg-ink-50'
            }`}
          >
            {markedForReview.has(question.id) ? 'Marked ✓' : 'Mark for review'}
          </button>
        </div>

        <div className="mt-6 space-y-2">
          {question.type === 'mcq' &&
            question.options?.map((opt) => (
              <button
                key={opt.id}
                onClick={() => setAnswers((prev) => ({ ...prev, [question.id]: opt.id }))}
                className={`w-full rounded-md border px-4 py-3 text-left text-sm transition-colors ${
                  answers[question.id] === opt.id
                    ? 'border-pulse-400 bg-pulse-50 text-pulse-700'
                    : 'border-ink-100 text-ink-700 hover:bg-ink-50'
                }`}
              >
                {opt.text}
              </button>
            ))}

          {question.type === 'true_false' &&
            ['True', 'False'].map((label) => (
              <button
                key={label}
                onClick={() => setAnswers((prev) => ({ ...prev, [question.id]: label }))}
                className={`w-full rounded-md border px-4 py-3 text-left text-sm transition-colors ${
                  answers[question.id] === label
                    ? 'border-pulse-400 bg-pulse-50 text-pulse-700'
                    : 'border-ink-100 text-ink-700 hover:bg-ink-50'
                }`}
              >
                {label}
              </button>
            ))}

          {question.type === 'fill_blank' && (
            <input
              type="text"
              value={answers[question.id] ?? ''}
              onChange={(e) => setAnswers((prev) => ({ ...prev, [question.id]: e.target.value }))}
              placeholder="Type your answer"
              className="w-full rounded-md border border-ink-100 px-4 py-3 text-sm focus:border-pulse-400 focus:outline-none"
            />
          )}
        </div>
      </Card>

      {error && <p className="mt-4 text-sm text-critical-500">{error}</p>}

      <div className="mt-6 flex justify-between">
        <Button
          variant="secondary"
          disabled={current === 0}
          onClick={() => setCurrent((c) => Math.max(0, c - 1))}
        >
          Previous
        </Button>
        {current < questions.length - 1 ? (
          <Button onClick={() => setCurrent((c) => Math.min(questions.length - 1, c + 1))}>
            Next
          </Button>
        ) : (
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Submitting…' : 'Submit'}
          </Button>
        )}
      </div>
    </div>
  );
}

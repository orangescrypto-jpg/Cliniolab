'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { QuestionNavigator } from '@/components/quiz/QuestionNavigator';
import type { Quiz, QuizQuestion } from '@/types';

interface StudyModeRunnerProps {
  quiz: Quiz;
  questions: QuizQuestion[]; // includes correctAnswer, unlike QuizRunner's questions
}

/**
 * Study Mode has no timer, no final score, and nothing is persisted to
 * quiz_attempts - it's pure learning, so it intentionally never touches
 * the leaderboard or dashboard history. Each question reveals the
 * correct answer and explanation immediately after the user answers it.
 */
export function StudyModeRunner({ quiz, questions }: StudyModeRunnerProps) {
  const router = useRouter();
  const [current, setCurrent] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  // Tracks which questions have already been answered in this session, so
  // the navigator grid stays accurate when the user jumps back and forth.
  const [answeredIds, setAnsweredIds] = useState<Set<string>>(new Set());

  const question = questions[current];
  const isLast = current === questions.length - 1;
  const isCorrect = selectedAnswer !== null &&
    selectedAnswer.trim().toLowerCase() === question.correctAnswer.trim().toLowerCase();

  const navigatorStates = useMemo(
    () => questions.map((q) => ({ answered: answeredIds.has(q.id) })),
    [questions, answeredIds]
  );

  function selectAnswer(answer: string) {
    if (revealed) return; // lock in the answer once revealed
    setSelectedAnswer(answer);
    setRevealed(true);
    setAnsweredIds((prev) => new Set(prev).add(question.id));
  }

  function goToQuestion(index: number) {
    setCurrent(index);
    setSelectedAnswer(null);
    setRevealed(false);
  }

  function goNext() {
    if (isLast) {
      router.push(`/quizzes/${quiz.id}`);
      return;
    }
    goToQuestion(current + 1);
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <div className="flex items-center justify-between text-sm text-ink-400">
        <span>Question {current + 1} of {questions.length}</span>
        <span className="font-mono text-xs uppercase tracking-widest text-pulse-600">Study Mode</span>
      </div>
      <div className="mt-2 h-1 w-full rounded-full bg-ink-100">
        <div
          className="h-1 rounded-full bg-pulse-500 transition-all"
          style={{ width: `${((current + 1) / questions.length) * 100}%` }}
        />
      </div>

      <QuestionNavigator
        total={questions.length}
        current={current}
        states={navigatorStates}
        onJump={goToQuestion}
        className="mt-6"
      />

      <Card className="mt-8 p-6">
        <h2 className="font-display text-lg font-medium text-ink-800">{question.prompt}</h2>

        <div className="mt-6 space-y-2">
          {question.type === 'mcq' &&
            question.options?.map((opt) => {
              const isSelected = selectedAnswer === opt.id;
              const isThisCorrect = opt.id === question.correctAnswer;
              let stateClass = 'border-ink-100 text-ink-700 hover:bg-ink-50';
              if (revealed && isThisCorrect) stateClass = 'border-pulse-400 bg-pulse-50 text-pulse-700';
              else if (revealed && isSelected && !isThisCorrect) stateClass = 'border-critical-400 bg-critical-50 text-critical-600';
              return (
                <button
                  key={opt.id}
                  onClick={() => selectAnswer(opt.id)}
                  disabled={revealed}
                  className={`w-full rounded-md border px-4 py-3 text-left text-sm transition-colors disabled:cursor-default ${stateClass}`}
                >
                  {opt.text}
                </button>
              );
            })}

          {question.type === 'true_false' &&
            ['True', 'False'].map((label) => {
              const isSelected = selectedAnswer === label;
              const isThisCorrect = label === question.correctAnswer;
              let stateClass = 'border-ink-100 text-ink-700 hover:bg-ink-50';
              if (revealed && isThisCorrect) stateClass = 'border-pulse-400 bg-pulse-50 text-pulse-700';
              else if (revealed && isSelected && !isThisCorrect) stateClass = 'border-critical-400 bg-critical-50 text-critical-600';
              return (
                <button
                  key={label}
                  onClick={() => selectAnswer(label)}
                  disabled={revealed}
                  className={`w-full rounded-md border px-4 py-3 text-left text-sm transition-colors disabled:cursor-default ${stateClass}`}
                >
                  {label}
                </button>
              );
            })}

          {question.type === 'fill_blank' && !revealed && (
            <FillBlankInput onSubmit={selectAnswer} />
          )}
          {question.type === 'fill_blank' && revealed && (
            <div className={`rounded-md border px-4 py-3 text-sm ${isCorrect ? 'border-pulse-400 bg-pulse-50 text-pulse-700' : 'border-critical-400 bg-critical-50 text-critical-600'}`}>
              Your answer: {selectedAnswer}
            </div>
          )}
        </div>

        {revealed && (
          <div className={`mt-4 rounded-md border p-4 ${isCorrect ? 'border-pulse-200 bg-pulse-50' : 'border-critical-200 bg-critical-50'}`}>
            <p className="text-sm font-medium text-ink-700">
              {isCorrect ? 'Correct!' : `Correct answer: ${question.correctAnswer}`}
            </p>
            {question.explanation && (
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-ink-600">
                {question.explanation}
              </p>
            )}
          </div>
        )}
      </Card>

      <div className="mt-6 flex justify-end">
        <Button onClick={goNext} disabled={!revealed}>
          {isLast ? 'Finish studying' : 'Next question'}
        </Button>
      </div>
    </div>
  );
}

function FillBlankInput({ onSubmit }: { onSubmit: (value: string) => void }) {
  const [value, setValue] = useState('');
  return (
    <div className="flex gap-2">
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Type your answer"
        className="flex-1 rounded-md border border-ink-100 px-4 py-3 text-sm focus:border-pulse-400 focus:outline-none"
      />
      <Button onClick={() => onSubmit(value)} disabled={!value.trim()}>
        Check
      </Button>
    </div>
  );
}

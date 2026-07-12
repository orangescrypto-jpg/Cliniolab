'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import type { QuizWithStats } from '@/types';

export default function AdminQuizzesPage() {
  const [quizzes, setQuizzes] = useState<QuizWithStats[]>([]);

  function load() {
    fetch('/api/admin/quizzes')
      .then((res) => res.json())
      .then((data) => setQuizzes(data.quizzes ?? []));
  }

  useEffect(load, []);

  async function deleteQuiz(id: string) {
    if (!confirm('Delete this quiz permanently? This cannot be undone.')) return;
    const res = await fetch(`/api/quizzes/${id}`, { method: 'DELETE' });
    if (res.ok) load();
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold text-ink-800">All quizzes</h1>
      <div className="mt-6 space-y-3">
        {quizzes.map((quiz) => (
          <Card key={quiz.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div>
              <p className="font-medium text-ink-800">{quiz.title}</p>
              <p className="text-xs text-ink-400">
                {quiz.status} · {quiz.visibility} · {quiz.mode} · {quiz.questionCount} questions ·{' '}
                {quiz.attemptCount} attempts
              </p>
            </div>
            <Button size="sm" variant="danger" onClick={() => deleteQuiz(quiz.id)}>
              Delete
            </Button>
          </Card>
        ))}
        {quizzes.length === 0 && <p className="text-sm text-ink-400">No quizzes yet.</p>}
      </div>
    </div>
  );
}

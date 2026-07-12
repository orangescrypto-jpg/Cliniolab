'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { QuizCard } from '@/components/quiz/QuizCard';
import { Button } from '@/components/ui/Button';
import type { QuizWithStats } from '@/types';

export default function QuizzesPage() {
  const [quizzes, setQuizzes] = useState<QuizWithStats[]>([]);

  useEffect(() => {
    fetch('/api/quizzes')
      .then((res) => res.json())
      .then((data) => setQuizzes(data.quizzes ?? []));
  }, []);

  return (
    <div className="mx-auto max-w-7xl px-6 py-16">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl font-semibold text-ink-800">Latest Quizzes</h1>
        <Link href="/quizzes/new">
          <Button>Create a quiz</Button>
        </Link>
      </div>
      <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {quizzes.map((quiz) => (
          <QuizCard key={quiz.id} quiz={quiz} />
        ))}
        {quizzes.length === 0 && (
          <p className="col-span-full text-sm text-ink-400">No public quizzes yet.</p>
        )}
      </div>
    </div>
  );
}

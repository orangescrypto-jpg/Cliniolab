'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/AuthProvider';
import { Button } from '@/components/ui/Button';
import { QuizForm } from '@/components/quiz/QuizForm';
import type { QuizInput } from '@/types';

export default function NewQuizPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  if (loading) return null;
  if (!user) {
    return (
      <div className="mx-auto max-w-xl px-6 py-24 text-center">
        <h1 className="font-display text-2xl font-semibold text-ink-800">Login required</h1>
        <p className="mt-2 text-ink-500">You need an account to create a quiz.</p>
        <Button className="mt-6" onClick={() => router.push('/login')}>Log in</Button>
      </div>
    );
  }

  async function handleCreate(input: QuizInput) {
    const res = await fetch('/api/quizzes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    const data = await res.json();
    if (!res.ok) return { error: data.error ?? 'Failed to create quiz' };
    router.push(`/quizzes/${data.quiz.id}`);
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="font-display text-3xl font-semibold text-ink-800">Create a quiz</h1>
      <div className="mt-8">
        <QuizForm
          submitLabel="Publish quiz"
          submittingLabel="Publishing…"
          onSubmit={handleCreate}
        />
      </div>
    </div>
  );
}

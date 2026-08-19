'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
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
        <Button className="mt-6" onClick={() => router.push('/login?next=/quizzes/new')}>Log in</Button>
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
      <div className="flex items-start justify-between gap-4">
        <h1 className="font-display text-3xl font-semibold text-ink-800">Create a quiz</h1>
        <Link
          href="/quizzes/bulk-upload"
          className="mt-2 shrink-0 text-sm font-medium text-pulse-600 hover:text-pulse-700"
        >
          Adding many questions? Upload in bulk →
        </Link>
      </div>
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

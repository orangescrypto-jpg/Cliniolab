'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/AuthProvider';
import { Button } from '@/components/ui/Button';
import { FlashcardForm } from '@/components/flashcards/FlashcardForm';
import type { FlashcardInput } from '@/types';

export default function NewFlashcardSetPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  if (loading) return null;
  if (!user) {
    return (
      <div className="mx-auto max-w-xl px-6 py-24 text-center">
        <h1 className="font-display text-2xl font-semibold text-ink-800">Login required</h1>
        <p className="mt-2 text-ink-500">You need an account to create a flashcard set.</p>
        <Button className="mt-6" onClick={() => router.push('/login?next=/flashcards/new')}>Log in</Button>
      </div>
    );
  }

  async function handleCreate(input: FlashcardInput) {
    const res = await fetch('/api/flashcards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    const data = await res.json();
    if (!res.ok) return { error: data.error ?? 'Failed to create flashcard set' };
    router.push(`/flashcards/${data.set.id}`);
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="font-display text-3xl font-semibold text-ink-800">Create a flashcard set</h1>
      <p className="mt-2 text-sm text-ink-500">
        Add a front and back for each card, plus an optional explanation shown after flipping.
      </p>
      <div className="mt-8">
        <FlashcardForm
          submitLabel="Publish flashcard set"
          submittingLabel="Publishing…"
          onSubmit={handleCreate}
        />
      </div>
    </div>
  );
}

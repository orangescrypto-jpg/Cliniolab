'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/AuthProvider';
import { Button } from '@/components/ui/Button';
import { FlashcardForm } from '@/components/flashcards/FlashcardForm';
import type { Flashcard, FlashcardInput, FlashcardSet } from '@/types';

export default function EditFlashcardSetPage() {
  const router = useRouter();
  const params = useParams<{ setId: string }>();
  const { user, loading } = useAuth();

  const [set, setSet] = useState<FlashcardSet | null>(null);
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadingSet, setLoadingSet] = useState(true);

  useEffect(() => {
    if (!params?.setId) return;
    fetch(`/api/flashcards/${params.setId}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          setLoadError(data.error ?? 'Failed to load flashcard set');
          return;
        }
        setSet(data.set);
        setCards(data.cards ?? []);
      })
      .catch(() => setLoadError('Network error while loading flashcard set'))
      .finally(() => setLoadingSet(false));
  }, [params?.setId]);

  if (loading || loadingSet) return null;

  if (!user) {
    return (
      <div className="mx-auto max-w-xl px-6 py-24 text-center">
        <h1 className="font-display text-2xl font-semibold text-ink-800">Login required</h1>
        <p className="mt-2 text-ink-500">You need an account to edit a flashcard set.</p>
        <Button
          className="mt-6"
          onClick={() => router.push(`/login?next=${encodeURIComponent(`/flashcards/${params.setId}/edit`)}`)}
        >
          Log in
        </Button>
      </div>
    );
  }

  if (loadError || !set) {
    return (
      <div className="mx-auto max-w-xl px-6 py-24 text-center">
        <h1 className="font-display text-2xl font-semibold text-ink-800">Can&apos;t edit this set</h1>
        <p className="mt-2 text-ink-500">{loadError ?? 'Flashcard set not found.'}</p>
        <Button className="mt-6" onClick={() => router.push('/dashboard')}>Back to dashboard</Button>
      </div>
    );
  }

  async function handleUpdate(input: FlashcardInput) {
    const res = await fetch(`/api/flashcards/${params.setId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    const data = await res.json();
    if (!res.ok) return { error: data.error ?? 'Failed to update flashcard set' };
    router.push(`/flashcards/${params.setId}`);
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="font-display text-3xl font-semibold text-ink-800">Edit flashcard set</h1>
      <div className="mt-8">
        <FlashcardForm
          initialSet={set}
          initialCards={cards}
          submitLabel="Save changes"
          submittingLabel="Saving…"
          onSubmit={handleUpdate}
        />
      </div>
    </div>
  );
}

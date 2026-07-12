'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth/AuthProvider';
import { Button } from '@/components/ui/Button';
import { QuizCard } from '@/components/quiz/QuizCard';
import { ResourceCard } from '@/components/resources/ResourceCard';
import type { QuizWithStats, Resource } from '@/types';

export default function BookmarksPage() {
  const { user, loading } = useAuth();
  const [quizzes, setQuizzes] = useState<QuizWithStats[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [tab, setTab] = useState<'quizzes' | 'resources'>('quizzes');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!user) return;
    fetch('/api/bookmarks/resolved')
      .then((res) => res.json())
      .then((data) => {
        setQuizzes(data.quizzes ?? []);
        setResources(data.resources ?? []);
      })
      .finally(() => setLoaded(true));
  }, [user]);

  if (loading) return null;
  if (!user) {
    return (
      <div className="mx-auto max-w-xl px-6 py-24 text-center">
        <h1 className="font-display text-2xl font-semibold text-ink-800">Login required</h1>
        <p className="mt-2 text-ink-500">Log in to see quizzes and resources you&apos;ve saved.</p>
        <Button className="mt-6" onClick={() => (window.location.href = '/login')}>Log in</Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-6 py-16">
      <h1 className="font-display text-3xl font-semibold text-ink-800">My bookmarks</h1>
      <p className="mt-2 text-ink-500">Quizzes and resources you&apos;ve saved for later.</p>

      <div className="mt-6 flex gap-2">
        <button
          onClick={() => setTab('quizzes')}
          className={`rounded-md border px-4 py-2 text-sm ${tab === 'quizzes' ? 'border-pulse-400 bg-pulse-50 text-pulse-700' : 'border-ink-100 text-ink-600'}`}
        >
          Quizzes {quizzes.length > 0 && `(${quizzes.length})`}
        </button>
        <button
          onClick={() => setTab('resources')}
          className={`rounded-md border px-4 py-2 text-sm ${tab === 'resources' ? 'border-pulse-400 bg-pulse-50 text-pulse-700' : 'border-ink-100 text-ink-600'}`}
        >
          Resources {resources.length > 0 && `(${resources.length})`}
        </button>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {tab === 'quizzes' &&
          (quizzes.length > 0 ? (
            quizzes.map((quiz) => <QuizCard key={quiz.id} quiz={quiz} />)
          ) : (
            loaded && <p className="col-span-full text-sm text-ink-400">No bookmarked quizzes yet.</p>
          ))}
        {tab === 'resources' &&
          (resources.length > 0 ? (
            resources.map((resource) => <ResourceCard key={resource.id} resource={resource} />)
          ) : (
            loaded && <p className="col-span-full text-sm text-ink-400">No bookmarked resources yet.</p>
          ))}
      </div>
    </div>
  );
}

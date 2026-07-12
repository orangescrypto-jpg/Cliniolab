'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

const PAGES = [
  { id: 'about', label: 'About' },
  { id: 'contact', label: 'Contact' },
  { id: 'faq', label: 'FAQ' },
  { id: 'terms', label: 'Terms' },
  { id: 'privacy', label: 'Privacy' },
  { id: 'disclaimer', label: 'Disclaimer' },
];

export default function AdminPagesPage() {
  const [selected, setSelected] = useState('about');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setSaved(false);
    fetch(`/api/pages/${selected}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        setTitle(data?.page?.title ?? '');
        setContent(data?.page?.content ?? '');
      });
  }, [selected]);

  async function save() {
    const res = await fetch(`/api/pages/${selected}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, content }),
    });
    if (res.ok) setSaved(true);
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold text-ink-800">Site pages</h1>
      <div className="mt-4 flex gap-2">
        {PAGES.map((p) => (
          <button
            key={p.id}
            onClick={() => setSelected(p.id)}
            className={`rounded-md border px-3 py-1.5 text-xs font-medium ${
              selected === p.id ? 'border-pulse-400 bg-pulse-50 text-pulse-700' : 'border-ink-100 text-ink-600'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      <Card className="mt-6 space-y-3 p-5">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Page title"
          className="w-full rounded-md border border-ink-100 px-4 py-2 text-sm focus:border-pulse-400 focus:outline-none"
        />
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Page content"
          rows={10}
          className="w-full rounded-md border border-ink-100 px-4 py-2 text-sm focus:border-pulse-400 focus:outline-none"
        />
        <Button size="sm" onClick={save}>Save page</Button>
        {saved && <span className="ml-3 text-xs text-pulse-600">Saved</span>}
      </Card>
    </div>
  );
}

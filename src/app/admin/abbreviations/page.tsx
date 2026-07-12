'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import type { MedicalAbbreviation } from '@/types';

export default function AdminAbbreviationsPage() {
  const [abbreviations, setAbbreviations] = useState<MedicalAbbreviation[]>([]);
  const [abbreviation, setAbbreviation] = useState('');
  const [meaning, setMeaning] = useState('');
  const [category, setCategory] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function load() {
    fetch('/api/abbreviations')
      .then((res) => res.json())
      .then((data) => setAbbreviations(data.abbreviations ?? []));
  }

  useEffect(load, []);

  function startEdit(a: MedicalAbbreviation) {
    setEditingId(a.id);
    setAbbreviation(a.abbreviation);
    setMeaning(a.meaning);
    setCategory(a.category ?? '');
  }

  function resetForm() {
    setEditingId(null);
    setAbbreviation('');
    setMeaning('');
    setCategory('');
  }

  async function save() {
    if (!abbreviation.trim() || !meaning.trim()) return;
    setError(null);
    const payload = { abbreviation, meaning, category: category || undefined };
    const res = editingId
      ? await fetch(`/api/abbreviations/${editingId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      : await fetch('/api/abbreviations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

    if (res.ok) {
      resetForm();
      load();
    } else {
      const data = await res.json();
      setError(data.error);
    }
  }

  async function remove(id: string) {
    if (!confirm('Delete this abbreviation?')) return;
    const res = await fetch(`/api/abbreviations/${id}`, { method: 'DELETE' });
    if (res.ok) load();
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold text-ink-800">Medical Abbreviations</h1>
      <p className="mt-1 text-sm text-ink-500">
        Entered manually — there&apos;s no automatic import, since a wrong entry in a clinical
        glossary is a real risk. Turn the page and homepage widget on/off from Feature Flags.
      </p>

      <Card className="mt-6 space-y-3 p-5">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <input
            value={abbreviation}
            onChange={(e) => setAbbreviation(e.target.value)}
            placeholder="Abbreviation, e.g. NPO"
            className="rounded-md border border-ink-100 px-3 py-1.5 text-sm focus:border-pulse-400 focus:outline-none"
          />
          <input
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="Category (optional)"
            className="rounded-md border border-ink-100 px-3 py-1.5 text-sm focus:border-pulse-400 focus:outline-none"
          />
          <Button size="sm" onClick={save}>{editingId ? 'Save changes' : 'Add abbreviation'}</Button>
        </div>
        <textarea
          value={meaning}
          onChange={(e) => setMeaning(e.target.value)}
          placeholder="Full meaning, e.g. Nil per os (nothing by mouth)"
          rows={2}
          className="w-full rounded-md border border-ink-100 px-3 py-1.5 text-sm focus:border-pulse-400 focus:outline-none"
        />
        {editingId && (
          <button onClick={resetForm} className="text-xs text-ink-400 hover:text-ink-600">
            Cancel editing
          </button>
        )}
        {error && <p className="text-sm text-critical-500">{error}</p>}
      </Card>

      <div className="mt-6 space-y-2">
        {abbreviations.map((a) => (
          <Card key={a.id} className="flex items-start justify-between gap-4 p-4">
            <div className="flex items-start gap-4">
              <span className="w-20 shrink-0 font-mono text-sm font-semibold text-pulse-600">
                {a.abbreviation}
              </span>
              <div>
                <p className="text-sm text-ink-700">{a.meaning}</p>
                {a.category && <p className="mt-0.5 text-xs text-ink-400">{a.category}</p>}
              </div>
            </div>
            <div className="flex shrink-0 gap-2">
              <button onClick={() => startEdit(a)} className="text-xs font-medium text-pulse-600 hover:text-pulse-700">
                Edit
              </button>
              <button onClick={() => remove(a.id)} className="text-xs font-medium text-critical-500 hover:text-critical-600">
                Delete
              </button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

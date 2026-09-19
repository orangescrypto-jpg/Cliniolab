'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Toggle } from '@/components/ui/Toggle';

interface Settings {
  poolSize: number;
  noRepeatDays: number;
  skipCompletedForPush: boolean;
}
interface Row {
  date: string;
  quizId: string;
  quizTitle: string | null;
}
interface QuizOption {
  id: string;
  title: string;
}
interface AdminData {
  settings: Settings;
  schedule: Row[];
  history: Row[];
  todayDate: string;
  today: { id: string; title: string } | null;
}

const inputClass =
  'mt-1 w-full rounded-md border border-ink-100 px-4 py-2 text-sm focus:border-pulse-400 focus:outline-none';

export default function AdminDailyQuizPage() {
  const [data, setData] = useState<AdminData | null>(null);
  const [quizzes, setQuizzes] = useState<QuizOption[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [date, setDate] = useState('');
  const [quizId, setQuizId] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const res = await fetch('/api/admin/daily-quiz');
    if (!res.ok) return;
    const json: AdminData = await res.json();
    setData(json);
    setSettings(json.settings);
    setDate((d) => d || json.todayDate);
  }

  useEffect(() => {
    load();
    fetch('/api/quizzes?limit=200')
      .then((res) => res.json())
      .then((json) => setQuizzes((json.quizzes ?? []).map((q: QuizOption) => ({ id: q.id, title: q.title }))));
  }, []);

  function flash(msg: string) {
    setMessage(msg);
    setError(null);
    setTimeout(() => setMessage(null), 2500);
  }

  async function saveSettings() {
    if (!settings) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/daily-quiz', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? 'Could not save settings.');
        return;
      }
      setSettings(json.settings);
      flash('Settings saved');
    } catch {
      setError('Network error while saving.');
    } finally {
      setSaving(false);
    }
  }

  async function schedule() {
    if (!date || !quizId) {
      setError('Pick a date and a quiz.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/daily-quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, quizId }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? 'Could not schedule.');
        return;
      }
      setQuizId('');
      flash('Scheduled');
      await load();
    } catch {
      setError('Network error while scheduling.');
    } finally {
      setSaving(false);
    }
  }

  async function unschedule(d: string) {
    const res = await fetch('/api/admin/daily-quiz', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: d }),
    });
    if (res.ok) {
      flash('Removed');
      await load();
    }
  }

  if (!data || !settings) return <p className="text-sm text-ink-400">Loading…</p>;

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold text-ink-800">Daily quiz</h1>
      <p className="mt-2 text-ink-500">
        Controls the homepage &quot;Question of the Day&quot; and the daily push. The day changes at
        midnight Nigeria time (WAT). Turn the whole feature on or off in Feature Flags (
        <span className="font-mono text-xs">daily_quiz</span>).
      </p>

      <Card className="mt-6 p-5">
        <p className="text-xs uppercase tracking-wide text-ink-400">Today ({data.todayDate})</p>
        <p className="mt-1 font-medium text-ink-800">{data.today?.title ?? 'No eligible quiz'}</p>
      </Card>

      <Card className="mt-6 space-y-4 p-5">
        <h2 className="font-display text-lg font-semibold text-ink-800">Schedule a quiz</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-sm font-medium text-ink-700">Date</label>
            <input
              type="date"
              value={date}
              min={data.todayDate}
              onChange={(e) => setDate(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-ink-700">Quiz</label>
            <select value={quizId} onChange={(e) => setQuizId(e.target.value)} className={inputClass}>
              <option value="">Select a public quiz…</option>
              {quizzes.map((q) => (
                <option key={q.id} value={q.id}>
                  {q.title}
                </option>
              ))}
            </select>
          </div>
        </div>
        <Button size="sm" onClick={schedule} disabled={saving}>
          Schedule
        </Button>

        {data.schedule.length > 0 && (
          <div className="space-y-2 pt-2">
            {data.schedule.map((row) => (
              <div
                key={row.date}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-ink-100 px-3 py-2"
              >
                <div>
                  <p className="font-mono text-xs text-ink-400">{row.date}</p>
                  <p className="text-sm text-ink-800">{row.quizTitle ?? 'Quiz no longer available'}</p>
                </div>
                <Button size="sm" variant="secondary" onClick={() => unschedule(row.date)}>
                  Remove
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="mt-6 space-y-4 p-5">
        <h2 className="font-display text-lg font-semibold text-ink-800">Auto-pick settings</h2>
        <p className="text-xs text-ink-400">Used on days with no scheduled quiz.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-sm font-medium text-ink-700">Pool size (latest public quizzes)</label>
            <input
              type="number"
              min={1}
              max={500}
              value={settings.poolSize}
              onChange={(e) => setSettings({ ...settings, poolSize: Number(e.target.value) || 1 })}
              className={inputClass}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-ink-700">Don&apos;t repeat within (days)</label>
            <input
              type="number"
              min={0}
              max={365}
              value={settings.noRepeatDays}
              onChange={(e) => setSettings({ ...settings, noRepeatDays: Number(e.target.value) || 0 })}
              className={inputClass}
            />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Toggle
            checked={settings.skipCompletedForPush}
            onChange={(v) => setSettings({ ...settings, skipCompletedForPush: v })}
          />
          <span className="text-sm text-ink-700">Don&apos;t send the push to users who already took today&apos;s quiz</span>
        </div>
        <Button size="sm" onClick={saveSettings} disabled={saving}>
          {saving ? 'Saving…' : 'Save settings'}
        </Button>
      </Card>

      {data.history.length > 0 && (
        <Card className="mt-6 p-5">
          <h2 className="font-display text-lg font-semibold text-ink-800">Recent daily quizzes</h2>
          <div className="mt-3 space-y-1">
            {data.history.map((row) => (
              <p key={row.date} className="text-sm text-ink-600">
                <span className="mr-3 font-mono text-xs text-ink-400">{row.date}</span>
                {row.quizTitle ?? 'Removed quiz'}
              </p>
            ))}
          </div>
        </Card>
      )}

      {message && <p className="mt-4 text-sm text-pulse-600">{message}</p>}
      {error && <p className="mt-4 text-sm text-critical-500">{error}</p>}
    </div>
  );
}

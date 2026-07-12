'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth/AuthProvider';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

function EyeIcon({ open }: { open: boolean }) {
  if (open) {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    );
  }
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.9 4.24A10.94 10.94 0 0 1 12 4c6.5 0 10 7 10 7a17.4 17.4 0 0 1-3.4 4.6M6.6 6.6C3.5 8.5 2 12 2 12s3.5 7 10 7a10.8 10.8 0 0 0 4.2-.85" />
      <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
      <path d="M1 1l22 22" />
    </svg>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to log in');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-sm px-6 py-24">
      <h1 className="font-display text-2xl font-semibold text-ink-800">Log in</h1>
      <Card className="mt-6 p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-ink-700">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="mt-1 w-full rounded-md border border-ink-100 px-4 py-2 text-sm focus:border-pulse-400 focus:outline-none"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-ink-700">Password</label>
            <div className="relative mt-1">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full rounded-md border border-ink-100 px-4 py-2 pr-11 text-sm focus:border-pulse-400 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute inset-y-0 right-0 flex items-center px-3 text-ink-400 hover:text-ink-600"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                <EyeIcon open={showPassword} />
              </button>
            </div>
          </div>
          {error && <p className="text-sm text-critical-500">{error}</p>}
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? 'Logging in…' : 'Log in'}
          </Button>
        </form>
      </Card>
      <p className="mt-4 text-sm text-ink-500">
        No account? <Link href="/register" className="font-medium text-pulse-600">Sign up</Link>
      </p>
    </div>
  );
}

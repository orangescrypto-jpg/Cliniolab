'use client';

import { getSupabaseBrowserClient } from '@/lib/auth/supabaseClient';

export interface SessionUser {
  id: string;
  email: string;
  displayName: string | null;
}

export async function signUp(
  email: string,
  password: string,
  displayName: string
): Promise<SessionUser> {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { display_name: displayName } },
  });
  if (error) throw new Error(error.message);
  if (!data.user) throw new Error('Sign up did not return a user.');

  // Ensure the corresponding D1 users row exists via the API route, since
  // the browser has no direct D1 access.
  await fetch('/api/auth/sync-user', { method: 'POST' });

  return { id: data.user.id, email: data.user.email ?? email, displayName };
}

export async function signIn(email: string, password: string): Promise<SessionUser> {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);
  if (!data.user) throw new Error('Sign in did not return a user.');

  await fetch('/api/auth/sync-user', { method: 'POST' });

  return {
    id: data.user.id,
    email: data.user.email ?? email,
    displayName: (data.user.user_metadata?.display_name as string) ?? null,
  };
}

export async function signOut(): Promise<void> {
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.auth.signOut();
  if (error) throw new Error(error.message);
}

export async function getCurrentSessionUser(): Promise<SessionUser | null> {
  const supabase = getSupabaseBrowserClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;
  return {
    id: data.user.id,
    email: data.user.email ?? '',
    displayName: (data.user.user_metadata?.display_name as string) ?? null,
  };
}

import { getSupabaseServerClient } from '@/lib/auth/supabaseServerClient';
import { userService } from '@/lib/db';
import { sendWelcomeEmail } from '@/lib/email/emailService';
import type { AppUser } from '@/types';

/**
 * Resolves the current request's authenticated user by combining the
 * Supabase session (identity) with the D1 users table (role + app data).
 * Every API route that needs auth should call this instead of touching
 * Supabase or D1 directly.
 */
export async function getCurrentUser(): Promise<AppUser | null> {
  const supabase = await getSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;

  const appUser = await userService.getUserById(data.user.id);
  if (appUser) return appUser;

  // First request after sign-up; the D1 row doesn't exist yet, so this is
  // the one moment we know for certain it's a brand-new account.
  const newUser = await userService.ensureUserRecord(
    data.user.id,
    data.user.email ?? '',
    (data.user.user_metadata?.display_name as string) ?? undefined
  );
  // Fire-and-forget: an email hiccup shouldn't block the request that
  // triggered account creation.
  sendWelcomeEmail(newUser).catch(() => {});
  return newUser;
}

export async function requireUser(): Promise<AppUser> {
  const user = await getCurrentUser();
  if (!user) throw new Error('UNAUTHENTICATED');
  return user;
}

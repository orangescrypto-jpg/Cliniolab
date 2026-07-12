'use client';

import { createBrowserClient } from '@supabase/ssr';

/**
 * This is the ONLY file allowed to construct a Supabase client for browser
 * use. Everything else in the app should go through the hooks/functions in
 * lib/auth/* instead of calling createBrowserClient directly, so the auth
 * provider stays swappable later if needed (mirrors the D1 abstraction).
 */
let browserClient: ReturnType<typeof createBrowserClient> | null = null;

export function getSupabaseBrowserClient() {
  if (!browserClient) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anonKey) {
      throw new Error(
        'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables.'
      );
    }
    browserClient = createBrowserClient(url, anonKey);
  }
  return browserClient;
}

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * Server-side Supabase client, for use in Server Components, Route Handlers,
 * and Server Actions. This is the ONLY file allowed to construct a
 * server-context Supabase client.
 */
export async function getSupabaseServerClient() {
  const cookieStore = await cookies();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables.'
    );
  }

  // Typed inline rather than importing a cookie-methods type from
  // @supabase/ssr directly, since that type's export name has changed
  // across package versions (get/set/remove vs getAll/setAll). This shape
  // matches the getAll/setAll contract used by @supabase/ssr >=0.5.
  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component where cookies can't be set;
          // safe to ignore since middleware refreshes the session instead.
        }
      },
    },
  });
}

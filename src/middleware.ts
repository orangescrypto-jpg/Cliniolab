import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import type { CookieOptions } from '@supabase/ssr';
import { getCloudflareContext } from '@opennextjs/cloudflare';

/**
 * Refreshes the Supabase auth session cookie on every request. Required by
 * @supabase/ssr so server components see a valid, non-expired session
 * without each page having to handle refresh logic itself.
 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  // NEXT_PUBLIC_* vars set via the Cloudflare dashboard land in
  // getCloudflareContext().env at runtime, not in process.env the way
  // Node-hosted platforms (Vercel) expose them — so check both, preferring
  // whichever is actually populated.
  let cfEnv: Record<string, unknown> = {};
  try {
    cfEnv = getCloudflareContext().env as Record<string, unknown>;
  } catch {
    // Not running in a Workers/OpenNext context (e.g. Vercel) — process.env
    // alone is authoritative there.
  }

  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? (cfEnv.NEXT_PUBLIC_SUPABASE_URL as string | undefined);
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    (cfEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY as string | undefined);
  if (!url || !anonKey) return response;

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};

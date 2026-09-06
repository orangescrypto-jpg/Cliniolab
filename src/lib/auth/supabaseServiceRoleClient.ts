import { createClient } from '@supabase/supabase-js';
import { getCloudflareContext } from '@opennextjs/cloudflare';

/**
 * Service-role Supabase client, for privileged server-only operations that
 * the anon-key client (see supabaseServerClient.ts) cannot perform - most
 * notably deleting a user's Supabase Auth account entirely
 * (supabase.auth.admin.deleteUser). This client bypasses Row Level
 * Security, so it must NEVER be imported into anything that runs in the
 * browser, and the service role key must never be sent to the client.
 *
 * Only call this from trusted admin-only API routes that have already
 * checked permissions.canManageUsers() (or an equivalent admin check).
 */
export async function getSupabaseServiceRoleClient() {
  let cfEnv: Record<string, unknown> = {};
  try {
    cfEnv = getCloudflareContext().env as Record<string, unknown>;
  } catch {
    // Not running in a Workers/OpenNext context (e.g. Vercel) — process.env
    // alone is authoritative there.
  }

  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? (cfEnv.NEXT_PUBLIC_SUPABASE_URL as string | undefined);
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? (cfEnv.SUPABASE_SERVICE_ROLE_KEY as string | undefined);

  if (!url || !serviceRoleKey) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables. ' +
        'The service role key is found in Supabase dashboard > Project Settings > API > service_role secret. ' +
        'Add it as SUPABASE_SERVICE_ROLE_KEY in Vercel (or wrangler secret put for Cloudflare) - never as a NEXT_PUBLIC_ var.'
    );
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

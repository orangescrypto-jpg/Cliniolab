import { getDb, nowIso } from '@/lib/db/client';

const SETTINGS_KEY = 'cron_secret';

interface SettingRow {
  key: string;
  value: string;
  updated_at: string;
}

/**
 * Reads the shared secret cron endpoints check against. Admin-set value
 * in site_settings takes priority; CRON_SECRET env var is the fallback
 * for a fresh deploy before anyone visits the admin panel. Lets you
 * rotate the secret (e.g. whenever you set up a new cron-job.org job)
 * without a redeploy.
 */
export async function getCronSecret(): Promise<string> {
  const db = getDb();
  const row = await db.prepare('SELECT * FROM site_settings WHERE key = ?').bind(SETTINGS_KEY).first<SettingRow>();
  if (row) {
    try {
      const parsed = JSON.parse(row.value);
      if (typeof parsed === 'string' && parsed) return parsed;
    } catch {
      // fall through to env fallback
    }
  }
  return process.env.CRON_SECRET || '';
}

export async function setCronSecret(secret: string): Promise<void> {
  const db = getDb();
  await db
    .prepare(
      `INSERT INTO site_settings (key, value, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
    )
    .bind(SETTINGS_KEY, JSON.stringify(secret), nowIso())
    .run();
}

export async function isValidCronSecret(provided: string): Promise<boolean> {
  const current = await getCronSecret();
  return Boolean(current) && provided === current;
}

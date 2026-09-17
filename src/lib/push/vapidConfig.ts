import { getDb, nowIso } from '@/lib/db/client';
import type { VapidKeys } from './webPush';

const SETTINGS_KEY = 'push_vapid';

interface SettingRow {
  key: string;
  value: string;
  updated_at: string;
}

export interface VapidSetting {
  publicKey: string;
  privateKey: string;
  subject: string; // mailto: or https: contact URL required by the push spec
}

const EMPTY_VAPID: VapidSetting = { publicKey: '', privateKey: '', subject: 'mailto:support@cliniolab.com' };

/**
 * Reads admin-configured VAPID keys from site_settings. Falls back to
 * VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT env vars when the
 * admin hasn't set (or has cleared) keys in the dashboard, so a fresh
 * deploy with env vars set works before anyone touches the admin panel.
 */
export async function getVapidSetting(): Promise<VapidSetting> {
  const db = getDb();
  const row = await db.prepare('SELECT * FROM site_settings WHERE key = ?').bind(SETTINGS_KEY).first<SettingRow>();

  let stored: Partial<VapidSetting> = {};
  if (row) {
    try {
      stored = JSON.parse(row.value);
    } catch {
      stored = {};
    }
  }

  const publicKey = stored.publicKey || process.env.VAPID_PUBLIC_KEY || '';
  const privateKey = stored.privateKey || process.env.VAPID_PRIVATE_KEY || '';
  const subject = stored.subject || process.env.VAPID_SUBJECT || EMPTY_VAPID.subject;

  return { publicKey, privateKey, subject };
}

/** The client-facing public key only, for the subscribe flow — never exposes the private key. */
export async function getVapidPublicKey(): Promise<string> {
  const { publicKey } = await getVapidSetting();
  return publicKey;
}

export async function setVapidSetting(setting: VapidSetting): Promise<void> {
  const db = getDb();
  await db
    .prepare(
      `INSERT INTO site_settings (key, value, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
    )
    .bind(SETTINGS_KEY, JSON.stringify(setting), nowIso())
    .run();
}

/** True once a public+private pair is available from either source. */
export async function isVapidConfigured(): Promise<boolean> {
  const { publicKey, privateKey } = await getVapidSetting();
  return Boolean(publicKey && privateKey);
}

export async function getVapidKeysForSigning(): Promise<VapidKeys | null> {
  const { publicKey, privateKey } = await getVapidSetting();
  if (!publicKey || !privateKey) return null;
  return { publicKey, privateKey };
}

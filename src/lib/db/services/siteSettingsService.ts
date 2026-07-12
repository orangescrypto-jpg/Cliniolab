import { getDb, nowIso } from '@/lib/db/client';
import type { HomepageVideoSetting, CookieConsentSetting, RelatedQuizzesSetting, ResourcePaymentMode } from '@/types';

const DEFAULT_RELATED_QUIZZES: RelatedQuizzesSetting = { enabled: true, count: 6 };

const DEFAULT_COOKIE_CONSENT: CookieConsentSetting = {
  enabled: true,
  message:
    'We use cookies to keep you signed in and to understand how people use Cliniolab. You can accept all cookies or decline optional ones.',
  policyLinkText: 'Learn more in our Privacy Policy',
  policyUrl: '/privacy',
  acceptButtonText: 'Accept',
  declineButtonText: 'Decline',
};

interface SettingRow {
  key: string;
  value: string;
  updated_at: string;
}

export async function getHomepageVideo(): Promise<HomepageVideoSetting> {
  const db = getDb();
  const row = await db
    .prepare('SELECT * FROM site_settings WHERE key = ?')
    .bind('homepage_video')
    .first<SettingRow>();
  if (!row) return { youtubeUrl: '', title: 'Our Latest Video', description: '' };
  return JSON.parse(row.value) as HomepageVideoSetting;
}

export async function setHomepageVideo(setting: HomepageVideoSetting): Promise<void> {
  const db = getDb();
  await db
    .prepare(
      `INSERT INTO site_settings (key, value, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
    )
    .bind('homepage_video', JSON.stringify(setting), nowIso())
    .run();
}

/**
 * Extracts a YouTube video ID from common URL formats
 * (watch?v=, youtu.be/, embed/) so the frontend can build an embed URL.
 * Returns null if the string isn't a recognizable YouTube URL.
 */
export function extractYoutubeId(url: string): string | null {
  if (!url) return null;
  const patterns = [
    /(?:youtube\.com\/watch\?v=)([\w-]{11})/,
    /(?:youtu\.be\/)([\w-]{11})/,
    /(?:youtube\.com\/embed\/)([\w-]{11})/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

export async function getCookieConsentSetting(): Promise<CookieConsentSetting> {
  const db = getDb();
  const row = await db
    .prepare('SELECT * FROM site_settings WHERE key = ?')
    .bind('cookie_consent')
    .first<SettingRow>();
  if (!row) return DEFAULT_COOKIE_CONSENT;
  try {
    return { ...DEFAULT_COOKIE_CONSENT, ...JSON.parse(row.value) } as CookieConsentSetting;
  } catch {
    return DEFAULT_COOKIE_CONSENT;
  }
}

export async function setCookieConsentSetting(setting: CookieConsentSetting): Promise<void> {
  const db = getDb();
  await db
    .prepare(
      `INSERT INTO site_settings (key, value, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
    )
    .bind('cookie_consent', JSON.stringify(setting), nowIso())
    .run();
}

function clampRelatedCount(count: number): number {
  if (!Number.isFinite(count)) return DEFAULT_RELATED_QUIZZES.count;
  return Math.min(12, Math.max(1, Math.round(count)));
}

async function getRelatedQuizzesSetting(key: string): Promise<RelatedQuizzesSetting> {
  const db = getDb();
  const row = await db.prepare('SELECT * FROM site_settings WHERE key = ?').bind(key).first<SettingRow>();
  if (!row) return DEFAULT_RELATED_QUIZZES;
  try {
    const parsed = JSON.parse(row.value) as Partial<RelatedQuizzesSetting>;
    return {
      enabled: parsed.enabled ?? DEFAULT_RELATED_QUIZZES.enabled,
      count: clampRelatedCount(parsed.count ?? DEFAULT_RELATED_QUIZZES.count),
    };
  } catch {
    return DEFAULT_RELATED_QUIZZES;
  }
}

async function setRelatedQuizzesSetting(key: string, setting: RelatedQuizzesSetting): Promise<void> {
  const db = getDb();
  await db
    .prepare(
      `INSERT INTO site_settings (key, value, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
    )
    .bind(key, JSON.stringify({ enabled: setting.enabled, count: clampRelatedCount(setting.count) }), nowIso())
    .run();
}

/** Related-quizzes widget shown on the quiz detail page. */
export async function getRelatedQuizzesQuizPageSetting(): Promise<RelatedQuizzesSetting> {
  return getRelatedQuizzesSetting('related_quizzes_quiz_page');
}

export async function setRelatedQuizzesQuizPageSetting(setting: RelatedQuizzesSetting): Promise<void> {
  return setRelatedQuizzesSetting('related_quizzes_quiz_page', setting);
}

/** Related-quizzes widget shown on blog posts. */
export async function getRelatedQuizzesBlogPageSetting(): Promise<RelatedQuizzesSetting> {
  return getRelatedQuizzesSetting('related_quizzes_blog_page');
}

export async function setRelatedQuizzesBlogPageSetting(setting: RelatedQuizzesSetting): Promise<void> {
  return setRelatedQuizzesSetting('related_quizzes_blog_page', setting);
}

export async function getPlatformFeePercent(): Promise<number> {
  const db = getDb();
  const row = await db
    .prepare('SELECT * FROM site_settings WHERE key = ?')
    .bind('platform_fee_percent')
    .first<{ key: string; value: string; updated_at: string }>();
  if (!row) return 15; // sensible default if never set
  const parsed = Number(row.value);
  return Number.isFinite(parsed) ? parsed : 15;
}

export async function setPlatformFeePercent(percent: number): Promise<void> {
  const db = getDb();
  await db
    .prepare(
      `INSERT INTO site_settings (key, value, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
    )
    .bind('platform_fee_percent', String(percent), nowIso())
    .run();
}

/**
 * Site-wide switch controlling how ALL resource purchases are collected:
 * 'manual' (buyer transfers outside the app, uploads proof, admin
 * confirms) or 'flutterwave' (real checkout, auto-unlocks on payment).
 * This is a single platform-level setting, not per-resource — admin sets
 * it once and it governs every paid resource purchase going forward.
 */
export async function getResourcePaymentMode(): Promise<ResourcePaymentMode> {
  const db = getDb();
  const row = await db
    .prepare('SELECT * FROM site_settings WHERE key = ?')
    .bind('resource_payment_mode')
    .first<SettingRow>();
  if (!row) return 'manual';
  try {
    const parsed = JSON.parse(row.value);
    return parsed === 'flutterwave' ? 'flutterwave' : 'manual';
  } catch {
    return 'manual';
  }
}

export async function setResourcePaymentMode(mode: ResourcePaymentMode): Promise<void> {
  const db = getDb();
  await db
    .prepare(
      `INSERT INTO site_settings (key, value, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
    )
    .bind('resource_payment_mode', JSON.stringify(mode), nowIso())
    .run();
}

import { getDb, nowIso } from '@/lib/db/client';
import type { Banner, BannerPlacement, BannerDisplayMode, BannerStats } from '@/types';

interface BannerRow {
  id: string;
  placement: string;
  display_mode: string;
  title: string;
  image_path: string;
  link_url: string | null;
  is_active: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

function mapBanner(row: BannerRow): Banner {
  return {
    id: row.id,
    placement: row.placement as BannerPlacement,
    displayMode: (row.display_mode as BannerDisplayMode) ?? 'static',
    title: row.title,
    imagePath: row.image_path,
    linkUrl: row.link_url,
    isActive: row.is_active === 1,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Active banners for a placement, in admin-set order. Used by the public
 *  site (homepage header strip / footer banner). */
export async function listActiveBanners(placement: BannerPlacement): Promise<Banner[]> {
  const db = getDb();
  const { results } = await db
    .prepare(
      `SELECT * FROM banners WHERE placement = ? AND is_active = 1
       ORDER BY sort_order ASC, created_at DESC`
    )
    .bind(placement)
    .all<BannerRow>();
  return results.map(mapBanner);
}

/** All banners for a placement (active + inactive), for the admin list view. */
export async function listAllBanners(placement?: BannerPlacement): Promise<Banner[]> {
  const db = getDb();
  if (placement) {
    const { results } = await db
      .prepare('SELECT * FROM banners WHERE placement = ? ORDER BY sort_order ASC, created_at DESC')
      .bind(placement)
      .all<BannerRow>();
    return results.map(mapBanner);
  }
  const { results } = await db
    .prepare('SELECT * FROM banners ORDER BY placement ASC, sort_order ASC, created_at DESC')
    .all<BannerRow>();
  return results.map(mapBanner);
}

export async function getBannerById(id: string): Promise<Banner | null> {
  const db = getDb();
  const row = await db.prepare('SELECT * FROM banners WHERE id = ?').bind(id).first<BannerRow>();
  return row ? mapBanner(row) : null;
}

export async function createBanner(input: {
  placement: BannerPlacement;
  displayMode?: BannerDisplayMode;
  title: string;
  imagePath: string;
  linkUrl?: string | null;
  isActive?: boolean;
  sortOrder?: number;
}): Promise<Banner> {
  const db = getDb();
  const id = crypto.randomUUID();
  const now = nowIso();
  await db
    .prepare(
      `INSERT INTO banners (id, placement, display_mode, title, image_path, link_url, is_active, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      id,
      input.placement,
      input.displayMode ?? 'static',
      input.title,
      input.imagePath,
      input.linkUrl ?? null,
      input.isActive === false ? 0 : 1,
      input.sortOrder ?? 0,
      now,
      now
    )
    .run();
  const banner = await getBannerById(id);
  if (!banner) throw new Error('Failed to create banner');
  return banner;
}

export async function updateBanner(
  id: string,
  input: Partial<{
    title: string;
    imagePath: string;
    linkUrl: string | null;
    isActive: boolean;
    sortOrder: number;
    placement: BannerPlacement;
    displayMode: BannerDisplayMode;
  }>
): Promise<Banner | null> {
  const db = getDb();
  const existing = await getBannerById(id);
  if (!existing) return null;

  await db
    .prepare(
      `UPDATE banners
       SET title = ?, image_path = ?, link_url = ?, is_active = ?, sort_order = ?, placement = ?, display_mode = ?, updated_at = ?
       WHERE id = ?`
    )
    .bind(
      input.title ?? existing.title,
      input.imagePath ?? existing.imagePath,
      input.linkUrl !== undefined ? input.linkUrl : existing.linkUrl,
      input.isActive !== undefined ? (input.isActive ? 1 : 0) : existing.isActive ? 1 : 0,
      input.sortOrder !== undefined ? input.sortOrder : existing.sortOrder,
      input.placement ?? existing.placement,
      input.displayMode ?? existing.displayMode,
      nowIso(),
      id
    )
    .run();

  return getBannerById(id);
}

export async function deleteBanner(id: string): Promise<void> {
  const db = getDb();
  // banner_stats references banners by id with no cascade in D1/SQLite,
  // so its rows for this banner would otherwise be orphaned forever once
  // the banner itself is gone (and would block the DELETE via the FK).
  await db.prepare('DELETE FROM banner_stats WHERE banner_id = ?').bind(id).run();
  // Legacy per-event log. Tolerate the table already being dropped after
  // the migration's cleanup step.
  await db.prepare('DELETE FROM banner_events WHERE banner_id = ?').bind(id).run().catch(() => {});
  await db.prepare('DELETE FROM banners WHERE id = ?').bind(id).run();
}

/**
 * Whether any OTHER banner still points at the same image_path. Two
 * banners can end up sharing one uploaded file (e.g. the same graphic
 * used for both the header and footer placement), so deleting one
 * banner's R2 object is only safe once nothing else still references it.
 */
export async function isImagePathUsedByOtherBanner(imagePath: string, excludingBannerId: string): Promise<boolean> {
  const db = getDb();
  const row = await db
    .prepare('SELECT id FROM banners WHERE image_path = ? AND id != ? LIMIT 1')
    .bind(imagePath, excludingBannerId)
    .first<{ id: string }>();
  return !!row;
}

/**
 * Records a single impression or click for a banner by bumping today's
 * counter row in banner_stats (one row per banner per day) rather than
 * inserting a new row per event. This keeps the table tiny no matter how
 * much traffic the banner gets, while still supporting totals, CTR, and
 * date-range sponsor reports. Called via a lightweight fire-and-forget
 * beacon from the public BannerSlot component - failures here should never
 * block the user from seeing/using the site.
 */
export async function recordBannerEvent(bannerId: string, eventType: 'impression' | 'click'): Promise<void> {
  const db = getDb();
  const day = nowIso().slice(0, 10); // YYYY-MM-DD, UTC
  const impressions = eventType === 'impression' ? 1 : 0;
  const clicks = eventType === 'click' ? 1 : 0;
  await db
    .prepare(
      `INSERT INTO banner_stats (banner_id, day, impressions, clicks) VALUES (?, ?, ?, ?)
       ON CONFLICT(banner_id, day) DO UPDATE SET
         impressions = impressions + excluded.impressions,
         clicks = clicks + excluded.clicks`
    )
    .bind(bannerId, day, impressions, clicks)
    .run();
}

/**
 * Impression/click counts and CTR for every banner, for the admin list
 * view - this is the number you'd actually show a sponsor to justify
 * (or set) a rate.
 */
export async function getStatsForAllBanners(): Promise<Record<string, BannerStats>> {
  const db = getDb();
  const { results } = await db
    .prepare(
      `SELECT
        banner_id,
        COALESCE(SUM(impressions), 0) as impression_count,
        COALESCE(SUM(clicks), 0) as click_count
      FROM banner_stats
      GROUP BY banner_id`
    )
    .all<{ banner_id: string; impression_count: number; click_count: number }>();

  const stats: Record<string, BannerStats> = {};
  for (const row of results) {
    stats[row.banner_id] = {
      bannerId: row.banner_id,
      impressionCount: row.impression_count,
      clickCount: row.click_count,
      ctrPercent: row.impression_count > 0 ? (row.click_count / row.impression_count) * 100 : null,
    };
  }
  return stats;
}

/** Stats for a single banner, used on a per-banner detail view if needed. */
export async function getStatsForBanner(bannerId: string): Promise<BannerStats> {
  const db = getDb();
  const row = await db
    .prepare(
      `SELECT
        SUM(impressions) as impression_count,
        SUM(clicks) as click_count
      FROM banner_stats
      WHERE banner_id = ?`
    )
    .bind(bannerId)
    .first<{ impression_count: number | null; click_count: number | null }>();

  const impressionCount = row?.impression_count ?? 0;
  const clickCount = row?.click_count ?? 0;
  return {
    bannerId,
    impressionCount,
    clickCount,
    ctrPercent: impressionCount > 0 ? (clickCount / impressionCount) * 100 : null,
  };
}

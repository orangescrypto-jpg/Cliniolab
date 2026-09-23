import { mediaReferenceService } from '@/lib/db';
import { deleteObjectsByKey, extractImageKeys, listAllObjects } from '@/lib/storage/r2Client';

/**
 * Objects uploaded within this window are never swept. An admin may have
 * uploaded a cover in the editor but not clicked Save yet, so no row
 * references it - deleting it now would break the post they are about to
 * publish.
 */
const GRACE_PERIOD_MS = 24 * 60 * 60 * 1000;

/**
 * Refuse to delete when the sweep would remove more than this share of the
 * bucket in one go. That pattern almost always means the reference scan
 * missed a column (a bug), not that most of the bucket is genuinely orphaned,
 * and deleting on a bad scan is unrecoverable.
 */
const MAX_DELETE_FRACTION = 0.5;
const MIN_OBJECTS_FOR_FRACTION_CHECK = 20;

export interface OrphanSweepResult {
  dryRun: boolean;
  scanned: number;
  referenced: number;
  orphaned: number;
  orphanedBytes: number;
  deleted: number;
  skippedTooRecent: number;
  aborted: string | null;
  sampleOrphans: string[];
}

/**
 * Compares every object in the bucket against every image key referenced by
 * the database, and deletes the unreferenced ones (unless dryRun).
 */
export async function runOrphanSweep(options: { dryRun: boolean }): Promise<OrphanSweepResult> {
  const objects = await listAllObjects();
  const referencedText = await mediaReferenceService.getAllReferencedImageText();

  const referencedKeys = new Set<string>();
  for (const text of referencedText) {
    for (const key of extractImageKeys(text)) referencedKeys.add(key);
  }

  const now = Date.now();
  let skippedTooRecent = 0;
  const orphans = objects.filter((obj) => {
    if (referencedKeys.has(obj.key)) return false;
    if (now - obj.uploaded.getTime() < GRACE_PERIOD_MS) {
      skippedTooRecent++;
      return false;
    }
    return true;
  });

  const result: OrphanSweepResult = {
    dryRun: options.dryRun,
    scanned: objects.length,
    referenced: objects.length - orphans.length - skippedTooRecent,
    orphaned: orphans.length,
    orphanedBytes: orphans.reduce((sum, o) => sum + o.size, 0),
    deleted: 0,
    skippedTooRecent,
    aborted: null,
    sampleOrphans: orphans.slice(0, 10).map((o) => o.key),
  };

  if (options.dryRun || orphans.length === 0) return result;

  if (
    objects.length >= MIN_OBJECTS_FOR_FRACTION_CHECK &&
    orphans.length / objects.length > MAX_DELETE_FRACTION
  ) {
    result.aborted =
      `Refused to delete ${orphans.length} of ${objects.length} objects (over ` +
      `${MAX_DELETE_FRACTION * 100}%). This usually means the reference scan is ` +
      `missing a column. Run a preview and check before deleting.`;
    return result;
  }

  result.deleted = await deleteObjectsByKey(orphans.map((o) => o.key));
  return result;
}

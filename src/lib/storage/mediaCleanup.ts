import { mediaReferenceService } from '@/lib/db';
import { deleteImageKeysIfUnreferenced, extractImageKeys } from '@/lib/storage/r2Client';

/**
 * Call AFTER a row has been deleted from the database. Collects every
 * /api/images/... key mentioned in the given text fields (a cover URL, a
 * blog body, etc.) and removes from R2 the ones no other row references.
 *
 * Deliberately never throws: the content deletion has already succeeded,
 * and a storage hiccup here must not turn that into an error response.
 * Anything missed is caught by the weekly orphan sweep.
 */
export async function cleanupImagesAfterDelete(
  fieldsThatMayReferenceImages: (string | null | undefined)[],
  deletedRow: { table: string; id: string }
): Promise<void> {
  try {
    const keys = [...new Set(fieldsThatMayReferenceImages.flatMap((f) => extractImageKeys(f)))];
    if (keys.length === 0) return;
    await deleteImageKeysIfUnreferenced(keys, (key) =>
      // The row is already gone, so `excluding` is belt-and-braces for
      // callers that ever run this before the delete.
      mediaReferenceService.isImageKeyReferenced(key, deletedRow)
    );
  } catch (err) {
    console.error('Image cleanup after delete failed (non-fatal):', err);
  }
}

/**
 * Storage bucket wrapper, mirroring the D1 client pattern: this is the
 * only file allowed to touch storage bindings directly. Everything else
 * goes through uploadImage()/deleteImage() below.
 *
 * Two backends behind the same R2Bucket interface:
 *  - Cloudflare R2 (production, via the Workers/Pages binding)
 *  - Supabase Storage (Vercel preview/testing)
 *
 * Selected the same way as the DB driver: STORAGE_DRIVER env var, or
 * inferred from DATABASE_URL/SUPABASE_URL presence when unset.
 */
export interface R2Bucket {
  put(key: string, value: ArrayBuffer | ArrayBufferView | ReadableStream, options?: { httpMetadata?: { contentType?: string } }): Promise<unknown>;
  delete(key: string): Promise<void>;
  get(key: string): Promise<{ body: ReadableStream; httpMetadata?: { contentType?: string } } | null>;
}

type StorageDriver = 'r2' | 'supabase';

function resolveStorageDriver(): StorageDriver {
  const explicit = process.env.STORAGE_DRIVER as StorageDriver | undefined;
  if (explicit === 'r2' || explicit === 'supabase') return explicit;
  return process.env.SUPABASE_URL ? 'supabase' : 'r2';
}

function getR2Bucket(): R2Bucket {
  // Lazy require, not a top-level import, so @cloudflare/next-on-pages is
  // never pulled into the Vercel/Supabase build path.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { getRequestContext } = require('@cloudflare/next-on-pages') as typeof import('@cloudflare/next-on-pages');
  const env = getRequestContext().env as { IMAGES?: R2Bucket };
  if (!env.IMAGES) {
    throw new Error("R2 binding 'IMAGES' is not configured. Add an [[r2_buckets]] binding named IMAGES in wrangler.toml.");
  }
  return env.IMAGES;
}

let supabaseBucketSingleton: R2Bucket | undefined;

function getSupabaseBucket(): R2Bucket {
  if (!supabaseBucketSingleton) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { createSupabaseR2Adapter } = require('@/lib/storage/supabaseStorageAdapter') as typeof import('@/lib/storage/supabaseStorageAdapter');
    supabaseBucketSingleton = createSupabaseR2Adapter();
  }
  return supabaseBucketSingleton;
}

function getBucket(): R2Bucket {
  return resolveStorageDriver() === 'supabase' ? getSupabaseBucket() : getR2Bucket();
}

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_BYTES = 5 * 1024 * 1024; // 5MB

export class ImageUploadError extends Error {}

/**
 * Uploads an image file to R2 and returns a public-servable path
 * (served back out via /api/images/[key], not a direct R2 URL, so we
 * control caching/headers centrally).
 */
export async function uploadImage(
  file: File,
  keyPrefix: 'blog' | 'resources' | 'banners' | 'scholars'
): Promise<string> {
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new ImageUploadError('Only JPEG, PNG, WEBP, or GIF images are allowed.');
  }
  if (file.size > MAX_BYTES) {
    throw new ImageUploadError('Image must be smaller than 5MB.');
  }

  const bucket = getBucket();
  const ext = file.type.split('/')[1];
  const key = `${keyPrefix}/${crypto.randomUUID()}.${ext}`;
  const buffer = await file.arrayBuffer();

  await bucket.put(key, buffer, { httpMetadata: { contentType: file.type } });

  return `/api/images/${key}`;
}

export async function deleteImageByPath(imagePath: string): Promise<void> {
  // imagePath looks like /api/images/blog/uuid.png - strip the API prefix
  // to get back the raw R2 key.
  const key = imagePath.replace(/^\/api\/images\//, '');
  if (!key) return;
  const bucket = getBucket();
  await bucket.delete(key);
}

export async function getImageObject(key: string) {
  const bucket = getBucket();
  return bucket.get(key);
}

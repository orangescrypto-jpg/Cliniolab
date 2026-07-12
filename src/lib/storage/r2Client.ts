import { getRequestContext } from '@cloudflare/next-on-pages';

/**
 * R2 bucket wrapper, mirroring the D1 client pattern: this is the only
 * file allowed to touch the R2 binding directly. Everything else goes
 * through uploadImage()/deleteImage() below.
 */
export interface R2Bucket {
  put(key: string, value: ArrayBuffer | ArrayBufferView | ReadableStream, options?: { httpMetadata?: { contentType?: string } }): Promise<unknown>;
  delete(key: string): Promise<void>;
  get(key: string): Promise<{ body: ReadableStream; httpMetadata?: { contentType?: string } } | null>;
}

function getBucket(): R2Bucket {
  const env = getRequestContext().env as { IMAGES?: R2Bucket };
  if (!env.IMAGES) {
    throw new Error("R2 binding 'IMAGES' is not configured. Add an [[r2_buckets]] binding named IMAGES in wrangler.toml.");
  }
  return env.IMAGES;
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

/**
 * Cloudflare R2 adapter using R2's S3-compatible API, implementing the
 * R2Bucket interface.
 *
 * Used on Vercel (STORAGE_DRIVER=s3, or inferred when R2_ACCESS_KEY_ID is
 * set without STORAGE_DRIVER=binding) so uploadImage()/deleteImage() hit
 * the SAME R2 bucket as Cloudflare production, just over R2's S3-compatible
 * HTTPS endpoint instead of the Workers binding.
 *
 * Requires an R2 API token (Access Key ID / Secret Access Key), the
 * account-scoped R2 endpoint, and the bucket name.
 * Docs: https://developers.cloudflare.com/r2/api/s3/api/
 */

import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import type { R2Bucket } from '@/lib/storage/r2Client';

function getConfig() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET_NAME;
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
    throw new Error(
      'R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and R2_BUCKET_NAME are required when STORAGE_DRIVER=s3.'
    );
  }
  return { accountId, accessKeyId, secretAccessKey, bucket };
}

let clientSingleton: S3Client | undefined;

function getClient(): S3Client {
  if (clientSingleton) return clientSingleton;
  const { accountId, accessKeyId, secretAccessKey } = getConfig();
  clientSingleton = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
  return clientSingleton;
}

async function streamToUint8Array(stream: ReadableStream): Promise<Uint8Array> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    merged.set(c, offset);
    offset += c.length;
  }
  return merged;
}

export function createR2S3Adapter(): R2Bucket {
  const { bucket } = getConfig();

  return {
    async put(
      key: string,
      value: ArrayBuffer | ArrayBufferView | ReadableStream,
      options?: { httpMetadata?: { contentType?: string } }
    ): Promise<unknown> {
      const body = value instanceof ReadableStream ? await streamToUint8Array(value) : value;
      const client = getClient();
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: body as Uint8Array,
          ContentType: options?.httpMetadata?.contentType,
        })
      );
      return { key };
    },

    async delete(key: string): Promise<void> {
      const client = getClient();
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    },

    async get(key: string) {
      const client = getClient();
      try {
        const res = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
        if (!res.Body) return null;
        return {
          body: res.Body.transformToWebStream(),
          httpMetadata: { contentType: res.ContentType },
        };
      } catch {
        return null;
      }
    },
  };
}

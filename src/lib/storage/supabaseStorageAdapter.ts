/**
 * Supabase Storage adapter implementing the R2Bucket interface.
 *
 * Used on Vercel (STORAGE_DRIVER=supabase, or inferred when SUPABASE_URL
 * is set without STORAGE_DRIVER=r2) so uploadImage()/deleteImage() in
 * r2Client.ts work unchanged regardless of backend.
 *
 * Requires SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and
 * SUPABASE_STORAGE_BUCKET (name of a bucket created in the Supabase
 * dashboard, e.g. "images") in the environment.
 */

import { createClient } from '@supabase/supabase-js';
import type { R2Bucket } from '@/lib/storage/r2Client';

function getBucketName(): string {
  const bucket = process.env.SUPABASE_STORAGE_BUCKET;
  if (!bucket) {
    throw new Error('SUPABASE_STORAGE_BUCKET is not set. Required when STORAGE_DRIVER=supabase.');
  }
  return bucket;
}

function getClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required when STORAGE_DRIVER=supabase.');
  }
  return createClient(url, key);
}

export function createSupabaseR2Adapter(): R2Bucket {
  const bucketName = getBucketName();

  return {
    async put(
      key: string,
      value: ArrayBuffer | ArrayBufferView | ReadableStream,
      options?: { httpMetadata?: { contentType?: string } }
    ): Promise<unknown> {
      const client = getClient();
      // Supabase's upload accepts ArrayBuffer/Blob directly; ReadableStream
      // needs buffering first since the client doesn't stream uploads.
      let body: ArrayBuffer | ArrayBufferView;
      if (value instanceof ReadableStream) {
        const reader = value.getReader();
        const chunks: Uint8Array[] = [];
        for (;;) {
          const { done, value: chunk } = await reader.read();
          if (done) break;
          chunks.push(chunk);
        }
        const total = chunks.reduce((n, c) => n + c.length, 0);
        const merged = new Uint8Array(total);
        let offset = 0;
        for (const c of chunks) {
          merged.set(c, offset);
          offset += c.length;
        }
        body = merged;
      } else {
        body = value;
      }

      const { error } = await client.storage.from(bucketName).upload(key, body, {
        contentType: options?.httpMetadata?.contentType,
        upsert: true,
      });
      if (error) throw error;
      return { key };
    },

    async delete(key: string): Promise<void> {
      const client = getClient();
      const { error } = await client.storage.from(bucketName).remove([key]);
      if (error) throw error;
    },

    async get(key: string) {
      const client = getClient();
      const { data, error } = await client.storage.from(bucketName).download(key);
      if (error || !data) return null;
      return {
        body: data.stream(),
        httpMetadata: { contentType: data.type || undefined },
      };
    },
  };
}

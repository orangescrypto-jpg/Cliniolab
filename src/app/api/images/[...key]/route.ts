import { NextResponse } from 'next/server';
import { getImageObject } from '@/lib/storage/r2Client';

interface RouteParams {
  params: Promise<{ key: string[] }>;
}

// Serves images uploaded via /api/uploads/image back out. uploadImage()
// returns paths shaped like /api/images/blog/<uuid>.png — the key in R2
// is everything after /api/images/, which is why this is a catch-all
// segment ([...key]) rather than a single [key]: keys always contain a
// slash (purpose/filename).
export async function GET(_request: Request, { params }: RouteParams) {
  const { key } = await params;
  const objectKey = key.join('/');

  const object = await getImageObject(objectKey);
  if (!object) {
    return NextResponse.json({ error: 'Image not found' }, { status: 404 });
  }

  return new NextResponse(object.body, {
    headers: {
      'Content-Type': object.httpMetadata?.contentType ?? 'application/octet-stream',
      // Uploaded images are content-addressed by a random UUID and never
      // overwritten in place, so it's safe to cache aggressively.
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}

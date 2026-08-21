import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/currentUser';
import { permissions } from '@/lib/auth/permissions';
import { ImageUploadError, uploadImage } from '@/lib/storage/r2Client';

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!permissions.canAccessAdminPanel(user.role)) {
    return NextResponse.json({ error: 'Admin/moderator access required' }, { status: 403 });
  }

  const formData = await request.formData();
  const file = formData.get('file');
  const purpose = formData.get('purpose'); // 'blog' | 'resources' | 'banners'

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }
  if (purpose !== 'blog' && purpose !== 'resources' && purpose !== 'banners' && purpose !== 'scholars') {
    return NextResponse.json({ error: 'purpose must be "blog", "resources", "banners", or "scholars"' }, { status: 400 });
  }

  try {
    const path = await uploadImage(file, purpose);
    return NextResponse.json({ path });
  } catch (err) {
    if (err instanceof ImageUploadError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    // Any other error here is a storage/config problem (missing R2
    // binding, bad S3 credentials, network failure to R2's endpoint,
    // etc.) rather than something the uploader did wrong. Surface the
    // real message instead of a bare "Upload failed" — a generic 500
    // with no detail is nearly impossible to diagnose from the client
    // side, and this project's threat model doesn't call for hiding
    // storage config errors from the small set of admins who can even
    // reach this endpoint (auth/role check already happened above).
    const detail = err instanceof Error ? err.message : String(err);
    console.error('Image upload failed (non-ImageUploadError):', err);
    return NextResponse.json({ error: `Upload failed: ${detail}` }, { status: 500 });
  }
}

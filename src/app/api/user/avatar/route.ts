import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/currentUser';
import { userService } from '@/lib/db';
import { ImageUploadError, deleteImageByPath, uploadImage } from '@/lib/storage/r2Client';

/**
 * Self-serve avatar upload - unlike /api/uploads/image (admin/moderator
 * only, for blog/banners/etc content), any logged-in user can upload
 * their own avatar here. Scoped to keyPrefix 'avatars', which skips the
 * Cliniolab watermark that other uploaded images get (see r2Client.ts).
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const formData = await request.formData();
  const file = formData.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }

  try {
    const path = await uploadImage(file, 'avatars');

    // Best-effort cleanup of the previous avatar so old uploads don't
    // pile up in R2 - not worth failing the request over if it errors.
    if (user.avatarPath) {
      await deleteImageByPath(user.avatarPath).catch((err) => {
        console.error('Failed to delete previous avatar (non-fatal):', err);
      });
    }

    await userService.updateProfile(user.id, { avatarPath: path });
    return NextResponse.json({ avatarPath: path });
  } catch (err) {
    if (err instanceof ImageUploadError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    const detail = err instanceof Error ? err.message : String(err);
    console.error('Avatar upload failed (non-ImageUploadError):', err);
    return NextResponse.json({ error: `Upload failed: ${detail}` }, { status: 500 });
  }
}

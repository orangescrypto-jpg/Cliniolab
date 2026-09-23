import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/currentUser';
import { userService } from '@/lib/db';

const MAX_BIO_LENGTH = 500;

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  return NextResponse.json({
    displayName: user.displayName,
    bio: user.bio,
    avatarPath: user.avatarPath,
  });
}

/**
 * Updates the current user's public-profile fields (display name, bio).
 * Avatar upload is handled separately by /api/user/avatar, since that
 * one deals with multipart form data rather than JSON.
 */
export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  let body: { displayName?: string | null; bio?: string | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const fields: { displayName?: string | null; bio?: string | null } = {};

  if ('displayName' in body) {
    const trimmed = body.displayName?.trim();
    if (!trimmed) {
      return NextResponse.json({ error: 'Display name cannot be empty' }, { status: 400 });
    }
    fields.displayName = trimmed;
  }

  if ('bio' in body) {
    const trimmed = body.bio?.trim();
    if (trimmed && trimmed.length > MAX_BIO_LENGTH) {
      return NextResponse.json({ error: `Bio must be ${MAX_BIO_LENGTH} characters or fewer` }, { status: 400 });
    }
    // Empty string clears it back to null, same as contact-phone.
    fields.bio = trimmed ? trimmed : null;
  }

  await userService.updateProfile(user.id, fields);

  return NextResponse.json({ success: true });
}

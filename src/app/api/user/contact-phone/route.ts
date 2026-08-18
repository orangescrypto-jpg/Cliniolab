import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/currentUser';
import { userService } from '@/lib/db';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  return NextResponse.json({ contactPhone: user.contactPhone });
}

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  let body: { contactPhone?: string | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // Empty string / whitespace clears it back to null rather than storing
  // a blank value that would then render as a blank "contact: " line.
  const trimmed = body.contactPhone?.trim();
  await userService.updateContactPhone(user.id, trimmed ? trimmed : null);

  return NextResponse.json({ success: true });
}

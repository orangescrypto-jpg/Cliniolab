import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/currentUser';
import { permissions } from '@/lib/auth/permissions';
import { abbreviationService, featureFlagService } from '@/lib/db';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search') ?? undefined;
  const random = searchParams.get('random');

  const abbreviations = random
    ? await abbreviationService.listRandomAbbreviations(Number(random))
    : await abbreviationService.listAbbreviations(search);

  return NextResponse.json({ abbreviations });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!permissions.canManageLearningContent(user.role)) {
    return NextResponse.json({ error: 'Only admins/moderators can add abbreviations' }, { status: 403 });
  }

  const enabled = await featureFlagService.isFeatureEnabled('medical_abbreviations');
  if (!enabled) {
    return NextResponse.json({ error: 'Medical abbreviations are currently disabled' }, { status: 403 });
  }

  let body: { abbreviation: string; meaning: string; category?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  if (!body.abbreviation?.trim() || !body.meaning?.trim()) {
    return NextResponse.json({ error: 'abbreviation and meaning are required' }, { status: 400 });
  }

  const abbreviation = await abbreviationService.createAbbreviation(user.id, body);
  return NextResponse.json({ abbreviation }, { status: 201 });
}

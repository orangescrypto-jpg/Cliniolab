import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/currentUser';
import { resourceService } from '@/lib/db';

interface RouteParams {
  params: Promise<{ resourceId: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  const { resourceId } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Login required' }, { status: 401 });

  try {
    const state = await resourceService.getAccessState(resourceId, user.id);
    return NextResponse.json(state);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Resource not found' },
      { status: 404 }
    );
  }
}

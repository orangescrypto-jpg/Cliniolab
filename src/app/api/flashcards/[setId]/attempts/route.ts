import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/currentUser';
import { featureFlagService, flashcardAttemptService, flashcardService, userService } from '@/lib/db';

interface RouteParams {
  params: Promise<{ setId: string }>;
}

/** Records one completed run through a flashcard set (reached the last card). */
export async function POST(_request: Request, { params }: RouteParams) {
  const enabled = await featureFlagService.isFeatureEnabled('flashcards');
  if (!enabled) return NextResponse.json({ error: 'Flashcards are currently disabled' }, { status: 403 });

  const { setId } = await params;
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Login required to record flashcard attempts' }, { status: 401 });
  }

  const set = await flashcardService.getFlashcardSetById(setId);
  if (!set) return NextResponse.json({ error: 'Flashcard set not found' }, { status: 404 });

  await flashcardAttemptService.recordFlashcardAttempt(setId, user.id);

  // Same streak signal quiz attempts use - completing a flashcard set is
  // genuine practice too, recorded attempt or not.
  await userService.recordActivityForStreak(user.id);

  return NextResponse.json({ success: true });
}

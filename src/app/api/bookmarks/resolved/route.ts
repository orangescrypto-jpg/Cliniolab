import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/currentUser';
import { bookmarkService, quizService, resourceService } from '@/lib/db';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const bookmarks = await bookmarkService.listBookmarksForUser(user.id);
  const quizIds = bookmarks.filter((b) => b.kind === 'quiz').map((b) => b.targetId);
  const resourceIds = bookmarks.filter((b) => b.kind === 'resource').map((b) => b.targetId);

  const [quizzes, resources] = await Promise.all([
    quizService.getQuizzesWithStatsByIds(quizIds),
    resourceService.getResourcesByIds(resourceIds),
  ]);

  return NextResponse.json({ quizzes, resources });
}

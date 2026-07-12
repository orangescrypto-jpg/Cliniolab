import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/currentUser';
import { permissions } from '@/lib/auth/permissions';
import { siteSettingsService } from '@/lib/db';
import type { RelatedQuizzesSetting } from '@/types';

export async function GET() {
  const [quizPage, blogPage] = await Promise.all([
    siteSettingsService.getRelatedQuizzesQuizPageSetting(),
    siteSettingsService.getRelatedQuizzesBlogPageSetting(),
  ]);
  return NextResponse.json({ quizPage, blogPage });
}

export async function PUT(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!permissions.canAccessAdminPanel(user.role)) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  let body: { quizPage?: RelatedQuizzesSetting; blogPage?: RelatedQuizzesSetting };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (body.quizPage) {
    await siteSettingsService.setRelatedQuizzesQuizPageSetting(body.quizPage);
  }
  if (body.blogPage) {
    await siteSettingsService.setRelatedQuizzesBlogPageSetting(body.blogPage);
  }

  const [quizPage, blogPage] = await Promise.all([
    siteSettingsService.getRelatedQuizzesQuizPageSetting(),
    siteSettingsService.getRelatedQuizzesBlogPageSetting(),
  ]);
  return NextResponse.json({ quizPage, blogPage });
}

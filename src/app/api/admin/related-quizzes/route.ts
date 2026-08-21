import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/currentUser';
import { permissions } from '@/lib/auth/permissions';
import { siteSettingsService } from '@/lib/db';
import type { RelatedQuizzesSetting, RelatedPostsSetting } from '@/types';

export async function GET() {
  const [quizPage, blogPage, relatedPosts] = await Promise.all([
    siteSettingsService.getRelatedQuizzesQuizPageSetting(),
    siteSettingsService.getRelatedQuizzesBlogPageSetting(),
    siteSettingsService.getRelatedPostsSetting(),
  ]);
  return NextResponse.json({ quizPage, blogPage, relatedPosts });
}

export async function PUT(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!permissions.canAccessAdminPanel(user.role)) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  let body: {
    quizPage?: RelatedQuizzesSetting;
    blogPage?: RelatedQuizzesSetting;
    relatedPosts?: RelatedPostsSetting;
  };
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
  if (body.relatedPosts) {
    await siteSettingsService.setRelatedPostsSetting(body.relatedPosts);
  }

  const [quizPage, blogPage, relatedPosts] = await Promise.all([
    siteSettingsService.getRelatedQuizzesQuizPageSetting(),
    siteSettingsService.getRelatedQuizzesBlogPageSetting(),
    siteSettingsService.getRelatedPostsSetting(),
  ]);
  return NextResponse.json({ quizPage, blogPage, relatedPosts });
}

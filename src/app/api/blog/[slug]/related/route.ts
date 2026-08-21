import { NextResponse } from 'next/server';
import { cmsService, quizService, siteSettingsService } from '@/lib/db';

interface RouteParams {
  params: Promise<{ slug: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  const { slug } = await params;

  const setting = await siteSettingsService.getRelatedQuizzesBlogPageSetting();
  if (!setting.enabled) return NextResponse.json({ quizzes: [] });

  const post = await cmsService.getPostBySlug(slug);
  if (!post) return NextResponse.json({ error: 'Post not found' }, { status: 404 });

  // Admin can turn off related quizzes for specific blog categories
  // (e.g. Job, Scholarship, Clinical Pearls) where a "practice quiz"
  // suggestion doesn't make sense, without disabling the widget site-wide.
  if (post.blogCategoryId && (setting.disabledCategoryIds ?? []).includes(post.blogCategoryId)) {
    return NextResponse.json({ quizzes: [] });
  }

  const related = await quizService.listRelatedQuizzesByLabel(post.category, setting.count);
  return NextResponse.json({ quizzes: related });
}

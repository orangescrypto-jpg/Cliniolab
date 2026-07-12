import type { Metadata } from 'next';
import { quizService } from '@/lib/db';
import { QuizDetailClient } from './QuizDetailClient';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://cliniolab.com';

interface PageProps {
  params: Promise<{ quizId: string }>;
}

const MODE_LABELS: Record<string, string> = {
  study: 'Study Mode',
  quiz: 'Quiz',
  exam: 'CBT Exam',
};

/**
 * Per-quiz metadata, generated server-side. This is the highest-value SEO
 * surface on the whole platform - people searching a specific clinical
 * topic ("pharmacology dosage calculation quiz", "UBTH nursing entrance
 * past questions") land on one quiz page, not the homepage. Without this,
 * every quiz page shared the same generic site title/description even
 * though each one is now in the sitemap.
 */
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { quizId } = await params;
  const quiz = await quizService.getQuizById(quizId).catch(() => null);

  if (!quiz || quiz.visibility !== 'public') {
    // Private/missing quizzes get a neutral title rather than leaking
    // their existence or content via search engine metadata.
    return { title: 'Quiz' };
  }

  const modeLabel = MODE_LABELS[quiz.mode] ?? 'Quiz';
  const title = `${quiz.title} — ${modeLabel} | Cliniolab`;
  const description =
    quiz.description?.slice(0, 160) ??
    `Practice ${quiz.title} on Cliniolab, a nursing and clinical exam practice platform.`;

  return {
    title,
    description,
    alternates: { canonical: `${BASE_URL}/quizzes/${quiz.id}` },
    openGraph: {
      title,
      description,
      type: 'website',
      url: `${BASE_URL}/quizzes/${quiz.id}`,
    },
    twitter: {
      card: 'summary',
      title,
      description,
    },
    // Paid quizzes: still indexable (the listing itself is legitimate
    // content), but noindex would be the wrong call here since the title/
    // price page has standalone value; only the questions are gated.
  };
}

export default async function QuizDetailPage({ params }: PageProps) {
  const { quizId } = await params;
  return <QuizDetailClient quizId={quizId} />;
}

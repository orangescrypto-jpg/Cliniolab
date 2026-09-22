import type { Metadata } from 'next';
import { categoryService } from '@/lib/db';
import { HomeClient } from './HomeClient';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://cliniolab.com';

const TITLE = 'Cliniolab — Nursing & Clinical Exam Practice';
const DESCRIPTION =
  "Cliniolab brings together student-built quizzes, CBT-style exams, and clinical study notes in one place so you can revise a topic, test yourself on it, and track how you're improving.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: BASE_URL },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    type: 'website',
    url: BASE_URL,
  },
  twitter: {
    card: 'summary',
    title: TITLE,
    description: DESCRIPTION,
  },
};

export default async function HomePage() {
  // Only the quiz-category list is fetched server-side for this pass -
  // it drives the largest above-the-fold section (Quiz/Exam/Study) and
  // needs no auth. Every other section (leaderboard, resources, blog
  // teasers, flashcards, flags) stays a client fetch exactly as before;
  // several of those are user-specific or flag-gated and are left for a
  // separate, more careful pass rather than converting this high-traffic
  // page's whole data layer in one blind rewrite.
  const categories = await categoryService.listCategories().catch(() => []);

  return <HomeClient initialCategories={categories} />;
}

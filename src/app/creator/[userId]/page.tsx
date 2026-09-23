import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { quizService, userService } from '@/lib/db';
import { CreatorProfileClient } from './CreatorProfileClient';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://cliniolab.com';

interface PageProps {
  params: Promise<{ userId: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { userId } = await params;
  const profile = await userService.getPublicCreatorProfile(userId).catch(() => null);
  if (!profile) return { title: 'Creator not found | Cliniolab' };

  const name = profile.displayName ?? 'Cliniolab creator';
  const title = `${name} | Cliniolab`;
  const description = profile.bio ?? `See quizzes and study sets published by ${name} on Cliniolab.`;

  return {
    title,
    description,
    alternates: { canonical: `${BASE_URL}/creator/${profile.id}` },
    openGraph: {
      title,
      description,
      type: 'profile',
      url: `${BASE_URL}/creator/${profile.id}`,
      ...(profile.avatarPath ? { images: [{ url: `${BASE_URL}${profile.avatarPath}` }] } : {}),
    },
    twitter: {
      card: profile.avatarPath ? 'summary' : 'summary_large_image',
      title,
      description,
    },
  };
}

export default async function CreatorProfilePage({ params }: PageProps) {
  const { userId } = await params;

  const profile = await userService.getPublicCreatorProfile(userId).catch(() => null);
  if (!profile) {
    notFound();
    return null;
  }

  const quizzes = await quizService.listPublicQuizzesByCreator(userId).catch(() => []);
  const totalAttempts = quizzes.reduce(
    (sum, q) => sum + q.attemptCount + (q.studyAttemptCount ?? 0),
    0
  );

  return (
    <CreatorProfileClient
      profile={profile}
      quizzes={quizzes}
      stats={{ quizCount: quizzes.length, totalAttempts }}
    />
  );
}

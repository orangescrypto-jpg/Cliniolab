'use client';

import { useState } from 'react';

export interface ShareStats {
  creatorName?: string | null;
  mode?: 'study' | 'quiz' | 'exam';
  priceKobo?: number | null;
  pricing?: 'free' | 'paid';
  timeLimitSeconds?: number | null;
  questionCount?: number;
  retakePolicy?: 'unlimited' | 'single' | 'daily_limit' | 'cooldown';
  retakeLimit?: number | null;
}

const MODE_LABELS: Record<NonNullable<ShareStats['mode']>, string> = {
  study: 'Study Mode',
  quiz: 'Quiz Mode',
  exam: 'CBT (Computer-Based Test) Mode',
};

function formatNaira(kobo: number): string {
  return `₦${(kobo / 100).toLocaleString('en-NG')}`;
}

function formatDuration(seconds: number | null | undefined): string {
  if (!seconds) return 'No limit';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return [h, m, s].map((n) => String(n).padStart(2, '0')).join(':');
}

function formatTrials(stats: ShareStats): string {
  switch (stats.retakePolicy) {
    case 'single':
      return '1 time';
    case 'daily_limit':
      return `${stats.retakeLimit ?? 1} time${stats.retakeLimit === 1 ? '' : 's'} per day`;
    case 'cooldown':
      return `${stats.retakeLimit ?? 1} time${stats.retakeLimit === 1 ? '' : 's'} (cooldown applies)`;
    case 'unlimited':
    default:
      return 'Unlimited';
  }
}

function buildShareText(title: string, url: string, stats?: ShareStats): string {
  if (!stats) return `${title} - ${url}`;

  const lines: string[] = [];
  lines.push(title + (stats.creatorName ? ` By ${stats.creatorName}` : ''));
  if (stats.mode) {
    lines.push(`Available in: ${MODE_LABELS[stats.mode]}`);
  }
  lines.push('');
  lines.push(
    `Price: ${stats.pricing === 'paid' && stats.priceKobo ? formatNaira(stats.priceKobo) : 'Free'}`
  );
  lines.push(`Estimated time: ${formatDuration(stats.timeLimitSeconds)}`);
  if (typeof stats.questionCount === 'number') {
    lines.push(`Questions: ${stats.questionCount}`);
  }
  lines.push(`Trials allowed: ${formatTrials(stats)}`);
  lines.push('');
  lines.push(url);

  return lines.join('\n');
}

export function ShareButton({
  url,
  title,
  stats,
}: {
  url: string;
  title: string;
  stats?: ShareStats;
}) {
  const [copied, setCopied] = useState(false);

  async function handleShare() {
    const text = buildShareText(title, url, stats);
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        // Pass url separately too: most share targets append it after `text`,
        // matching how QuizzerWeb's own forwarded share message is structured.
        await navigator.share({ title, text, url });
        return;
      } catch {
        // user cancelled the share sheet; fall through to clipboard copy
      }
    }
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard unavailable; silently no-op rather than throwing in the UI
    }
  }

  function handleWhatsAppShare() {
    const text = encodeURIComponent(buildShareText(title, url, stats));
    window.open(`https://wa.me/?text=${text}`, '_blank');
  }

  return (
    <div className="inline-flex flex-col gap-2 sm:flex-row">
      <button
        onClick={handleShare}
        className="inline-flex items-center gap-1.5 rounded-md border border-ink-100 px-3 py-1.5 text-xs font-medium text-ink-600 hover:bg-ink-50"
      >
        {copied ? 'Link copied' : 'Share'}
      </button>
      <button
        onClick={handleWhatsAppShare}
        className="inline-flex items-center gap-1.5 rounded-md border border-pulse-200 px-3 py-1.5 text-xs font-medium text-pulse-700 hover:bg-pulse-50"
        title="Share to WhatsApp"
      >
        WhatsApp
      </button>
    </div>
  );
}

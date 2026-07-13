'use client';

import { useState } from 'react';

export function ShareButton({ url, title }: { url: string; title: string }) {
  const [copied, setCopied] = useState(false);

  async function handleShare() {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title, url });
        return;
      } catch {
        // user cancelled the share sheet; fall through to clipboard copy
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard unavailable; silently no-op rather than throwing in the UI
    }
  }

  function handleWhatsAppShare() {
    const text = encodeURIComponent(`${title} - ${url}`);
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

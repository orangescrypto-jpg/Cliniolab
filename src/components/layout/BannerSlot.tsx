'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import type { Banner, BannerPlacement } from '@/types';

interface BannerSlotProps {
  placement: BannerPlacement;
}

/** Fire-and-forget event beacon — never blocks or throws into the caller. */
function trackBannerEvent(bannerId: string, eventType: 'impression' | 'click') {
  fetch(`/api/banners/${bannerId}/track`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ eventType }),
    keepalive: true, // lets the request complete even if the user navigates away right after a click
  }).catch(() => {});
}

/**
 * Renders admin-managed CTA/advertising banners.
 * - 'header': a long, full-width strip (goes under the homepage hero).
 * - 'footer': a normal-sized banner (goes above the footer's link grid).
 * Renders nothing if the placement is disabled or has no active banners,
 * so it never leaves an empty gap on the page.
 */
export function BannerSlot({ placement }: BannerSlotProps) {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loaded, setLoaded] = useState(false);
  const trackedImpressions = useRef(new Set<string>());

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/banners?placement=${placement}`)
      .then((res) => (res.ok ? res.json() : { enabled: false, banners: [] }))
      .then((data) => {
        if (!cancelled) setBanners(data.enabled ? (data.banners ?? []) : []);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [placement]);

  // Fire one impression event per banner the first time it's actually
  // rendered to the visitor. The ref guards against double-firing from
  // React re-renders (e.g. StrictMode) within the same page load.
  useEffect(() => {
    for (const banner of banners) {
      if (!trackedImpressions.current.has(banner.id)) {
        trackedImpressions.current.add(banner.id);
        trackBannerEvent(banner.id, 'impression');
      }
    }
  }, [banners]);

  if (!loaded || banners.length === 0) return null;

  if (placement === 'header') {
    return (
      <div className="mx-auto max-w-7xl px-6 py-4">
        {banners.map((banner) => (
          <BannerImage key={banner.id} banner={banner} className="aspect-[16/3] w-full sm:aspect-[16/2.5]" />
        ))}
      </div>
    );
  }

  // Footer banner(s): normal-sized, stacked if there's more than one.
  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {banners.map((banner) => (
          <BannerImage key={banner.id} banner={banner} className="aspect-[16/6] w-full" />
        ))}
      </div>
    </div>
  );
}

function BannerImage({ banner, className }: { banner: Banner; className: string }) {
  const image = (
    <div className={`relative overflow-hidden rounded-lg border border-ink-100 shadow-sm ${className}`}>
      <Image src={banner.imagePath} alt={banner.title} fill className="object-cover" unoptimized />
    </div>
  );

  if (banner.linkUrl) {
    const isExternal = /^https?:\/\//.test(banner.linkUrl);
    const handleClick = () => trackBannerEvent(banner.id, 'click');
    return isExternal ? (
      <a href={banner.linkUrl} target="_blank" rel="noopener noreferrer" aria-label={banner.title} onClick={handleClick}>
        {image}
      </a>
    ) : (
      <Link href={banner.linkUrl} aria-label={banner.title} onClick={handleClick}>
        {image}
      </Link>
    );
  }

  return image;
}

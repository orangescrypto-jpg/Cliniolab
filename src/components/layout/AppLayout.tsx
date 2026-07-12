'use client';

import React from 'react';
import { NavBar } from './NavBar';
import { Footer } from './Footer';
import { PwaSetup } from './PwaSetup';
import { FeedbackWidget } from './FeedbackWidget';
import { CookieConsentBanner } from './CookieConsentBanner';

export function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-paper">
      <NavBar />
      <main className="flex-1">{children}</main>
      <Footer />
      <PwaSetup />
      <FeedbackWidget />
      <CookieConsentBanner />
    </div>
  );
}

import Link from 'next/link';
import { HomepageVideoSection } from './HomepageVideoSection';
import { BannerSlot } from './BannerSlot';

export function Footer() {
  return (
    <footer className="mt-16">
      <HomepageVideoSection />

      <BannerSlot placement="footer" />

      <div className="border-t border-ink-100 bg-ink-800 text-ink-100">
        <div className="mx-auto max-w-7xl px-6 py-12">
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
            <div className="col-span-2 sm:col-span-1">
              <span className="font-display text-lg font-semibold text-white">Cliniolab</span>
              <p className="mt-2 text-sm text-ink-300">
                Quizzes and exams for nursing and clinical students.
              </p>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white">Explore</h4>
              <ul className="mt-3 space-y-2 text-sm text-ink-300">
                <li><Link href="/categories" className="hover:text-white">Categories</Link></li>
                <li><Link href="/quizzes" className="hover:text-white">Latest Quizzes</Link></li>
                <li><Link href="/leaderboard" className="hover:text-white">Leaderboard</Link></li>
                <li><Link href="/blog" className="hover:text-white">Blog</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white">Account</h4>
              <ul className="mt-3 space-y-2 text-sm text-ink-300">
                <li><Link href="/login" className="hover:text-white">Log in</Link></li>
                <li><Link href="/register" className="hover:text-white">Sign up</Link></li>
                <li><Link href="/dashboard" className="hover:text-white">Dashboard</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white">Site</h4>
              <ul className="mt-3 space-y-2 text-sm text-ink-300">
                <li><Link href="/about" className="hover:text-white">About</Link></li>
                <li><Link href="/contact" className="hover:text-white">Contact</Link></li>
                <li><Link href="/faq" className="hover:text-white">FAQ</Link></li>
                <li><Link href="/terms" className="hover:text-white">Terms</Link></li>
                <li><Link href="/privacy" className="hover:text-white">Privacy</Link></li>
              </ul>
            </div>
          </div>
          <div className="chart-strip mt-10 text-ink-400" aria-hidden />
          <p className="mt-6 text-xs text-ink-400">
            © {new Date().getFullYear()} Cliniolab. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}

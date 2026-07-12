'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from '@/lib/auth/AuthProvider';

const links = [
  { href: '/admin', label: 'Overview' },
  { href: '/admin/analytics', label: 'Analytics' },
  { href: '/admin/payments', label: 'Payments' },
  { href: '/admin/flags', label: 'Feature Flags' },
  { href: '/admin/categories', label: 'Categories' },
  { href: '/admin/quizzes', label: 'Quizzes' },
  { href: '/admin/blog', label: 'Blog' },
  { href: '/admin/resources', label: 'Books & Past Questions' },
  { href: '/admin/pages', label: 'Site Pages' },
  { href: '/admin/homepage-video', label: 'Homepage Video' },
  { href: '/admin/banners', label: 'Banners' },
  { href: '/admin/related-content', label: 'Related Content' },
  { href: '/admin/cookie-consent', label: 'Cookie Consent' },
  { href: '/admin/reports', label: 'Reports' },
  { href: '/admin/feedback', label: 'Feedback' },
  { href: '/admin/users', label: 'Users' },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!loading && (!user || (user.role !== 'admin' && user.role !== 'moderator'))) {
      router.replace('/');
    }
  }, [loading, user, router]);

  if (loading || !user || (user.role !== 'admin' && user.role !== 'moderator')) return null;

  return (
    <div className="mx-auto flex max-w-7xl gap-8 px-6 py-12">
      <aside className="w-56 shrink-0">
        <h2 className="font-display text-lg font-semibold text-ink-800">Admin</h2>
        <nav className="mt-4 space-y-1">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`block rounded-md px-3 py-2 text-sm font-medium ${
                pathname === link.href ? 'bg-pulse-50 text-pulse-700' : 'text-ink-600 hover:bg-ink-50'
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </aside>
      <div className="flex-1">{children}</div>
    </div>
  );
}

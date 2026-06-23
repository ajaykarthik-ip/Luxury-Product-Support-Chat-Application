'use client';

import { useAuth } from '@/lib/auth';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';

/** Top bar with the brand, an optional slot (e.g. "back" link), and user menu. */
export default function AppHeader({ left }: { left?: ReactNode }) {
  const { user, logout } = useAuth();
  const router = useRouter();

  function handleLogout() {
    logout();
    router.replace('/login');
  }

  return (
    <header className="sticky top-0 z-10 flex items-center justify-between border-b border-neutral-200/70 bg-white/80 px-6 py-3 backdrop-blur-md">
      <div className="flex items-center gap-4">
        {left}
        {/* DU monogram wordmark */}
        <span className="font-serif text-2xl font-semibold tracking-[0.35em] pl-1">
          DU
        </span>
      </div>
      {user ? (
        <div className="flex items-center gap-3 text-sm">
          <span className="text-neutral-600">
            {user.name}
            <span className="ml-1 text-xs uppercase tracking-wide text-amber-700">
              {user.role}
            </span>
          </span>
          <button
            onClick={handleLogout}
            className="rounded-full border border-stone-300 px-3 py-1 text-xs hover:bg-stone-100"
          >
            Sign out
          </button>
        </div>
      ) : (
        // Anonymous visitor browsing the public catalog.
        <Link
          href="/login"
          className="rounded-full bg-neutral-900 px-4 py-1.5 text-xs font-medium text-stone-50 hover:bg-neutral-800"
        >
          Sign in
        </Link>
      )}
    </header>
  );
}

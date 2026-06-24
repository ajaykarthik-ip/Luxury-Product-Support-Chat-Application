'use client';

import { useAuth } from '@/lib/auth';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type ReactNode } from 'react';

/** Top bar with the brand, an optional slot (e.g. "back" link), and user menu. */
export default function AppHeader({ left }: { left?: ReactNode }) {
  const { user, logout } = useAuth();
  const router = useRouter();
  // Mobile collapses the name + Sign out into an avatar dropdown so the header
  // stays on one line on narrow screens.
  const [menuOpen, setMenuOpen] = useState(false);

  function handleLogout() {
    setMenuOpen(false);
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
        <>
          {/* Desktop: name + role + Sign out (unchanged). */}
          <div className="hidden items-center gap-3 text-sm md:flex">
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

          {/* Mobile: avatar button → dropdown, so the header never wraps. */}
          <div className="relative md:hidden">
            <button
              onClick={() => setMenuOpen((o) => !o)}
              aria-label="Account menu"
              aria-haspopup="true"
              aria-expanded={menuOpen}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-900 text-xs font-semibold text-stone-50"
            >
              {user.name?.trim()?.[0]?.toUpperCase() ?? 'U'}
            </button>
            {menuOpen && (
              <>
                {/* Click-away backdrop. */}
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setMenuOpen(false)}
                />
                <div className="absolute right-0 z-20 mt-2 w-44 overflow-hidden rounded-xl border border-stone-200 bg-white py-1 shadow-lg">
                  <div className="px-3 py-2">
                    <p className="truncate text-sm font-medium text-neutral-800">
                      {user.name}
                    </p>
                    <p className="text-[10px] uppercase tracking-wide text-amber-700">
                      {user.role}
                    </p>
                  </div>
                  <div className="border-t border-stone-100" />
                  <button
                    onClick={handleLogout}
                    className="block w-full px-3 py-2 text-left text-sm text-neutral-700 hover:bg-stone-50"
                  >
                    Sign out
                  </button>
                </div>
              </>
            )}
          </div>
        </>
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

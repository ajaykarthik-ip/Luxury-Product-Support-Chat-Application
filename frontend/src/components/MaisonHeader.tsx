'use client';

import { useAuth } from '@/lib/auth';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type ReactNode } from 'react';

/**
 * Customer-side header for the Maison experience (warm-dark, brass). Kept
 * separate from `AppHeader` so the agent dashboard — which still uses
 * AppHeader — is untouched by the redesign. Same behaviour: brand wordmark,
 * an optional left slot (back link), and the user menu collapsing to an
 * avatar dropdown on mobile.
 */
export default function MaisonHeader({ left }: { left?: ReactNode }) {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  function handleLogout() {
    setMenuOpen(false);
    logout();
    router.replace('/login');
  }

  return (
    <header className="sticky top-0 z-20 flex items-center justify-between border-b border-bone/10 bg-ink/70 px-6 py-3.5 backdrop-blur-xl">
      <div className="flex items-center gap-4">
        {left}
        <Link
          href="/products"
          className="font-display text-[1.6rem] font-semibold leading-none tracking-[0.34em] text-bone"
        >
          DU
        </Link>
      </div>

      {user ? (
        <>
          {/* Desktop: name + role + Sign out. */}
          <div className="hidden items-center gap-4 md:flex">
            <span className="text-right text-sm leading-tight text-bone/80">
              {user.name}
              <span className="ml-2 font-mono text-[10px] uppercase tracking-[0.2em] text-brass">
                {user.role}
              </span>
            </span>
            <button
              onClick={handleLogout}
              className="rounded-full border border-bone/20 px-3.5 py-1 text-xs text-bone/80 transition hover:border-brass hover:text-brass"
            >
              Sign out
            </button>
          </div>

          {/* Mobile: avatar → dropdown. */}
          <div className="relative md:hidden">
            <button
              onClick={() => setMenuOpen((o) => !o)}
              aria-label="Account menu"
              aria-haspopup="true"
              aria-expanded={menuOpen}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-brass/40 bg-umber font-mono text-xs font-semibold text-brass"
            >
              {user.name?.trim()?.[0]?.toUpperCase() ?? 'U'}
            </button>
            {menuOpen && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setMenuOpen(false)}
                />
                <div className="absolute right-0 z-20 mt-2 w-44 overflow-hidden rounded-xl border border-bone/10 bg-umber py-1 shadow-2xl">
                  <div className="px-3 py-2">
                    <p className="truncate text-sm font-medium text-bone">
                      {user.name}
                    </p>
                    <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-brass">
                      {user.role}
                    </p>
                  </div>
                  <div className="border-t border-bone/10" />
                  <button
                    onClick={handleLogout}
                    className="block w-full px-3 py-2 text-left text-sm text-bone/80 transition hover:bg-umber2"
                  >
                    Sign out
                  </button>
                </div>
              </>
            )}
          </div>
        </>
      ) : (
        <Link
          href="/login"
          className="rounded-full border border-brass/50 bg-brass/10 px-4 py-1.5 text-xs font-medium tracking-wide text-brass transition hover:bg-brass hover:text-ink"
        >
          Sign in
        </Link>
      )}
    </header>
  );
}

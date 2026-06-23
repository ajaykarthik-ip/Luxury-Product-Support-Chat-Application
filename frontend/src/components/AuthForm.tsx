'use client';

import { useAuth } from '@/lib/auth';
import type { Role } from '@/lib/types';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

/**
 * Self-contained auth screen, reused by the customer (/login) and agent
 * (/agent/login) routes. Keeping them on separate routes means a customer never
 * sees an "Agent" option (and vice-versa) — cleaner, less confusing UX.
 *
 * Login is universal (the backend returns the user's real role); only the
 * REGISTER action is role-specific, fixed by the `role` prop of the page.
 */
export default function AuthForm({
  role,
  subtitle,
  crossLinkHref,
  crossLinkLabel,
}: {
  role: Role;
  subtitle: string;
  crossLinkHref: string;
  crossLinkLabel: string;
}) {
  const { user, loading, login, register } = useAuth();
  const router = useRouter();

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const home = (r: Role) => (r === 'AGENT' ? '/agent' : '/products');

  // Already signed in → go to the right home.
  useEffect(() => {
    if (!loading && user) router.replace(home(user.role));
  }, [user, loading, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const u =
        mode === 'login'
          ? await login(email, password)
          : await register({ email, password, name, role });
      router.replace(home(u.role));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex flex-1 items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="font-serif text-5xl font-semibold tracking-[0.35em] pl-2">
            DU
          </h1>
          <p className="mt-2 text-sm tracking-wide text-neutral-500">
            {subtitle}
          </p>
        </div>

        <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
          {/* Mode toggle */}
          <div className="mb-6 flex rounded-full bg-stone-100 p-1 text-sm">
            {(['login', 'register'] as const).map((m) => (
              <button
                key={m}
                onClick={() => {
                  setMode(m);
                  setError('');
                }}
                className={`flex-1 rounded-full py-1.5 transition ${
                  mode === m ? 'bg-neutral-900 text-stone-50' : 'text-neutral-600'
                }`}
              >
                {m === 'login' ? 'Sign in' : 'Register'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            {mode === 'register' && (
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Full name"
                required
                className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-neutral-900"
              />
            )}
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              required
              className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-neutral-900"
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              required
              minLength={6}
              className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-neutral-900"
            />

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-lg bg-neutral-900 py-2.5 text-sm font-medium text-stone-50 hover:bg-neutral-800 disabled:opacity-50"
            >
              {submitting
                ? 'Please wait…'
                : mode === 'login'
                  ? 'Sign in'
                  : 'Create account'}
            </button>
          </form>
        </div>

        {/* Cross-link to the other portal */}
        <p className="mt-4 text-center text-xs text-neutral-500">
          <Link href={crossLinkHref} className="underline hover:text-neutral-800">
            {crossLinkLabel}
          </Link>
        </p>
      </div>
    </main>
  );
}

'use client';

import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { PENDING_KEY } from '@/lib/useStartChat';
import type { Role } from '@/lib/types';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Self-contained auth screen, reused by the customer (/login) and agent
 * (/agent/login) routes. Keeping them on separate routes means a customer never
 * sees an "Agent" option (and vice-versa) — cleaner, less confusing UX.
 *
 * Login is universal (the backend returns the user's real role); only the
 * REGISTER action is role-specific, fixed by the `role` prop of the page.
 *
 * Deferred-chat resume: if a logged-out visitor clicked "Chat" we stashed the
 * product id. After auth we open that conversation *directly* (product → login →
 * chat) — no catalog flash in between — and show a brief "starting…" state so the
 * hand-off feels smooth rather than like a glitchy redirect.
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
  const [resuming, setResuming] = useState(false);
  // Did we arrive here mid-chat-intent? Drives the contextual banner.
  const [pendingChat, setPendingChat] = useState(false);
  // Navigate exactly once (login updates `user` → the effect fires; guard against
  // a second invocation racing it back to the wrong place).
  const navigated = useRef(false);

  useEffect(() => {
    setPendingChat(!!sessionStorage.getItem(PENDING_KEY));
  }, []);

  const home = (r: Role) => (r === 'AGENT' ? '/agent' : '/products');

  // After auth: resume the pending chat (customers) or go to the role home.
  const finish = useCallback(
    async (r: Role) => {
      if (navigated.current) return;
      navigated.current = true;
      const pending =
        r === 'CUSTOMER' ? sessionStorage.getItem(PENDING_KEY) : null;
      if (pending) {
        sessionStorage.removeItem(PENDING_KEY);
        setResuming(true);
        try {
          const convo = await api.startConversation(pending);
          router.replace(`/chat/${convo.id}`);
          return;
        } catch {
          // If creating the conversation fails, fall back to the catalog.
        }
      }
      router.replace(home(r));
    },
    [router],
  );

  // Already signed in (e.g. navigated here directly) → resume / go home.
  useEffect(() => {
    if (!loading && user) finish(user.role);
  }, [user, loading, finish]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      if (mode === 'login') await login(email, password);
      else await register({ email, password, name, role });
      // Navigation is handled by the effect below once `user` updates — keeps a
      // single navigation path and the "Please wait…" state until we leave.
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setSubmitting(false);
    }
  }

  // Smooth hand-off while we open the conversation.
  if (resuming) {
    return (
      <main className="flex flex-1 items-center justify-center px-4">
        <div className="flex flex-col items-center gap-4 text-center">
          <span className="h-7 w-7 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-900" />
          <p className="text-sm text-neutral-500">
            Starting your conversation…
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex flex-1 items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="pl-2 font-serif text-5xl font-semibold tracking-[0.35em]">
            DU
          </h1>
          <p className="mt-2 text-sm tracking-wide text-neutral-500">
            {pendingChat ? 'Sign in to start your conversation' : subtitle}
          </p>
        </div>

        <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
          {pendingChat && (
            <p className="mb-5 rounded-xl bg-stone-50 px-4 py-3 text-center text-xs leading-relaxed text-neutral-500">
              You&apos;re one step away — sign in and we&apos;ll take you straight
              into your chat with a specialist.
            </p>
          )}

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
                  ? pendingChat
                    ? 'Sign in & start chat'
                    : 'Sign in'
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

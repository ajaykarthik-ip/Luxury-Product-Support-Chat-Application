'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';
import { api } from './api';
import { useAuth } from './auth';

/** Where we stash the product a logged-out visitor wanted, to resume after login. */
export const PENDING_KEY = 'pendingProductId';

/**
 * Shared "Chat with a specialist" action, used by the catalog and the product
 * page.
 * - Signed in  → find-or-create the conversation and open it.
 * - Signed out → raise a small "Sign in to continue" prompt (the consumer renders
 *   `<SignInPrompt>` from `pendingAuth`). Confirming stashes the product and goes
 *   to /login, which resumes straight into the chat.
 */
export function useStartChat() {
  const { user } = useAuth();
  const router = useRouter();
  const [starting, setStarting] = useState<string | null>(null);
  const [pendingAuth, setPendingAuth] = useState<{
    productId: string;
    draft?: string;
  } | null>(null);

  const start = useCallback(
    async (productId: string, draft?: string) => {
      if (!user) {
        // Don't redirect yet — ask first (feels intentional, not a glitch).
        setPendingAuth({ productId, draft });
        return;
      }
      setStarting(productId);
      try {
        const convo = await api.startConversation(productId);
        const q = draft ? `?draft=${encodeURIComponent(draft)}` : '';
        router.push(`/chat/${convo.id}${q}`);
      } finally {
        setStarting(null);
      }
    },
    [user, router],
  );

  const confirmSignIn = useCallback(() => {
    if (!pendingAuth) return;
    sessionStorage.setItem(PENDING_KEY, pendingAuth.productId);
    router.push('/login');
  }, [pendingAuth, router]);

  const dismissSignIn = useCallback(() => setPendingAuth(null), []);

  return { start, starting, pendingAuth, confirmSignIn, dismissSignIn };
}

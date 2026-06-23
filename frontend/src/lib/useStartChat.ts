'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';
import { api } from './api';
import { useAuth } from './auth';

/** Where we stash the product a logged-out visitor wanted, to resume after login. */
export const PENDING_KEY = 'pendingProductId';

/**
 * Shared "Chat with a specialist" action, used by the catalog and the product
 * page. If signed out → remember the product + go to /login (the catalog resumes
 * it after login). If signed in → find-or-create the conversation and open it.
 */
export function useStartChat() {
  const { user } = useAuth();
  const router = useRouter();
  const [starting, setStarting] = useState<string | null>(null);

  const start = useCallback(
    async (productId: string, draft?: string) => {
      if (!user) {
        sessionStorage.setItem(PENDING_KEY, productId);
        router.push('/login');
        return;
      }
      setStarting(productId);
      try {
        const convo = await api.startConversation(productId);
        // Optionally pre-fill the chat composer (e.g. with the chosen topic).
        const q = draft ? `?draft=${encodeURIComponent(draft)}` : '';
        router.push(`/chat/${convo.id}${q}`);
      } finally {
        setStarting(null);
      }
    },
    [user, router],
  );

  return { start, starting };
}

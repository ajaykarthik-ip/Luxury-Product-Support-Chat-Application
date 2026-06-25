'use client';

import ChatWindow from '@/components/ChatWindow';
import MaisonHeader from '@/components/MaisonHeader';
import { ArrowLeft } from '@/components/icons';
import { api } from '@/lib/api';
import { useAuth, useRequireAuth } from '@/lib/auth';
import { getSocket } from '@/lib/socket';
import type { Conversation, ConversationUpdate } from '@/lib/types';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

/** Customer's single-conversation chat view. */
export default function ChatPage() {
  // In Next 16 the `params` prop is a Promise; the useParams() hook reads it
  // synchronously in client components.
  const params = useParams<{ conversationId: string }>();
  const conversationId = params.conversationId;
  // Optional composer prefill passed from the product support page (chosen topic).
  const initialText = useSearchParams().get('draft') ?? '';

  const { user, loading } = useRequireAuth();
  const { token } = useAuth();
  const [conversation, setConversation] = useState<Conversation | null>(null);

  useEffect(() => {
    if (!user) return;
    api.getConversation(conversationId).then(setConversation).catch(() => {});
  }, [user, conversationId]);

  // Live header: reflect the agent + status the moment they change.
  useEffect(() => {
    if (!token) return;
    const socket = getSocket(token);
    const onUpdated = (u: ConversationUpdate) => {
      if (u.conversationId !== conversationId) return;
      setConversation((prev) =>
        prev
          ? {
              ...prev,
              agentId: u.agentId,
              agent: u.agent,
              status: u.status,
              rating: u.rating ?? null,
            }
          : prev,
      );
    };
    // On (re)connect, refetch so the header recovers any assignment/status
    // change that fired while the socket was down (mobile backgrounding).
    const refetch = () =>
      api.getConversation(conversationId).then(setConversation).catch(() => {});
    socket.on('connect', refetch);
    socket.on('conversation:updated', onUpdated);
    return () => {
      socket.off('connect', refetch);
      socket.off('conversation:updated', onUpdated);
    };
  }, [token, conversationId]);

  if (loading || !user) {
    return (
      <main className="flex h-dvh flex-1 items-center justify-center bg-ink">
        <p className="text-sm text-taupe">Loading…</p>
      </main>
    );
  }

  const resolved = conversation?.status === 'CLOSED';

  return (
    // Definite dynamic-viewport height (h-dvh) so the chat owns the full screen
    // and the composer stays pinned to the bottom — `dvh` also shrinks when the
    // mobile keyboard opens, so the input rides up with it.
    <div className="flex h-dvh flex-col overflow-hidden bg-ink text-bone">
      <MaisonHeader
        left={
          <Link
            href="/products"
            className="inline-flex items-center gap-1.5 rounded-full border border-bone/20 px-3 py-1 text-xs text-bone/80 transition hover:border-brass hover:text-brass"
          >
            <ArrowLeft /> Collections
          </Link>
        }
      />
      <div className="shrink-0 border-b border-bone/10 bg-umber px-6 py-3.5">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="truncate font-display text-xl tracking-tight text-bone">
              {conversation?.product?.name ?? 'Conversation'}
            </h1>
            <p className="mt-0.5 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.16em] text-taupe">
              {conversation?.agent ? (
                <>
                  <span className="h-1.5 w-1.5 rounded-full bg-sage" />
                  With {conversation.agent.name}
                </>
              ) : resolved ? (
                'Conversation resolved'
              ) : (
                <>
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brass motion-reduce:animate-none" />
                  Connecting you to a specialist
                </>
              )}
            </p>
          </div>
        </div>
      </div>
      <div className="min-h-0 flex-1">
        <ChatWindow
          conversationId={conversationId}
          initialText={initialText}
          status={conversation?.status}
          rating={conversation?.rating}
          variant="maison"
        />
      </div>
    </div>
  );
}

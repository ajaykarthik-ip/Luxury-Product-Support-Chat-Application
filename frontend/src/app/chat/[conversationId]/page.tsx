'use client';

import AppHeader from '@/components/AppHeader';
import ChatWindow from '@/components/ChatWindow';
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
          ? { ...prev, agentId: u.agentId, agent: u.agent, status: u.status }
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
      <main className="flex flex-1 items-center justify-center">
        <p className="text-sm text-neutral-400">Loading…</p>
      </main>
    );
  }

  return (
    // Definite dynamic-viewport height (h-dvh) so the chat owns the full screen
    // and the composer stays pinned to the bottom — `dvh` also shrinks when the
    // mobile keyboard opens, so the input rides up with it.
    <div className="flex h-dvh flex-col overflow-hidden">
      <AppHeader
        left={
          <Link
            href="/products"
            className="inline-flex items-center gap-1.5 rounded-full border border-stone-300 px-3 py-1 text-xs hover:bg-stone-100"
          >
            <ArrowLeft /> Products
          </Link>
        }
      />
      <div className="shrink-0 border-b border-stone-200 bg-white px-6 py-3">
        <h1 className="font-serif text-xl tracking-tight">
          {conversation?.product?.name ?? 'Conversation'}
        </h1>
        <p className="text-xs text-neutral-500">
          {conversation?.agent
            ? `Chatting with ${conversation.agent.name}`
            : 'Waiting for an agent to join…'}
        </p>
      </div>
      <div className="min-h-0 flex-1">
        <ChatWindow
          conversationId={conversationId}
          initialText={initialText}
          status={conversation?.status}
        />
      </div>
    </div>
  );
}

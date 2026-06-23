'use client';

import AppHeader from '@/components/AppHeader';
import ChatWindow from '@/components/ChatWindow';
import { api } from '@/lib/api';
import { useRequireAuth } from '@/lib/auth';
import type { Conversation } from '@/lib/types';
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
  const [conversation, setConversation] = useState<Conversation | null>(null);

  useEffect(() => {
    if (!user) return;
    api.getConversation(conversationId).then(setConversation).catch(() => {});
  }, [user, conversationId]);

  if (loading || !user) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <p className="text-sm text-neutral-400">Loading…</p>
      </main>
    );
  }

  return (
    <>
      <AppHeader
        left={
          <Link
            href="/products"
            className="rounded-full border border-stone-300 px-3 py-1 text-xs hover:bg-stone-100"
          >
            ← Products
          </Link>
        }
      />
      <div className="border-b border-stone-200 bg-white px-6 py-3">
        <h1 className="font-serif text-xl tracking-tight">
          {conversation?.product?.name ?? 'Conversation'}
        </h1>
        <p className="text-xs text-neutral-500">
          {conversation?.agent
            ? `With ${conversation.agent.name}`
            : 'Waiting for an agent to join…'}
        </p>
      </div>
      <div className="flex-1 min-h-0">
        <ChatWindow conversationId={conversationId} initialText={initialText} />
      </div>
    </>
  );
}

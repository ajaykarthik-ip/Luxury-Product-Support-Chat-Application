'use client';

import AppHeader from '@/components/AppHeader';
import ChatWindow from '@/components/ChatWindow';
import { api } from '@/lib/api';
import { useRequireAuth } from '@/lib/auth';
import type { Conversation } from '@/lib/types';
import { useCallback, useEffect, useState } from 'react';

/** Agent dashboard: every conversation as a thread (left), live chat (right). */
export default function AgentPage() {
  const { user, loading } = useRequireAuth('AGENT');

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newProduct, setNewProduct] = useState('');
  const [newImageUrl, setNewImageUrl] = useState('');
  const [newCategory, setNewCategory] = useState('');

  const load = useCallback(() => {
    api.getConversations().then(setConversations).catch(() => {});
  }, []);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  async function addProduct(e: React.FormEvent) {
    e.preventDefault();
    const name = newProduct.trim();
    if (!name) return;
    await api.createProduct({
      name,
      imageUrl: newImageUrl.trim() || undefined,
      category: newCategory.trim() || undefined,
    });
    setNewProduct('');
    setNewImageUrl('');
    setNewCategory('');
    setShowAdd(false);
  }

  if (loading || !user) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <p className="text-sm text-neutral-400">Loading…</p>
      </main>
    );
  }

  const selected = conversations.find((c) => c.id === selectedId) ?? null;

  return (
    <>
      <AppHeader />
      <div className="flex min-h-0 flex-1">
        {/* Threads sidebar */}
        <aside className="flex w-80 flex-col border-r border-stone-200 bg-white">
          <div className="flex items-center justify-between border-b border-stone-200 px-4 py-3">
            <h2 className="font-serif text-lg tracking-tight">Conversations</h2>
            <div className="flex gap-2">
              <button
                onClick={load}
                title="Refresh"
                className="rounded-full border border-stone-300 px-2 py-1 text-xs hover:bg-stone-100"
              >
                ↻
              </button>
              <button
                onClick={() => setShowAdd((s) => !s)}
                className="rounded-full border border-stone-300 px-2 py-1 text-xs hover:bg-stone-100"
              >
                + Product
              </button>
            </div>
          </div>

          {showAdd && (
            <form onSubmit={addProduct} className="space-y-2 border-b border-stone-200 p-3">
              <input
                value={newProduct}
                onChange={(e) => setNewProduct(e.target.value)}
                placeholder="New product name"
                className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-neutral-900"
              />
              <input
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                placeholder="Category (e.g. Timepieces)"
                className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-neutral-900"
              />
              <input
                value={newImageUrl}
                onChange={(e) => setNewImageUrl(e.target.value)}
                placeholder="Image URL (optional)"
                className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-neutral-900"
              />
              <button
                type="submit"
                className="w-full rounded-lg bg-neutral-900 py-1.5 text-xs font-medium text-stone-50 hover:bg-neutral-800"
              >
                Add product
              </button>
            </form>
          )}

          <div className="flex-1 overflow-y-auto">
            {conversations.length === 0 && (
              <p className="px-4 py-4 text-sm text-neutral-400">
                No conversations yet.
              </p>
            )}
            {conversations.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedId(c.id)}
                className={`flex w-full items-center gap-3 border-b border-stone-100 px-4 py-3 text-left hover:bg-stone-50 ${
                  selectedId === c.id ? 'bg-stone-100' : ''
                }`}
              >
                <span className="h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-neutral-100">
                  {c.product?.imageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={c.product.imageUrl}
                      alt={c.product.name}
                      className="h-full w-full object-cover"
                    />
                  )}
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-medium">
                    {c.product?.name}
                  </span>
                  <span className="block truncate text-xs text-neutral-500">
                    {c.customer?.name ?? 'Customer'}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </aside>

        {/* Chat pane */}
        <section className="flex min-w-0 flex-1 flex-col">
          {selected ? (
            <>
              <div className="border-b border-stone-200 bg-white px-6 py-3">
                <h1 className="font-serif text-xl tracking-tight">
                  {selected.product?.name}
                </h1>
                <p className="text-xs text-neutral-500">
                  Customer: {selected.customer?.name} · {selected.customer?.email}
                </p>
              </div>
              <div className="min-h-0 flex-1">
                {/* key forces a fresh mount per conversation (re-joins room, reloads history) */}
                <ChatWindow key={selected.id} conversationId={selected.id} />
              </div>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center">
              <p className="text-sm text-neutral-400">
                Select a conversation to start chatting.
              </p>
            </div>
          )}
        </section>
      </div>
    </>
  );
}

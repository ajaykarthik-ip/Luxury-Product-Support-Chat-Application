'use client';

import AppHeader from '@/components/AppHeader';
import ChatWindow from '@/components/ChatWindow';
import { api } from '@/lib/api';
import { useAuth, useRequireAuth } from '@/lib/auth';
import { ArrowLeft } from '@/components/icons';
import { getSocket } from '@/lib/socket';
import type {
  AgentView,
  Conversation,
  ConversationCounts,
  ConversationUpdate,
  ConversationStatus,
  Message,
} from '@/lib/types';
import { useCallback, useEffect, useRef, useState } from 'react';

const PAGE_SIZE = 30;
// Mirrors backend MAX_CONCURRENT_CHATS — shown as the agent's capacity.
const CAPACITY = 5;

const VIEWS: { key: AgentView; label: string }[] = [
  { key: 'mine', label: 'Mine' },
  { key: 'waiting', label: 'Waiting' },
  { key: 'all', label: 'All' },
  { key: 'closed', label: 'Closed' },
];

/** Compact "time since" for thread timestamps (now / 5m / 3h / 2d). */
function timeAgo(iso?: string | null): string {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

/** Does a conversation belong in the given view, given its status/owner? */
function belongsToView(
  view: AgentView,
  status: ConversationStatus,
  agentId: string | null,
  myId?: string,
): boolean {
  if (view === 'closed') return status === 'CLOSED';
  if (status !== 'OPEN') return false;
  if (view === 'mine') return agentId === myId;
  if (view === 'waiting') return agentId == null;
  return true; // 'all' open
}

/**
 * Agent dashboard — a real ticketing desk, not one giant list.
 *
 * Agents work a **view** (Mine / Waiting / All / Closed), paginated, with live
 * tab counts — mirroring Zendesk/Intercom. The socket keeps everything current:
 * `message:activity` bumps/previews threads, `conversation:updated` moves a thread
 * between views as it's assigned/claimed/released/resolved/reopened. Auto-routing
 * assigns the least-busy online agent on a customer's message; Claim/Release and
 * Resolve/Reopen are the manual controls.
 *
 * Responsive: desktop shows list + chat side by side; mobile shows the list, then
 * a full-screen chat with a back button.
 */
export default function AgentPage() {
  const { user, loading: authLoading } = useRequireAuth('AGENT');
  const { token } = useAuth();

  const [view, setView] = useState<AgentView>('mine');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState<ConversationCounts>({
    mine: 0,
    waiting: 0,
    all: 0,
    closed: 0,
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // The open conversation is held as its own object (not derived from the list),
  // so it stays open — with live-updating header controls — even when an action
  // moves it out of the current view (e.g. claiming from Waiting, resolving).
  const [selected, setSelected] = useState<Conversation | null>(null);
  const [unread, setUnread] = useState<Record<string, number>>({});
  const [live, setLive] = useState(false);
  const [available, setAvailable] = useState(true);
  const [loading, setLoading] = useState(true);
  const availableRef = useRef(true);
  availableRef.current = available;

  // Refs so the stable socket listener always reads fresh values.
  const viewRef = useRef(view);
  const selectedRef = useRef<string | null>(null);
  const idsRef = useRef<Set<string>>(new Set());
  const fetchingRef = useRef<Set<string>>(new Set());
  const countsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const myIdRef = useRef<string | undefined>(undefined);
  myIdRef.current = user?.id;
  useEffect(() => {
    viewRef.current = view;
  }, [view]);
  useEffect(() => {
    selectedRef.current = selectedId;
  }, [selectedId]);
  useEffect(() => {
    idsRef.current = new Set(conversations.map((c) => c.id));
  }, [conversations]);

  const refreshCounts = useCallback(() => {
    api.getConversationCounts().then(setCounts).catch(() => {});
  }, []);

  const scheduleCountsRefresh = useCallback(() => {
    if (countsTimer.current) clearTimeout(countsTimer.current);
    countsTimer.current = setTimeout(refreshCounts, 300);
  }, [refreshCounts]);

  // Load a view's first page whenever the view changes.
  useEffect(() => {
    if (!user) return;
    setLoading(true);
    api
      .getConversations({ view, skip: 0, take: PAGE_SIZE })
      .then((res) => {
        setConversations(res.items);
        setTotal(res.total);
      })
      .catch(() => {
        setConversations([]);
        setTotal(0);
      })
      .finally(() => setLoading(false));
  }, [user, view]);

  useEffect(() => {
    if (user) refreshCounts();
  }, [user, refreshCounts]);

  // Live cross-conversation updates.
  useEffect(() => {
    if (!token) return;
    const socket = getSocket(token);
    setLive(socket.connected);

    const onConnect = () => {
      setLive(true);
      // Re-assert our Available/Away choice (the server resets to available on a
      // fresh connection, so a reconnect while "Away" would otherwise drift).
      socket.emit('agent:status', { available: availableRef.current });
      // Recover anything missed while the socket was down: refresh tab counts
      // and reload the current view's first page.
      scheduleCountsRefresh();
      api
        .getConversations({ view: viewRef.current, skip: 0, take: PAGE_SIZE })
        .then((res) => {
          setConversations(res.items);
          setTotal(res.total);
        })
        .catch(() => {});
    };
    const onDisconnect = () => setLive(false);

    const onActivity = (msg: Message) => {
      if (idsRef.current.has(msg.conversationId)) {
        // Known thread → bump to top + refresh preview.
        setConversations((prev) => {
          const existing = prev.find((c) => c.id === msg.conversationId);
          if (!existing) return prev;
          return [
            { ...existing, lastMessage: msg, updatedAt: msg.createdAt },
            ...prev.filter((c) => c.id !== msg.conversationId),
          ];
        });
      } else if (!fetchingRef.current.has(msg.conversationId)) {
        // Unknown thread (new/returning) → fetch and add if it fits this view.
        fetchingRef.current.add(msg.conversationId);
        api
          .getConversation(msg.conversationId)
          .then((convo) => {
            if (
              belongsToView(
                viewRef.current,
                convo.status ?? 'OPEN',
                convo.agentId ?? null,
                myIdRef.current,
              )
            ) {
              setConversations((cur) =>
                cur.some((c) => c.id === convo.id)
                  ? cur
                  : [{ ...convo, lastMessage: msg }, ...cur],
              );
            }
          })
          .catch(() => {})
          .finally(() => fetchingRef.current.delete(msg.conversationId));
      }

      if (
        msg.sender?.role === 'CUSTOMER' &&
        msg.conversationId !== selectedRef.current
      ) {
        setUnread((u) => ({
          ...u,
          [msg.conversationId]: (u[msg.conversationId] ?? 0) + 1,
        }));
      }
      scheduleCountsRefresh();
    };

    const onUpdated = (u: ConversationUpdate) => {
      const belongs = belongsToView(
        viewRef.current,
        u.status,
        u.agentId,
        myIdRef.current,
      );
      // Keep the open chat's header controls correct after claim/resolve/etc.
      setSelected((prev) =>
        prev && prev.id === u.conversationId
          ? { ...prev, agentId: u.agentId, agent: u.agent, status: u.status }
          : prev,
      );

      if (idsRef.current.has(u.conversationId)) {
        setConversations((prev) =>
          belongs
            ? prev.map((c) =>
                c.id === u.conversationId
                  ? { ...c, agentId: u.agentId, agent: u.agent, status: u.status }
                  : c,
              )
            : prev.filter((c) => c.id !== u.conversationId),
        );
      } else if (belongs && !fetchingRef.current.has(u.conversationId)) {
        fetchingRef.current.add(u.conversationId);
        api
          .getConversation(u.conversationId)
          .then((convo) =>
            setConversations((cur) =>
              cur.some((c) => c.id === convo.id) ? cur : [convo, ...cur],
            ),
          )
          .catch(() => {})
          .finally(() => fetchingRef.current.delete(u.conversationId));
      }
      scheduleCountsRefresh();
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('message:activity', onActivity);
    socket.on('conversation:updated', onUpdated);
    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('message:activity', onActivity);
      socket.off('conversation:updated', onUpdated);
    };
  }, [token, scheduleCountsRefresh]);

  function selectConversation(conversation: Conversation) {
    setSelected(conversation);
    setSelectedId(conversation.id);
    setUnread((u) => (u[conversation.id] ? { ...u, [conversation.id]: 0 } : u));
  }

  function loadMore() {
    api
      .getConversations({ view, skip: conversations.length, take: PAGE_SIZE })
      .then((res) => {
        setConversations((prev) => {
          const ids = new Set(prev.map((c) => c.id));
          return [...prev, ...res.items.filter((i) => !ids.has(i.id))];
        });
        setTotal(res.total);
      })
      .catch(() => {});
  }

  function toggleAvailable() {
    const next = !available;
    setAvailable(next);
    if (token) getSocket(token).emit('agent:status', { available: next });
  }

  // Actions — the socket `conversation:updated` broadcast updates the list/counts.
  const claim = (id: string) => api.claimConversation(id).catch(() => {});
  const release = (id: string) => api.releaseConversation(id).catch(() => {});
  const resolve = (id: string) => api.resolveConversation(id).catch(() => {});
  const reopen = (id: string) => api.reopenConversation(id).catch(() => {});

  if (authLoading || !user) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <p className="text-sm text-neutral-400">Loading…</p>
      </main>
    );
  }

  // Routing + lifecycle buttons for the open ticket — reused in the chat header
  // (narrow screens) and the context panel (wide screens).
  const lifecycleActions = selected && (
    <div className="flex flex-wrap items-center gap-2">
      {selected.status === 'CLOSED' ? (
        <button
          onClick={() => reopen(selected.id)}
          className="rounded-full bg-neutral-900 px-4 py-1.5 text-xs font-medium text-stone-50 hover:bg-neutral-800"
        >
          Reopen ticket
        </button>
      ) : (
        <>
          {!selected.agentId ? (
            <button
              onClick={() => claim(selected.id)}
              className="rounded-full bg-neutral-900 px-4 py-1.5 text-xs font-medium text-stone-50 hover:bg-neutral-800"
            >
              Claim
            </button>
          ) : selected.agentId === user.id ? (
            <button
              onClick={() => release(selected.id)}
              title="Hand this chat back to the queue"
              className="rounded-full border border-stone-300 px-4 py-1.5 text-xs hover:bg-stone-100"
            >
              Release
            </button>
          ) : null}
          <button
            onClick={() => resolve(selected.id)}
            className="rounded-full border border-stone-300 px-4 py-1.5 text-xs font-medium hover:bg-stone-100"
          >
            Resolve
          </button>
        </>
      )}
    </div>
  );

  return (
    // Bounded to the dynamic viewport (h-dvh) so the inner panels scroll — not
    // the whole page — and the layout tracks the mobile keyboard / browser chrome.
    <div className="flex h-dvh flex-col">
      <AppHeader />
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Threads sidebar */}
        <aside
          className={`w-full flex-col border-r border-stone-200 bg-white md:flex md:w-96 ${
            selected ? 'hidden' : 'flex'
          }`}
        >
          <div className="border-b border-stone-200 px-4 py-3">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <h2 className="font-serif text-lg leading-tight tracking-tight">
                  Conversations
                </h2>
                <p className="flex items-center gap-1.5 text-[11px] text-neutral-400">
                  <span
                    title={live ? 'Connected' : 'Reconnecting…'}
                    className={`inline-block h-1.5 w-1.5 rounded-full ${
                      live ? 'bg-green-500' : 'bg-neutral-300'
                    }`}
                  />
                  {available
                    ? `Handling ${counts.mine}/${CAPACITY}`
                    : 'Away — routing paused'}
                </p>
              </div>
              {/* Availability switch — gates auto-routing to this agent */}
              <button
                onClick={toggleAvailable}
                role="switch"
                aria-checked={available}
                aria-label="Availability"
                title={
                  available
                    ? 'Available — new chats route to you. Click to go Away.'
                    : 'Away — no new chats. Click to become Available.'
                }
                className="flex shrink-0 items-center gap-2"
              >
                <span
                  className={`text-xs font-medium ${
                    available ? 'text-green-700' : 'text-neutral-400'
                  }`}
                >
                  {available ? 'Available' : 'Away'}
                </span>
                <span
                  className={`relative h-5 w-9 rounded-full transition-colors ${
                    available ? 'bg-green-500' : 'bg-stone-300'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-all ${
                      available ? 'left-[1.125rem]' : 'left-0.5'
                    }`}
                  />
                </span>
              </button>
            </div>

            {/* View tabs with live counts — share the width, no scrollbar */}
            <div className="mt-3 flex gap-1">
              {VIEWS.map((v) => (
                <button
                  key={v.key}
                  onClick={() => setView(v.key)}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-full px-2 py-1 text-xs transition ${
                    view === v.key
                      ? 'bg-neutral-900 text-stone-50'
                      : 'text-neutral-600 hover:bg-stone-100'
                  }`}
                >
                  {v.label}
                  <span
                    className={`rounded-full px-1 text-[10px] tabular-nums ${
                      view === v.key
                        ? 'bg-white/20 text-stone-100'
                        : 'bg-stone-100 text-neutral-500'
                    }`}
                  >
                    {counts[v.key]}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <p className="px-4 py-4 text-sm text-neutral-400">Loading…</p>
            ) : conversations.length === 0 ? (
              <p className="px-4 py-4 text-sm text-neutral-400">
                {view === 'waiting'
                  ? 'No chats waiting. 🎉'
                  : view === 'mine'
                    ? 'No chats assigned to you yet.'
                    : view === 'closed'
                      ? 'No resolved chats.'
                      : 'No conversations yet.'}
              </p>
            ) : (
              <>
                {conversations.map((c) => {
                  const count = unread[c.id] ?? 0;
                  const isSelected = selectedId === c.id;
                  const preview = c.lastMessage?.content;
                  return (
                    <button
                      key={c.id}
                      onClick={() => selectConversation(c)}
                      className={`flex w-full items-start gap-3 border-b border-stone-100 px-4 py-3 text-left transition hover:bg-stone-50 ${
                        isSelected ? 'bg-stone-100' : ''
                      }`}
                    >
                      <span className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-neutral-100">
                        {c.product?.imageUrl && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={c.product.imageUrl}
                            alt={c.product.name ?? ''}
                            className="h-full w-full object-cover"
                          />
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline justify-between gap-2">
                          <span
                            className={`truncate text-sm ${
                              count > 0 ? 'font-semibold' : 'font-medium'
                            }`}
                          >
                            {c.product?.name}
                          </span>
                          <span className="shrink-0 text-[10px] text-neutral-400">
                            {timeAgo(c.lastMessage?.createdAt ?? c.updatedAt)}
                          </span>
                        </span>
                        <span className="flex items-center gap-1.5 text-xs text-neutral-500">
                          <span className="truncate">
                            {c.customer?.name ?? 'Customer'}
                          </span>
                          {c.status === 'CLOSED' ? (
                            <span className="shrink-0 rounded-full bg-stone-200 px-1.5 text-[10px] font-medium text-stone-600">
                              Resolved
                            </span>
                          ) : !c.agentId ? (
                            <span className="shrink-0 rounded-full bg-amber-100 px-1.5 text-[10px] font-medium text-amber-700">
                              Waiting
                            </span>
                          ) : c.agentId === user.id ? (
                            <span className="shrink-0 rounded-full bg-green-100 px-1.5 text-[10px] font-medium text-green-700">
                              You
                            </span>
                          ) : (
                            <span className="shrink-0 truncate text-[10px] text-neutral-400">
                              · {c.agent?.name}
                            </span>
                          )}
                        </span>
                        <span className="mt-0.5 flex items-center gap-2">
                          <span
                            className={`block min-w-0 flex-1 truncate text-xs ${
                              count > 0 ? 'text-neutral-700' : 'text-neutral-400'
                            }`}
                          >
                            {preview ?? 'No messages yet'}
                          </span>
                          {count > 0 && (
                            <span className="shrink-0 rounded-full bg-amber-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                              {count}
                            </span>
                          )}
                        </span>
                      </span>
                    </button>
                  );
                })}
                {conversations.length < total && (
                  <button
                    onClick={loadMore}
                    className="w-full px-4 py-3 text-center text-xs font-medium text-neutral-600 hover:bg-stone-50"
                  >
                    Load more ({conversations.length} of {total})
                  </button>
                )}
              </>
            )}
          </div>
        </aside>

        {/* Chat + context */}
        <section
          className={`min-w-0 flex-1 ${selected ? 'flex' : 'hidden md:flex'}`}
        >
          {selected ? (
            <>
              {/* Center: the conversation */}
              <div className="flex min-w-0 flex-1 flex-col">
                <div className="flex items-center gap-3 border-b border-stone-200 bg-white px-4 py-3 md:px-6">
                  <button
                    onClick={() => {
                      setSelected(null);
                      setSelectedId(null);
                    }}
                    className="flex items-center rounded-full border border-stone-300 px-2 py-1.5 hover:bg-stone-100 md:hidden"
                    aria-label="Back to conversations"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                  <div className="min-w-0 flex-1">
                    <h1 className="truncate font-serif text-lg leading-tight tracking-tight md:text-xl">
                      {selected.product?.name}
                    </h1>
                    <p className="truncate text-xs text-neutral-500">
                      {selected.customer?.name}
                    </p>
                  </div>
                  <StatusBadge status={selected.status} />
                  {/* Actions live in the context panel on wide screens; show a
                      compact copy here when that panel is hidden. */}
                  <div className="xl:hidden">{lifecycleActions}</div>
                </div>
                <div className="min-h-0 flex-1">
                  <ChatWindow
                    key={selected.id}
                    conversationId={selected.id}
                    status={selected.status}
                  />
                </div>
              </div>

              {/* Right: context panel (wide screens) */}
              <aside className="hidden w-72 shrink-0 flex-col gap-5 overflow-y-auto border-l border-stone-200 bg-white p-5 xl:flex">
                <div>
                  <h3 className="mb-2 text-[11px] font-medium uppercase tracking-wider text-neutral-400">
                    Product
                  </h3>
                  <div className="flex items-center gap-3">
                    <span className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-neutral-100">
                      {selected.product?.imageUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={selected.product.imageUrl}
                          alt={selected.product.name ?? ''}
                          className="h-full w-full object-cover"
                        />
                      )}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {selected.product?.name}
                      </p>
                      {selected.product?.category && (
                        <p className="truncate text-xs text-neutral-400">
                          {selected.product.category}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="mb-2 text-[11px] font-medium uppercase tracking-wider text-neutral-400">
                    Customer
                  </h3>
                  <p className="text-sm font-medium">{selected.customer?.name}</p>
                  <p className="truncate text-xs text-neutral-500">
                    {selected.customer?.email}
                  </p>
                </div>

                <div>
                  <h3 className="mb-2 text-[11px] font-medium uppercase tracking-wider text-neutral-400">
                    Ticket
                  </h3>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-neutral-500">Status</span>
                    <StatusBadge status={selected.status} />
                  </div>
                  <div className="mt-1.5 flex items-center justify-between text-sm">
                    <span className="text-neutral-500">Assigned</span>
                    <span className="text-xs font-medium">
                      {!selected.agentId
                        ? 'Waiting'
                        : selected.agentId === user.id
                          ? 'You'
                          : (selected.agent?.name ?? 'Agent')}
                    </span>
                  </div>
                  <div className="mt-1.5 flex items-center justify-between text-sm">
                    <span className="text-neutral-500">Opened</span>
                    <span className="text-xs text-neutral-500">
                      {timeAgo(selected.createdAt) === 'now'
                        ? 'just now'
                        : `${timeAgo(selected.createdAt)} ago`}
                    </span>
                  </div>
                </div>

                <div className="mt-auto border-t border-stone-100 pt-4">
                  {lifecycleActions}
                </div>
              </aside>
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
    </div>
  );
}

/** Small Open / Resolved pill. */
function StatusBadge({ status }: { status?: ConversationStatus }) {
  const closed = status === 'CLOSED';
  return (
    <span
      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
        closed
          ? 'bg-stone-100 text-stone-500'
          : 'bg-green-100 text-green-700'
      }`}
    >
      {closed ? 'Resolved' : 'Open'}
    </span>
  );
}



'use client';

import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import type { ConversationStatus, ConversationUpdate, Message } from '@/lib/types';
import { useEffect, useRef, useState } from 'react';

/** Message timestamp: "2:45 PM" today, else "Jun 24 · 2:45 PM". */
function formatTime(iso: string): string {
  const d = new Date(iso);
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const sameDay = d.toDateString() === new Date().toDateString();
  return sameDay
    ? time
    : `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })} · ${time}`;
}

/**
 * The real-time chat panel, shared by the customer chat page and the agent
 * dashboard. Given a conversationId it:
 *   1. loads history over REST,
 *   2. joins the conversation's socket room,
 *   3. appends any `message:new` the gateway broadcasts,
 *   4. sends new messages over the socket.
 *
 * The server echoes our own message back via the room, so we don't append
 * optimistically — we just render whatever the DB-backed broadcast gives us
 * (dedup by id guards against any double-delivery).
 *
 * Content is width-constrained (max-w-2xl, centered) for readability — chat lines
 * shouldn't stretch across a wide pane. When the ticket is `CLOSED`, the composer
 * locks for agents (reopen to reply) and shows a reopen hint for customers (whose
 * next message auto-reopens it).
 */
export default function ChatWindow({
  conversationId,
  initialText = '',
  status = 'OPEN',
}: {
  conversationId: string;
  initialText?: string;
  status?: ConversationStatus;
}) {
  const { user, token } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState(initialText);
  const [loading, setLoading] = useState(true);
  // Ephemeral "X joined" system lines (not persisted — just live feedback).
  const [notices, setNotices] = useState<
    { id: string; text: string; createdAt: string }[]
  >([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  const isAgent = user?.role === 'AGENT';
  const resolved = status === 'CLOSED';
  const lockComposer = resolved && isAgent;

  // 1. Load history whenever the conversation changes.
  useEffect(() => {
    let active = true;
    setLoading(true);
    api
      .getMessages(conversationId)
      .then((msgs) => active && setMessages(msgs))
      .catch(() => active && setMessages([]))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [conversationId]);

  // 2 + 3. Join the room and listen for live messages.
  useEffect(() => {
    if (!token) return;
    const socket = getSocket(token);

    const onNew = (msg: Message) => {
      if (msg.conversationId !== conversationId) return;
      setMessages((prev) =>
        prev.some((m) => m.id === msg.id) ? prev : [...prev, msg],
      );
    };

    // Live system notices: agent joined, or the ticket was resolved/reopened.
    const addNotice = (id: string, text: string) =>
      setNotices((prev) =>
        prev.some((n) => n.id === id)
          ? prev
          : [...prev, { id, text, createdAt: new Date().toISOString() }],
      );

    const onUpdated = (u: ConversationUpdate) => {
      if (u.conversationId !== conversationId) return;
      if (u.agent)
        addNotice(`joined-${u.agent.id}`, `${u.agent.name} joined the conversation`);
      if (u.status === 'CLOSED')
        addNotice(
          `closed-${new Date().toISOString()}`,
          'This conversation was marked resolved',
        );
    };

    socket.emit('conversation:join', { conversationId });
    socket.on('message:new', onNew);
    socket.on('conversation:updated', onUpdated);

    return () => {
      socket.emit('conversation:leave', { conversationId });
      socket.off('message:new', onNew);
      socket.off('conversation:updated', onUpdated);
    };
  }, [conversationId, token]);

  // Keep the view pinned to the newest message (or notice).
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, notices]);

  function send(e: React.FormEvent) {
    e.preventDefault();
    const content = text.trim();
    if (!content || !token) return;
    getSocket(token).emit('message:send', { conversationId, content });
    setText('');
  }

  // Merge real messages and ephemeral system notices into one time-ordered stream.
  const stream = [
    ...messages.map((m) => ({ kind: 'message' as const, at: m.createdAt, m })),
    ...notices.map((n) => ({ kind: 'notice' as const, at: n.createdAt, n })),
  ].sort((a, b) => a.at.localeCompare(b.at));

  return (
    <div className="flex h-full flex-col bg-stone-50">
      {/* Messages — full-width scroll area, content centered & width-capped.
          `min-h-0` lets this flex child shrink so it scrolls instead of pushing
          the composer off-screen. */}
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto max-w-2xl space-y-3">
          {loading ? (
            <p className="text-sm text-neutral-400">Loading conversation…</p>
          ) : stream.length === 0 ? (
            <p className="text-sm text-neutral-400">
              No messages yet. Say hello to start the conversation.
            </p>
          ) : (
            stream.map((item) => {
              if (item.kind === 'notice') {
                return (
                  <p
                    key={item.n.id}
                    className="text-center text-xs text-neutral-400"
                  >
                    {item.n.text}
                  </p>
                );
              }
              const m = item.m;
              const mine = m.senderId === user?.id;
              return (
                <div
                  key={m.id}
                  className={`flex ${mine ? 'justify-end' : 'justify-start'}`}
                >
                  <div className="max-w-[75%]">
                    {!mine && (
                      <span className="mb-1 ml-1 block text-xs text-neutral-500">
                        {m.sender?.name}
                        {m.sender?.role === 'AGENT' && (
                          <span className="ml-1 text-amber-700">· Agent</span>
                        )}
                      </span>
                    )}
                    <div
                      className={`rounded-2xl px-4 py-2 text-sm leading-relaxed shadow-sm ${
                        mine
                          ? 'rounded-br-sm bg-neutral-900 text-stone-50'
                          : 'rounded-bl-sm border border-stone-200 bg-white text-neutral-800'
                      }`}
                    >
                      {m.content}
                    </div>
                    <span
                      className={`mt-1 block text-[10px] text-neutral-400 ${
                        mine ? 'text-right' : 'ml-1 text-left'
                      }`}
                    >
                      {formatTime(m.createdAt)}
                    </span>
                  </div>
                </div>
              );
            })
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Composer (or resolved state) — `shrink-0` keeps it from collapsing;
          the bottom padding respects the device safe area (home-bar gesture
          pill / notch) so the input isn't tucked under it. */}
      <div className="shrink-0 border-t border-stone-200 bg-white px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto max-w-2xl">
          {resolved && (
            <p className="mb-2 flex items-center justify-center gap-1.5 text-xs text-neutral-400">
              <span className="text-green-600">✓</span>
              {isAgent
                ? 'This ticket is resolved. Reopen it to reply.'
                : 'This conversation was resolved. Send a message to reopen it.'}
            </p>
          )}
          {!lockComposer && (
            <form onSubmit={send} className="flex gap-2">
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Type a message…"
                className="flex-1 rounded-full border border-stone-300 px-4 py-2 text-sm outline-none focus:border-neutral-900"
              />
              <button
                type="submit"
                disabled={!text.trim()}
                className="rounded-full bg-neutral-900 px-5 py-2 text-sm font-medium text-stone-50 hover:bg-neutral-800 disabled:opacity-40"
              >
                Send
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

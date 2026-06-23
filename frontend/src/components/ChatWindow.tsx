'use client';

import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import type { Message } from '@/lib/types';
import { useEffect, useRef, useState } from 'react';

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
 */
export default function ChatWindow({
  conversationId,
  initialText = '',
}: {
  conversationId: string;
  initialText?: string;
}) {
  const { user, token } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState(initialText);
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

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

    socket.emit('conversation:join', { conversationId });
    socket.on('message:new', onNew);

    return () => {
      socket.emit('conversation:leave', { conversationId });
      socket.off('message:new', onNew);
    };
  }, [conversationId, token]);

  // Keep the view pinned to the newest message.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  function send(e: React.FormEvent) {
    e.preventDefault();
    const content = text.trim();
    if (!content || !token) return;
    getSocket(token).emit('message:send', { conversationId, content });
    setText('');
  }

  return (
    <div className="flex flex-col h-full bg-stone-50">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-3">
        {loading ? (
          <p className="text-sm text-neutral-400">Loading conversation…</p>
        ) : messages.length === 0 ? (
          <p className="text-sm text-neutral-400">
            No messages yet. Say hello to start the conversation.
          </p>
        ) : (
          messages.map((m) => {
            const mine = m.senderId === user?.id;
            return (
              <div
                key={m.id}
                className={`flex ${mine ? 'justify-end' : 'justify-start'}`}
              >
                <div className="max-w-[75%]">
                  {!mine && (
                    <span className="block text-xs text-neutral-500 mb-1 ml-1">
                      {m.sender?.name}
                      {m.sender?.role === 'AGENT' && (
                        <span className="ml-1 text-amber-700">· Agent</span>
                      )}
                    </span>
                  )}
                  <div
                    className={`rounded-2xl px-4 py-2 text-sm leading-relaxed shadow-sm ${
                      mine
                        ? 'bg-neutral-900 text-stone-50 rounded-br-sm'
                        : 'bg-white text-neutral-800 border border-stone-200 rounded-bl-sm'
                    }`}
                  >
                    {m.content}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Composer */}
      <form
        onSubmit={send}
        className="border-t border-stone-200 bg-white px-4 py-3 flex gap-2"
      >
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
    </div>
  );
}

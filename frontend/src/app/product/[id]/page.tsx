'use client';

import AppHeader from '@/components/AppHeader';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { Product } from '@/lib/types';
import { PENDING_KEY, useStartChat } from '@/lib/useStartChat';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

// Canned common-issue topics (Apple-style). Static — no DB needed.
const TOPICS = [
  'Warranty & Servicing',
  'Sizing & Fit',
  'Repairs',
  'Authentication',
  'Order & Delivery',
];

export default function ProductPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const { start, starting } = useStartChat();

  const [product, setProduct] = useState<Product | null>(null);
  const [missing, setMissing] = useState(false);

  const [topic, setTopic] = useState<string | null>(null);
  const [mode, setMode] = useState<'choose' | 'callback' | 'done'>('choose');
  const [issue, setIssue] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [doneConvoId, setDoneConvoId] = useState<string | null>(null);

  useEffect(() => {
    api.getProduct(id).then(setProduct).catch(() => setMissing(true));
  }, [id]);

  const backLink = (
    <Link
      href="/products"
      className="rounded-full border border-neutral-300 px-3 py-1 text-xs hover:bg-neutral-100"
    >
      ← Collection
    </Link>
  );

  function chatNow() {
    if (!product) return;
    start(product.id, topic ? `Regarding ${topic}: ` : undefined);
  }

  async function submitCallback() {
    if (!product) return;
    if (!user) {
      // Need an account to log the request — send to login, resume to catalog.
      sessionStorage.setItem(PENDING_KEY, product.id);
      router.push('/login');
      return;
    }
    const text = issue.trim();
    if (!text) return;
    setSubmitting(true);
    try {
      const convo = await api.startConversation(product.id);
      const body = `📞 Callback requested${topic ? ` · ${topic}` : ''}\n\n${text}`;
      await api.sendMessage(convo.id, body);
      setDoneConvoId(convo.id);
      setMode('done');
    } finally {
      setSubmitting(false);
    }
  }

  if (missing) {
    return (
      <>
        <AppHeader left={backLink} />
        <main className="flex flex-1 items-center justify-center">
          <p className="text-sm text-neutral-400">Product not found.</p>
        </main>
      </>
    );
  }

  if (!product) {
    return (
      <>
        <AppHeader left={backLink} />
        <main className="flex flex-1 items-center justify-center">
          <p className="text-sm text-neutral-400">Loading…</p>
        </main>
      </>
    );
  }

  // Back to the product's own category (falls back to collections).
  const categoryLink = (
    <Link
      href={
        product.category
          ? `/category/${encodeURIComponent(product.category)}`
          : '/products'
      }
      className="rounded-full border border-neutral-300 px-3 py-1 text-xs hover:bg-neutral-100"
    >
      ← {product.category ?? 'Collection'}
    </Link>
  );

  return (
    <>
      <AppHeader left={categoryLink} />
      <main className="mx-auto grid w-full max-w-6xl flex-1 grid-cols-1 gap-10 px-6 py-12 lg:grid-cols-2 lg:gap-16">
        {/* Image */}
        <div className="aspect-[4/5] w-full overflow-hidden rounded-3xl bg-neutral-100">
          {product.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={product.imageUrl}
              alt={product.name}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-neutral-300">
              No image
            </div>
          )}
        </div>

        {/* Support panel */}
        <div className="flex flex-col justify-center">
          {product.category && (
            <span className="text-xs font-medium uppercase tracking-[0.2em] text-neutral-400">
              {product.category}
            </span>
          )}
          <h1 className="mt-2 font-serif text-4xl tracking-tight sm:text-5xl">
            {product.name}
          </h1>
          {product.description && (
            <p className="mt-4 text-base leading-relaxed text-neutral-500">
              {product.description}
            </p>
          )}

          {mode === 'done' ? (
            // Confirmation after a callback request
            <div className="mt-8 rounded-2xl border border-neutral-200 bg-neutral-50 p-6">
              <h2 className="font-serif text-2xl tracking-tight">
                Request received
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-neutral-600">
                Thank you. A specialist will review your note about{' '}
                <strong>{product.name}</strong> and follow up shortly. You can
                also continue the conversation now.
              </p>
              <div className="mt-5 flex gap-3">
                {doneConvoId && (
                  <Link
                    href={`/chat/${doneConvoId}`}
                    className="rounded-full bg-neutral-900 px-6 py-2.5 text-sm font-medium text-white hover:bg-neutral-700"
                  >
                    Open conversation
                  </Link>
                )}
                <Link
                  href="/products"
                  className="rounded-full border border-neutral-300 px-6 py-2.5 text-sm font-medium hover:bg-neutral-100"
                >
                  Back to collection
                </Link>
              </div>
            </div>
          ) : (
            <>
              {/* Topic chips */}
              <div className="mt-8">
                <h2 className="text-sm font-medium text-neutral-700">
                  What can we help with?
                </h2>
                <div className="mt-3 flex flex-wrap gap-2">
                  {TOPICS.map((t) => (
                    <button
                      key={t}
                      onClick={() => setTopic(topic === t ? null : t)}
                      className={`rounded-full border px-4 py-1.5 text-sm transition ${
                        topic === t
                          ? 'border-neutral-900 bg-neutral-900 text-white'
                          : 'border-neutral-300 text-neutral-700 hover:border-neutral-900'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Contact options (Apple-style) */}
              <div className="mt-8">
                <h2 className="text-sm font-medium text-neutral-700">
                  Contact Options
                </h2>

                {mode === 'choose' && (
                  <div className="mt-3 space-y-3">
                    {/* Live Chat */}
                    <button
                      onClick={chatNow}
                      disabled={starting === product.id}
                      className="flex w-full items-center gap-4 rounded-2xl border border-neutral-200 px-5 py-4 text-left transition hover:border-neutral-900 hover:shadow-sm disabled:opacity-50"
                    >
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-lg text-white">
                        💬
                      </span>
                      <span className="min-w-0">
                        <span className="block font-medium">Live Chat</span>
                        <span className="block text-sm text-neutral-500">
                          Start a real-time conversation with a DU specialist
                        </span>
                        <span className="mt-1 flex items-center gap-1.5 text-xs text-green-600">
                          <span className="inline-block h-2 w-2 rounded-full bg-green-500" />
                          Available now
                        </span>
                      </span>
                    </button>

                    {/* Callback */}
                    <button
                      onClick={() => setMode('callback')}
                      className="flex w-full items-center gap-4 rounded-2xl border border-neutral-200 px-5 py-4 text-left transition hover:border-neutral-900 hover:shadow-sm"
                    >
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-lg">
                        📞
                      </span>
                      <span className="min-w-0">
                        <span className="block font-medium">
                          Request a Callback
                        </span>
                        <span className="block text-sm text-neutral-500">
                          Describe your issue and a specialist will reach out
                        </span>
                      </span>
                    </button>
                  </div>
                )}

                {mode === 'callback' && (
                  <div className="mt-3">
                    <textarea
                      value={issue}
                      onChange={(e) => setIssue(e.target.value)}
                      rows={4}
                      placeholder={
                        topic
                          ? `Tell us about your ${topic.toLowerCase()} question…`
                          : 'Describe your issue…'
                      }
                      className="w-full rounded-2xl border border-neutral-300 px-4 py-3 text-sm outline-none focus:border-neutral-900"
                    />
                    <div className="mt-3 flex gap-3">
                      <button
                        onClick={submitCallback}
                        disabled={submitting || !issue.trim()}
                        className="rounded-full bg-neutral-900 px-6 py-2.5 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-50"
                      >
                        {submitting ? 'Sending…' : 'Submit request'}
                      </button>
                      <button
                        onClick={() => setMode('choose')}
                        className="rounded-full border border-neutral-300 px-6 py-2.5 text-sm font-medium hover:bg-neutral-100"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <p className="mt-6 text-xs text-neutral-400">
                Complimentary shipping · 2-year warranty · Lifetime servicing
              </p>
            </>
          )}
        </div>
      </main>
    </>
  );
}

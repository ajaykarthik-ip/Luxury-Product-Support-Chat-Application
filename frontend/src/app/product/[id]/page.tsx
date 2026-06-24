'use client';

import AppHeader from '@/components/AppHeader';
import Eyebrow from '@/components/Eyebrow';
import SignInPrompt from '@/components/SignInPrompt';
import { ArrowLeft } from '@/components/icons';
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
  const { start, starting, pendingAuth, confirmSignIn, dismissSignIn } =
    useStartChat();

  const [product, setProduct] = useState<Product | null>(null);
  const [missing, setMissing] = useState(false);

  const [topic, setTopic] = useState<string | null>(null);
  const [mode, setMode] = useState<'choose' | 'callback' | 'done'>('choose');
  const [issue, setIssue] = useState('');
  const [cbName, setCbName] = useState('');
  const [cbEmail, setCbEmail] = useState('');
  const [cbPhone, setCbPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [doneConvoId, setDoneConvoId] = useState<string | null>(null);

  useEffect(() => {
    api.getProduct(id).then(setProduct).catch(() => setMissing(true));
  }, [id]);

  // Prefill name/email from the signed-in customer (they can still edit).
  useEffect(() => {
    if (user) {
      setCbName((n) => n || user.name);
      setCbEmail((e) => e || user.email);
    }
  }, [user]);

  const backLink = (
    <Link
      href="/products"
      className="inline-flex items-center gap-1.5 rounded-full border border-neutral-300 px-3 py-1 text-xs hover:bg-neutral-100"
    >
      <ArrowLeft /> Collection
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
    if (!text || !cbPhone.trim()) return;
    setSubmitting(true);
    try {
      const convo = await api.startConversation(product.id);
      const details = [
        cbName.trim() && `Name: ${cbName.trim()}`,
        cbEmail.trim() && `Email: ${cbEmail.trim()}`,
        cbPhone.trim() && `Phone: ${cbPhone.trim()}`,
      ]
        .filter(Boolean)
        .join('\n');
      const body = `📞 Callback requested${topic ? ` · ${topic}` : ''}\n${details}\n\n${text}`;
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
      className="inline-flex items-center gap-1.5 rounded-full border border-neutral-300 px-3 py-1 text-xs hover:bg-neutral-100"
    >
      <ArrowLeft /> {product.category ?? 'Collection'}
    </Link>
  );

  return (
    <>
      <AppHeader left={categoryLink} />
      <main className="mx-auto grid w-full max-w-6xl flex-1 grid-cols-1 gap-10 px-6 py-12 lg:grid-cols-2 lg:gap-16">
        {/* Image */}
        <div className="aspect-[4/5] w-full overflow-hidden rounded-2xl bg-neutral-100 ring-1 ring-neutral-200/70">
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
          {product.category && <Eyebrow>{product.category}</Eyebrow>}
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

              {/* Contact options (Apple-support style) */}
              <div className="mt-8">
                <h2 className="text-xs font-medium uppercase tracking-[0.18em] text-neutral-400">
                  Contact Options
                </h2>

                {mode === 'choose' && (
                  <div className="mt-4 space-y-3">
                    {/* Live Chat */}
                    <button
                      onClick={chatNow}
                      disabled={starting === product.id}
                      className="group flex w-full items-center gap-4 rounded-2xl border border-neutral-200/80 bg-white px-5 py-4 text-left shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-all duration-200 hover:-translate-y-0.5 hover:border-neutral-300 hover:shadow-[0_12px_28px_-12px_rgba(0,0,0,0.18)] disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
                    >
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-white">
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={1.8}
                          className="h-[22px] w-[22px]"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M8 10.5h8M8 14h5m8-2c0 4.418-4.03 8-9 8a9.77 9.77 0 0 1-4-.85L3 20l1.4-3.5A7.8 7.8 0 0 1 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8Z"
                          />
                        </svg>
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[15px] font-semibold tracking-tight text-neutral-900">
                          Live Chat
                        </span>
                        <span className="mt-0.5 block text-[13px] leading-snug text-neutral-500">
                          Start a real-time conversation with a DU specialist
                        </span>
                        <span className="mt-1.5 flex items-center gap-1.5 text-[13px] font-medium text-green-600">
                          <span className="h-2 w-2 rounded-full bg-green-500" />
                          Available now
                        </span>
                      </span>
                      <ChevronRight />
                    </button>

                    {/* Call for Support */}
                    <button
                      onClick={() => setMode('callback')}
                      className="group flex w-full items-center gap-4 rounded-2xl border border-neutral-200/80 bg-white px-5 py-4 text-left shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-all duration-200 hover:-translate-y-0.5 hover:border-neutral-300 hover:shadow-[0_12px_28px_-12px_rgba(0,0,0,0.18)]"
                    >
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-neutral-700">
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={1.8}
                          className="h-[22px] w-[22px]"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z"
                          />
                        </svg>
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[15px] font-semibold tracking-tight text-neutral-900">
                          Call for Support
                        </span>
                        <span className="mt-0.5 block text-[13px] leading-snug text-neutral-500">
                          Describe your issue and a specialist will reach out
                        </span>
                      </span>
                      <ChevronRight />
                    </button>
                  </div>
                )}

                {mode === 'callback' && (
                  <div className="mt-3 space-y-2.5">
                    <input
                      value={cbName}
                      onChange={(e) => setCbName(e.target.value)}
                      placeholder="Full name"
                      className="w-full rounded-xl border border-neutral-300 px-3.5 py-2 text-sm outline-none focus:border-neutral-900"
                    />
                    <div className="grid grid-cols-2 gap-2.5">
                      <input
                        type="email"
                        value={cbEmail}
                        onChange={(e) => setCbEmail(e.target.value)}
                        placeholder="Email"
                        className="w-full rounded-xl border border-neutral-300 px-3.5 py-2 text-sm outline-none focus:border-neutral-900"
                      />
                      <input
                        type="tel"
                        value={cbPhone}
                        onChange={(e) => setCbPhone(e.target.value)}
                        placeholder="Phone number"
                        className="w-full rounded-xl border border-neutral-300 px-3.5 py-2 text-sm outline-none focus:border-neutral-900"
                      />
                    </div>
                    <textarea
                      value={issue}
                      onChange={(e) => setIssue(e.target.value)}
                      rows={3}
                      placeholder={
                        topic
                          ? `Tell us about your ${topic.toLowerCase()} question…`
                          : 'Describe your issue…'
                      }
                      className="w-full rounded-xl border border-neutral-300 px-3.5 py-2.5 text-sm outline-none focus:border-neutral-900"
                    />
                    <div className="flex gap-3 pt-0.5">
                      <button
                        onClick={submitCallback}
                        disabled={submitting || !issue.trim() || !cbPhone.trim()}
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
                Real-time specialists · 2-year aftercare · Lifetime servicing
              </p>
            </>
          )}
        </div>
      </main>

      <SignInPrompt
        open={!!pendingAuth}
        productName={product.name}
        onConfirm={confirmSignIn}
        onCancel={dismissSignIn}
      />
    </>
  );
}

/** Trailing chevron that nudges right on card hover. */
function ChevronRight() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      className="h-4 w-4 shrink-0 text-neutral-300 transition-all duration-200 group-hover:translate-x-0.5 group-hover:text-neutral-500"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  );
}

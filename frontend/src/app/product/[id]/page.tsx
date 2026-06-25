'use client';

import Eyebrow from '@/components/Eyebrow';
import MaisonHeader from '@/components/MaisonHeader';
import MaisonShell from '@/components/MaisonShell';
import SignInPrompt from '@/components/SignInPrompt';
import { ArrowLeft } from '@/components/icons';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { Product } from '@/lib/types';
import { PENDING_KEY, useStartChat } from '@/lib/useStartChat';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

// Canned common-issue topics. Static — no DB needed.
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
      className="inline-flex items-center gap-1.5 rounded-full border border-bone/20 px-3 py-1 text-xs text-bone/80 transition hover:border-brass hover:text-brass"
    >
      <ArrowLeft /> Collections
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
      const body = `Callback requested${topic ? ` (${topic})` : ''}\n${details}\n\n${text}`;
      await api.sendMessage(convo.id, body);
      setDoneConvoId(convo.id);
      setMode('done');
    } finally {
      setSubmitting(false);
    }
  }

  if (missing) {
    return (
      <MaisonShell>
        <MaisonHeader left={backLink} />
        <main className="flex flex-1 items-center justify-center">
          <p className="text-sm text-taupe">Piece not found.</p>
        </main>
      </MaisonShell>
    );
  }

  if (!product) {
    return (
      <MaisonShell>
        <MaisonHeader left={backLink} />
        <main className="flex flex-1 items-center justify-center">
          <p className="text-sm text-taupe">Loading…</p>
        </main>
      </MaisonShell>
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
      className="inline-flex items-center gap-1.5 rounded-full border border-bone/20 px-3 py-1 text-xs text-bone/80 transition hover:border-brass hover:text-brass"
    >
      <ArrowLeft /> {product.category ?? 'Collection'}
    </Link>
  );

  const inputCls =
    'w-full rounded-xl border border-bone/20 bg-ink px-3.5 py-2 text-sm text-bone placeholder:text-taupe outline-none transition focus:border-brass';

  return (
    <MaisonShell>
      <MaisonHeader left={categoryLink} />
      <main className="relative z-10 mx-auto grid w-full max-w-6xl flex-1 grid-cols-1 gap-10 px-6 py-14 lg:grid-cols-2 lg:items-center lg:gap-16">
        {/* Image — presented as a vitrine. */}
        <div className="w-full">
          <div className="m-arch relative mx-auto aspect-[4/5] w-full max-w-md overflow-hidden border border-brass/25 bg-umber lg:max-w-none">
            {product.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={product.imageUrl}
                alt={product.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-taupe">
                No image
              </div>
            )}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink/40 via-transparent to-ink/10"
            />
          </div>
        </div>

        {/* Support panel */}
        <div className="flex flex-col justify-center">
          {product.category && <Eyebrow>{product.category}</Eyebrow>}
          <h1 className="mt-3 font-display text-4xl tracking-tight text-bone sm:text-5xl">
            {product.name}
          </h1>
          <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.2em] text-taupe">
            Aftercare ref. {product.id.slice(-6).toUpperCase()}
          </p>
          {product.description && (
            <p className="mt-5 text-[1.0625rem] leading-relaxed text-taupe">
              {product.description}
            </p>
          )}

          {mode === 'done' ? (
            // Confirmation after a callback request
            <div className="m-arch mt-8 border border-brass/25 bg-umber p-7">
              <h2 className="font-display text-2xl tracking-tight text-bone">
                Request received
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-taupe">
                Thank you. A specialist will review your note about{' '}
                <span className="text-bone">{product.name}</span> and follow up
                shortly. You can also continue the conversation now.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                {doneConvoId && (
                  <Link
                    href={`/chat/${doneConvoId}`}
                    className="rounded-full bg-brass px-6 py-2.5 text-sm font-medium text-ink transition hover:bg-brass-bright"
                  >
                    Open conversation
                  </Link>
                )}
                <Link
                  href="/products"
                  className="rounded-full border border-bone/20 px-6 py-2.5 text-sm font-medium text-bone/80 transition hover:border-brass hover:text-brass"
                >
                  Back to collections
                </Link>
              </div>
            </div>
          ) : (
            <>
              {/* Topic chips */}
              <div className="mt-8">
                <h2 className="text-sm font-medium text-bone">
                  What can we help with?
                </h2>
                <div className="mt-3 flex flex-wrap gap-2">
                  {TOPICS.map((tp) => (
                    <button
                      key={tp}
                      onClick={() => setTopic(topic === tp ? null : tp)}
                      className={`rounded-full border px-4 py-1.5 text-sm transition ${
                        topic === tp
                          ? 'border-brass bg-brass text-ink'
                          : 'border-bone/20 text-bone/80 hover:border-brass hover:text-brass'
                      }`}
                    >
                      {tp}
                    </button>
                  ))}
                </div>
              </div>

              {/* Contact options */}
              <div className="mt-9">
                <h2 className="font-mono text-[10px] font-medium uppercase tracking-[0.3em] text-brass">
                  How to reach us
                </h2>

                {mode === 'choose' && (
                  <div className="mt-4 space-y-3">
                    {/* Live Chat */}
                    <button
                      onClick={chatNow}
                      disabled={starting === product.id}
                      className="group flex w-full items-center gap-4 rounded-2xl border border-brass/25 bg-umber px-5 py-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-brass/60 hover:bg-umber2 disabled:opacity-50 disabled:hover:translate-y-0"
                    >
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brass text-ink">
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
                        <span className="block text-[15px] font-semibold tracking-tight text-bone">
                          Live chat
                        </span>
                        <span className="mt-0.5 block text-[13px] leading-snug text-taupe">
                          Start a real-time conversation with a DU specialist.
                        </span>
                        <span className="mt-2 flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.16em] text-sage">
                          <span className="h-1.5 w-1.5 rounded-full bg-sage" />
                          Available now
                        </span>
                      </span>
                      <ChevronRight />
                    </button>

                    {/* Call for Support */}
                    <button
                      onClick={() => setMode('callback')}
                      className="group flex w-full items-center gap-4 rounded-2xl border border-brass/25 bg-umber px-5 py-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-brass/60 hover:bg-umber2"
                    >
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-bone/15 bg-umber2 text-brass">
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
                        <span className="block text-[15px] font-semibold tracking-tight text-bone">
                          Request a callback
                        </span>
                        <span className="mt-0.5 block text-[13px] leading-snug text-taupe">
                          Describe your issue and a specialist will reach out.
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
                      className={inputCls}
                    />
                    <div className="grid grid-cols-2 gap-2.5">
                      <input
                        type="email"
                        value={cbEmail}
                        onChange={(e) => setCbEmail(e.target.value)}
                        placeholder="Email"
                        className={inputCls}
                      />
                      <input
                        type="tel"
                        value={cbPhone}
                        onChange={(e) => setCbPhone(e.target.value)}
                        placeholder="Phone number"
                        className={inputCls}
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
                      className={inputCls}
                    />
                    <div className="flex gap-3 pt-0.5">
                      <button
                        onClick={submitCallback}
                        disabled={submitting || !issue.trim() || !cbPhone.trim()}
                        className="rounded-full bg-brass px-6 py-2.5 text-sm font-medium text-ink transition hover:bg-brass-bright disabled:opacity-50"
                      >
                        {submitting ? 'Sending…' : 'Submit request'}
                      </button>
                      <button
                        onClick={() => setMode('choose')}
                        className="rounded-full border border-bone/20 px-6 py-2.5 text-sm font-medium text-bone/80 transition hover:border-brass hover:text-brass"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-1.5 font-mono text-[11px] uppercase tracking-[0.16em] text-taupe">
                <span>Real-time specialists</span>
                <span>Two-year aftercare</span>
                <span>Lifetime servicing</span>
              </div>
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
    </MaisonShell>
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
      className="h-4 w-4 shrink-0 text-taupe transition-all duration-200 group-hover:translate-x-0.5 group-hover:text-brass"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  );
}

'use client';

import AppHeader from '@/components/AppHeader';
import Eyebrow from '@/components/Eyebrow';
import { ArrowRight } from '@/components/icons';
import { api } from '@/lib/api';
import type { Product } from '@/lib/types';
import Link from 'next/link';
import { useEffect, useState } from 'react';

// Preferred display order; unknown categories fall to the end.
const CATEGORY_ORDER = ['Timepieces', 'Handmade Bags', 'Leather Accessories'];

function groupByCategory(items: Product[]): [string, Product[]][] {
  const map = new Map<string, Product[]>();
  for (const p of items) {
    const key = p.category ?? 'Other';
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(p);
  }
  const rank = (c: string) => {
    const i = CATEGORY_ORDER.indexOf(c);
    return i === -1 ? 99 : i;
  };
  return [...map.entries()].sort((a, b) => rank(a[0]) - rank(b[0]));
}

const STEPS = [
  {
    n: '01',
    t: 'Choose your collection',
    d: 'Find the line your piece belongs to.',
  },
  {
    n: '02',
    t: 'Tell us what you need',
    d: 'Servicing, repairs, authentication, or advice.',
  },
  {
    n: '03',
    t: 'Speak with a specialist',
    d: 'In real time, or request a callback.',
  },
];

const PROMISES = [
  {
    t: 'Real-time specialists',
    d: 'A dedicated specialist answers live — no queues, no call centre.',
  },
  {
    t: 'Care for the life of your piece',
    d: 'Servicing, repairs, and guidance, for as long as you own it.',
  },
  {
    t: 'Every conversation on record',
    d: 'Your history with each piece, kept on file and easy to revisit.',
  },
];

const FAQS = [
  {
    q: 'How do I verify my piece is authentic?',
    a: 'Share the serial number with your specialist — they confirm it against our records and reissue the certificate if needed.',
  },
  {
    q: 'What does aftercare cover?',
    a: 'Two years against manufacturing defects, with complimentary servicing and repair guidance for the life of the piece.',
  },
  {
    q: 'How do I arrange a repair?',
    a: 'Open your collection, start a chat, and your specialist will arrange collection and servicing for you.',
  },
  {
    q: 'Can I get sizing or fit advice?',
    a: 'Yes — choose your piece and ask; a specialist will guide you on sizing, fit, and styling.',
  },
];

/**
 * Customer home — the DU Concierge. Frames the catalog as a *support desk*:
 * the visitor already owns a piece and is choosing what they need help with,
 * not shopping. Public (no login to browse); a deferred chat resumes after login.
 */
export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    api.getProducts().then(setProducts).catch(() => {});
  }, []);

  const categories = groupByCategory(products);

  return (
    <>
      <AppHeader />

      {/* Hero — the thesis: specialist support for something you already own. */}
      <section className="mx-auto w-full max-w-3xl px-6 pt-20 pb-14 text-center sm:pt-28">
        <Eyebrow>DU Concierge</Eyebrow>
        <h1 className="mt-5 font-serif text-[2.75rem] leading-[1.05] tracking-tight sm:text-6xl">
          Specialist support for
          <br className="hidden sm:block" /> every piece you own.
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-neutral-500">
          Tell us which DU piece you need help with — servicing, repairs,
          authentication, or advice — and speak with a dedicated specialist in
          real time.
        </p>
      </section>

      {/* Concierge flow — a true sequence, so the numbering carries meaning. */}
      <section className="border-y border-neutral-200 bg-[#faf9f7]">
        <div className="mx-auto grid max-w-5xl grid-cols-1 gap-10 px-6 py-14 sm:grid-cols-3 sm:gap-8">
          {STEPS.map((s) => (
            <div key={s.n} className="flex flex-col">
              <span className="font-serif text-3xl text-amber-700/70">{s.n}</span>
              <h3 className="mt-3 text-base font-medium tracking-tight">
                {s.t}
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-neutral-500">
                {s.d}
              </p>
            </div>
          ))}
        </div>
      </section>

      <main className="mx-auto w-full max-w-5xl flex-1 px-6">
        {/* Collection picker — smaller cards, text below (a desk, not a store). */}
        <section className="pt-20 pb-4">
          <div className="flex items-end justify-between">
            <div>
              <Eyebrow>Select your collection</Eyebrow>
              <h2 className="mt-3 font-serif text-3xl tracking-tight">
                Which piece can we help with?
              </h2>
            </div>
          </div>

          <div className="mt-10 grid grid-cols-1 gap-x-8 gap-y-12 sm:grid-cols-3">
            {categories.length === 0 && (
              <p className="text-sm text-neutral-400">
                Collections are being prepared. Please check back shortly.
              </p>
            )}
            {categories.map(([category, items]) => {
              const cover = items.find((p) => p.imageUrl)?.imageUrl;
              return (
                <Link
                  key={category}
                  href={`/category/${encodeURIComponent(category)}`}
                  className="group flex flex-col outline-none"
                >
                  <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-neutral-100 ring-1 ring-neutral-200/70 transition group-hover:ring-neutral-300 group-focus-visible:ring-2 group-focus-visible:ring-amber-700">
                    {cover && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={cover}
                        alt={category}
                        className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04] motion-reduce:transform-none"
                      />
                    )}
                  </div>
                  <div className="mt-4 flex items-baseline justify-between gap-3">
                    <h3 className="font-serif text-xl tracking-tight">
                      {category}
                    </h3>
                    <span className="shrink-0 text-xs tabular-nums text-neutral-400">
                      {items.length} {items.length === 1 ? 'piece' : 'pieces'}
                    </span>
                  </div>
                  <span className="mt-1.5 inline-flex items-center gap-1.5 text-sm text-amber-700">
                    Get support
                    <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-1 motion-reduce:transform-none" />
                  </span>
                </Link>
              );
            })}
          </div>
        </section>

        {/* Support promises — reframed away from retail (shipping/authenticity). */}
        <section className="mt-24 grid grid-cols-1 gap-10 border-t border-neutral-200 pt-16 sm:grid-cols-3">
          {PROMISES.map((p) => (
            <div key={p.t}>
              <h3 className="font-serif text-xl tracking-tight">{p.t}</h3>
              <p className="mt-2 text-sm leading-relaxed text-neutral-500">
                {p.d}
              </p>
            </div>
          ))}
        </section>

        {/* Common questions */}
        <section className="mt-24">
          <div className="text-center">
            <Eyebrow>Good to know</Eyebrow>
            <h2 className="mt-3 font-serif text-3xl tracking-tight">
              Common questions
            </h2>
          </div>
          <div className="mx-auto mt-10 grid max-w-4xl grid-cols-1 gap-x-12 gap-y-8 sm:grid-cols-2">
            {FAQS.map((f) => (
              <div key={f.q}>
                <h3 className="text-base font-medium tracking-tight">{f.q}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-neutral-500">
                  {f.a}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Closing CTA */}
        <section className="mt-24 mb-24 overflow-hidden rounded-3xl bg-neutral-900 px-8 py-16 text-center text-white">
          <Eyebrow>Always on hand</Eyebrow>
          <h2 className="mt-4 font-serif text-3xl tracking-tight sm:text-4xl">
            A specialist is standing by.
          </h2>
          <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-white/65">
            Choose your collection above to open a conversation, or request a
            callback at a time that suits you.
          </p>
        </section>
      </main>

      <footer className="border-t border-neutral-200 px-6 py-10 text-center text-xs text-neutral-400">
        <p className="font-serif text-base tracking-[0.35em] text-neutral-700">
          DU
        </p>
        <p className="mt-2">
          Concierge · Timepieces · Handmade Bags · Leather Accessories
        </p>
        <p className="mt-2">© DU Maison. Crafted with care.</p>
      </footer>
    </>
  );
}

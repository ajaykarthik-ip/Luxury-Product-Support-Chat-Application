'use client';

import Eyebrow from '@/components/Eyebrow';
import MaisonHeader from '@/components/MaisonHeader';
import MaisonShell from '@/components/MaisonShell';
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
    d: 'A dedicated specialist answers live, with no queues and no call centre.',
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
    a: 'Share the serial number with your specialist. They confirm it against our records and reissue the certificate if needed.',
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
    a: 'Yes. Choose your piece and ask, and a specialist will guide you on sizing, fit, and styling.',
  },
];

/**
 * Customer home — the DU Maison Concierge. "After-Hours Atelier": the catalog
 * framed as a support desk (you already own the piece; you're choosing what you
 * need help with). Signature device — collections shown in arched "vitrine"
 * frames with mono reference markings. Public; a deferred chat resumes on login.
 */
export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    api.getProducts().then(setProducts).catch(() => {});
  }, []);

  const categories = groupByCategory(products);

  return (
    <MaisonShell>
      <MaisonHeader />

      {/* Hero — the thesis: care for the things you already treasure. */}
      <section className="relative">
        <div aria-hidden className="m-glow pointer-events-none absolute inset-x-0 top-0 h-[28rem]" />
        <div className="relative mx-auto w-full max-w-3xl px-6 pt-24 pb-16 text-center sm:pt-32">
          <div className="m-rise" style={{ animationDelay: '0ms' }}>
            <Eyebrow>Maison Concierge</Eyebrow>
          </div>
          <h1
            className="m-rise mt-6 font-display text-[3.25rem] font-semibold leading-[0.98] tracking-[-0.02em] text-bone sm:text-7xl"
            style={{ animationDelay: '90ms' }}
          >
            The care of
            <br />
            fine things.
          </h1>
          <p
            className="m-rise mx-auto mt-7 max-w-xl text-[1.0625rem] leading-relaxed text-taupe"
            style={{ animationDelay: '180ms' }}
          >
            Servicing, repairs, authentication, and counsel for the DU pieces you
            live with. Speak with a dedicated specialist in real time.
          </p>
          <div
            className="m-rise mt-8 flex items-center justify-center font-mono text-[11px] uppercase tracking-[0.24em] text-bone/60"
            style={{ animationDelay: '260ms' }}
          >
            A specialist is available now
          </div>
        </div>
      </section>

      {/* Concierge sequence — a true ordered process, so numbering carries meaning. */}
      <section className="mx-auto w-full max-w-5xl px-6">
        <div className="grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-bone/10 bg-bone/10 sm:grid-cols-3">
          {STEPS.map((s) => (
            <div key={s.n} className="flex flex-col bg-ink p-7">
              <span className="font-display text-2xl font-medium text-brass">
                {s.n}
              </span>
              <h3 className="mt-3 text-[0.95rem] font-medium tracking-tight text-bone">
                {s.t}
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-taupe">{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      <main className="relative z-10 mx-auto w-full max-w-5xl flex-1 px-6">
        {/* Collection vitrines — the signature. Arched frames + mono markings. */}
        <section className="pt-24 pb-4">
          <div className="flex items-end justify-between gap-4 border-b border-bone/10 pb-6">
            <div>
              <Eyebrow>Select your collection</Eyebrow>
              <h2 className="mt-3 font-display text-3xl tracking-tight text-bone sm:text-4xl">
                Which piece can we help with?
              </h2>
            </div>
            <span className="hidden shrink-0 font-mono text-[11px] tracking-[0.2em] text-taupe sm:block">
              {products.length
                ? `${String(products.length).padStart(2, '0')} pieces on file`
                : ''}
            </span>
          </div>

          <div className="mt-12 grid grid-cols-1 gap-x-8 gap-y-14 sm:grid-cols-3">
            {categories.length === 0 && (
              <p className="text-sm text-taupe">
                Collections are being prepared. Please check back shortly.
              </p>
            )}
            {categories.map(([category, items], i) => {
              const cover = items.find((p) => p.imageUrl)?.imageUrl;
              return (
                <Link
                  key={category}
                  href={`/category/${encodeURIComponent(category)}`}
                  className="group m-rise flex flex-col outline-none"
                  style={{ animationDelay: `${i * 90}ms` }}
                >
                  <div className="m-arch relative aspect-[3/4] overflow-hidden border border-brass/25 bg-umber transition-colors duration-500 group-hover:border-brass/60 group-focus-visible:border-brass">
                    {cover && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={cover}
                        alt={category}
                        className="h-full w-full object-cover opacity-90 transition-all duration-[1200ms] ease-out group-hover:scale-[1.05] group-hover:opacity-100 motion-reduce:transform-none"
                      />
                    )}
                    <div
                      aria-hidden
                      className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink/75 via-ink/5 to-ink/20"
                    />
                  </div>
                  <div className="mt-5 flex items-baseline justify-between gap-3">
                    <h3 className="font-display text-2xl tracking-tight text-bone">
                      {category}
                    </h3>
                    <span className="shrink-0 font-mono text-[11px] tabular-nums text-taupe">
                      {items.length} {items.length === 1 ? 'piece' : 'pieces'}
                    </span>
                  </div>
                  <span className="mt-2.5 inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.22em] text-brass transition-colors group-hover:text-brass-bright">
                    Enter
                    <ArrowRight className="h-3 w-3 transition-transform duration-300 group-hover:translate-x-1 motion-reduce:transform-none" />
                  </span>
                </Link>
              );
            })}
          </div>
        </section>

        {/* Support promises */}
        <section className="mt-28 grid grid-cols-1 gap-10 border-t border-bone/10 pt-16 sm:grid-cols-3">
          {PROMISES.map((p) => (
            <div key={p.t}>
              <span aria-hidden className="block h-px w-8 bg-brass/60" />
              <h3 className="mt-5 font-display text-xl tracking-tight text-bone">
                {p.t}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-taupe">{p.d}</p>
            </div>
          ))}
        </section>

        {/* Common questions */}
        <section className="mt-28">
          <div className="text-center">
            <Eyebrow>Good to know</Eyebrow>
            <h2 className="mt-3 font-display text-3xl tracking-tight text-bone">
              Common questions
            </h2>
          </div>
          <div className="mx-auto mt-12 grid max-w-4xl grid-cols-1 gap-x-12 gap-y-9 sm:grid-cols-2">
            {FAQS.map((f) => (
              <div key={f.q} className="border-t border-bone/10 pt-5">
                <h3 className="text-[0.95rem] font-medium tracking-tight text-bone">
                  {f.q}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-taupe">{f.a}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Closing CTA */}
        <section className="m-arch relative mt-28 mb-28 overflow-hidden border border-brass/25 bg-umber px-8 py-20 text-center">
          <div aria-hidden className="m-glow pointer-events-none absolute inset-0" />
          <div className="relative">
            <Eyebrow>Always on hand</Eyebrow>
            <h2 className="mt-5 font-display text-3xl tracking-tight text-bone sm:text-5xl">
              A specialist is standing by.
            </h2>
            <p className="mx-auto mt-5 max-w-md text-sm leading-relaxed text-taupe">
              Choose your collection above to open a conversation, or request a
              callback at a time that suits you.
            </p>
          </div>
        </section>
      </main>

      <footer className="relative z-10 border-t border-bone/10 px-6 py-12 text-center">
        <p className="font-display text-lg tracking-[0.34em] text-bone">DU</p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-x-8 gap-y-2 font-mono text-[11px] uppercase tracking-[0.22em] text-taupe">
          <span>Concierge</span>
          <span>Timepieces</span>
          <span>Handmade Bags</span>
          <span>Leather Accessories</span>
        </div>
        <p className="mt-5 text-xs text-taupe/70">© DU Maison. Crafted with care.</p>
      </footer>
    </MaisonShell>
  );
}

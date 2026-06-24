'use client';

import AppHeader from '@/components/AppHeader';
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

/**
 * Level 1 of the support flow: choose a product category (Apple-Support style).
 * Public — no login to browse. (A deferred chat is resumed by the login screen
 * itself, which opens the conversation directly — no catalog flash in between.)
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

      <section className="mx-auto w-full max-w-5xl px-6 pt-20 pb-12 text-center">
        <h1 className="font-serif text-5xl leading-tight tracking-tight sm:text-6xl">
          How can we help?
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-neutral-500">
          Choose a collection to find your piece and speak with a specialist.
        </p>
      </section>

      <main className="mx-auto w-full max-w-6xl flex-1 px-6 pb-24">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-3">
          {categories.length === 0 && (
            <p className="text-sm text-neutral-400">
              No products yet. An agent can add some from their dashboard.
            </p>
          )}
          {categories.map(([category, items]) => {
            const cover = items.find((p) => p.imageUrl)?.imageUrl;
            return (
              <Link
                key={category}
                href={`/category/${encodeURIComponent(category)}`}
                className="group relative block aspect-[4/5] overflow-hidden rounded-3xl bg-neutral-100"
              >
                {cover && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={cover}
                    alt={category}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
                <div className="absolute bottom-0 left-0 p-6 text-white">
                  <h2 className="font-serif text-2xl tracking-tight">
                    {category}
                  </h2>
                </div>
              </Link>
            );
          })}
        </div>

        {/* Value props */}
        <section className="mx-auto mt-24 grid max-w-4xl grid-cols-1 gap-10 border-t border-neutral-200 pt-16 sm:grid-cols-3">
          {[
            {
              title: 'Complimentary Shipping',
              body: 'Insured worldwide delivery on every order, beautifully packaged.',
            },
            {
              title: 'Lifetime Servicing',
              body: 'Our ateliers maintain and restore your piece for years to come.',
            },
            {
              title: 'Certified Authenticity',
              body: 'Each item is accompanied by a certificate and serial record.',
            },
          ].map((v) => (
            <div key={v.title}>
              <h3 className="font-serif text-xl tracking-tight">{v.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-neutral-500">
                {v.body}
              </p>
            </div>
          ))}
        </section>

        {/* Common questions */}
        <section className="mt-24">
          <h2 className="text-center font-serif text-3xl tracking-tight">
            Common questions
          </h2>
          <div className="mx-auto mt-10 grid max-w-4xl grid-cols-1 gap-x-12 gap-y-8 sm:grid-cols-2">
            {[
              {
                q: 'How do I verify my piece is authentic?',
                a: 'Every DU item ships with a certificate and a unique serial number you can confirm with a specialist.',
              },
              {
                q: 'What does the warranty cover?',
                a: 'Two years against manufacturing defects, with complimentary servicing available for life.',
              },
              {
                q: 'How do I arrange a repair?',
                a: 'Open the relevant product and start a chat or request a callback — we’ll guide you through it.',
              },
              {
                q: 'Can I get sizing or fit advice?',
                a: 'Yes. Choose a product and select the “Sizing & Fit” topic to speak with a specialist.',
              },
            ].map((f) => (
              <div key={f.q}>
                <h3 className="text-base font-medium">{f.q}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-neutral-500">
                  {f.a}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Closing CTA */}
        <section className="mt-24 rounded-3xl bg-neutral-900 px-8 py-14 text-center text-white">
          <h2 className="font-serif text-3xl tracking-tight">
            Still need help?
          </h2>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-white/70">
            Choose a collection above to find your piece and speak with a DU
            specialist in real time, or request a callback at your convenience.
          </p>
        </section>
      </main>

      <footer className="border-t border-neutral-200 px-6 py-10 text-center text-xs text-neutral-400">
        <p className="font-serif text-base tracking-[0.35em] text-neutral-700">
          DU
        </p>
        <p className="mt-2">
          Product Support · Timepieces · Handmade Bags · Leather Accessories
        </p>
        <p className="mt-2">© DU Maison. Crafted with care.</p>
      </footer>
    </>
  );
}

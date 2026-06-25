'use client';

import Eyebrow from '@/components/Eyebrow';
import MaisonHeader from '@/components/MaisonHeader';
import MaisonShell from '@/components/MaisonShell';
import { ArrowLeft, ArrowRight } from '@/components/icons';
import { api } from '@/lib/api';
import type { Product } from '@/lib/types';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

/** Level 2: the pieces within a chosen collection. */
export default function CategoryPage() {
  const { slug } = useParams<{ slug: string }>();
  const category = decodeURIComponent(slug);

  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    api.getProducts().then(setProducts).catch(() => {});
  }, []);

  const items = products.filter((p) => (p.category ?? 'Other') === category);

  const backLink = (
    <Link
      href="/products"
      className="inline-flex items-center gap-1.5 rounded-full border border-bone/20 px-3 py-1 text-xs text-bone/80 transition hover:border-brass hover:text-brass"
    >
      <ArrowLeft /> Collections
    </Link>
  );

  return (
    <MaisonShell>
      <MaisonHeader left={backLink} />

      <section className="relative">
        <div aria-hidden className="m-glow pointer-events-none absolute inset-x-0 top-0 h-72" />
        <div className="relative mx-auto w-full max-w-3xl px-6 pt-16 pb-12 text-center sm:pt-20">
          <div className="m-rise">
            <Eyebrow>Collection</Eyebrow>
          </div>
          <h1
            className="m-rise mt-5 font-display text-4xl tracking-tight text-bone sm:text-6xl"
            style={{ animationDelay: '80ms' }}
          >
            {category}
          </h1>
          <p
            className="m-rise mx-auto mt-5 max-w-md text-[1.0625rem] leading-relaxed text-taupe"
            style={{ animationDelay: '160ms' }}
          >
            Choose the piece you need help with to speak with a specialist.
          </p>
        </div>
      </section>

      <main className="relative z-10 mx-auto w-full max-w-5xl flex-1 px-6 pb-28">
        <div className="grid grid-cols-1 gap-x-8 gap-y-14 sm:grid-cols-2 lg:grid-cols-3">
          {items.length === 0 && (
            <p className="text-sm text-taupe">No pieces in this collection yet.</p>
          )}
          {items.map((p, i) => (
            <Link
              key={p.id}
              href={`/product/${p.id}`}
              className="group m-rise flex flex-col outline-none"
              style={{ animationDelay: `${i * 70}ms` }}
            >
              <div className="m-arch relative aspect-[3/4] w-full overflow-hidden border border-brass/25 bg-umber transition-colors duration-500 group-hover:border-brass/60 group-focus-visible:border-brass">
                {p.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.imageUrl}
                    alt={p.name}
                    className="h-full w-full object-cover opacity-90 transition-all duration-[1200ms] ease-out group-hover:scale-[1.05] group-hover:opacity-100 motion-reduce:transform-none"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-taupe">
                    No image
                  </div>
                )}
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink/70 via-ink/0 to-ink/15"
                />
              </div>
              <div className="mt-5">
                <h2 className="font-display text-xl tracking-tight text-bone">
                  {p.name}
                </h2>
                <span className="mt-2 inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.22em] text-brass transition-colors group-hover:text-brass-bright">
                  Request support
                  <ArrowRight className="h-3 w-3 transition-transform duration-300 group-hover:translate-x-1 motion-reduce:transform-none" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </main>
    </MaisonShell>
  );
}

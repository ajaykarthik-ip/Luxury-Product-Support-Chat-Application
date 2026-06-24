'use client';

import AppHeader from '@/components/AppHeader';
import { ArrowLeft, ArrowRight } from '@/components/icons';
import { api } from '@/lib/api';
import type { Product } from '@/lib/types';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

/** Level 2: the products within a chosen category. */
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
      className="inline-flex items-center gap-1.5 rounded-full border border-neutral-300 px-3 py-1 text-xs hover:bg-neutral-100"
    >
      <ArrowLeft /> Collections
    </Link>
  );

  return (
    <>
      <AppHeader left={backLink} />

      <section className="mx-auto w-full max-w-5xl px-6 pt-16 pb-8 text-center">
        <span className="text-xs font-medium uppercase tracking-[0.25em] text-neutral-400">
          Collection
        </span>
        <h1 className="mt-2 font-serif text-4xl tracking-tight sm:text-5xl">
          {category}
        </h1>
      </section>

      <main className="mx-auto w-full max-w-6xl flex-1 px-6 pb-24">
        <div className="grid grid-cols-1 gap-x-8 gap-y-14 sm:grid-cols-2 lg:grid-cols-3">
          {items.length === 0 && (
            <p className="text-sm text-neutral-400">
              No products in this collection yet.
            </p>
          )}
          {items.map((p) => (
            <Link
              key={p.id}
              href={`/product/${p.id}`}
              className="group flex flex-col"
            >
              <div className="aspect-[4/5] w-full overflow-hidden rounded-3xl bg-neutral-100">
                {p.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.imageUrl}
                    alt={p.name}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-neutral-300">
                    No image
                  </div>
                )}
              </div>
              <div className="mt-5">
                <h2 className="font-serif text-2xl tracking-tight">{p.name}</h2>
                <p className="mt-1 inline-flex items-center gap-1 text-sm text-neutral-500 group-hover:text-neutral-800">
                  View details
                  <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                </p>
              </div>
            </Link>
          ))}
        </div>
      </main>
    </>
  );
}

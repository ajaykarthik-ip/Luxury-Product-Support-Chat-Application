'use client';

import AppHeader from '@/components/AppHeader';
import Eyebrow from '@/components/Eyebrow';
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
      className="inline-flex items-center gap-1.5 rounded-full border border-neutral-300 px-3 py-1 text-xs hover:bg-neutral-100"
    >
      <ArrowLeft /> Collections
    </Link>
  );

  return (
    <>
      <AppHeader left={backLink} />

      <section className="mx-auto w-full max-w-3xl px-6 pt-16 pb-10 text-center sm:pt-20">
        <Eyebrow>Collection</Eyebrow>
        <h1 className="mt-4 font-serif text-4xl tracking-tight sm:text-5xl">
          {category}
        </h1>
        <p className="mx-auto mt-4 max-w-md text-base leading-relaxed text-neutral-500">
          Choose the piece you need help with to speak with a specialist.
        </p>
      </section>

      <main className="mx-auto w-full max-w-5xl flex-1 px-6 pb-24">
        <div className="grid grid-cols-1 gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
          {items.length === 0 && (
            <p className="text-sm text-neutral-400">
              No pieces in this collection yet.
            </p>
          )}
          {items.map((p) => (
            <Link
              key={p.id}
              href={`/product/${p.id}`}
              className="group flex flex-col outline-none"
            >
              <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-neutral-100 ring-1 ring-neutral-200/70 transition group-hover:ring-neutral-300 group-focus-visible:ring-2 group-focus-visible:ring-amber-700">
                {p.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.imageUrl}
                    alt={p.name}
                    className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04] motion-reduce:transform-none"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-neutral-300">
                    No image
                  </div>
                )}
              </div>
              <div className="mt-4">
                <h2 className="font-serif text-xl tracking-tight">{p.name}</h2>
                <span className="mt-1.5 inline-flex items-center gap-1.5 text-sm text-amber-700">
                  Get support
                  <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-1 motion-reduce:transform-none" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </main>
    </>
  );
}

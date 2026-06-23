'use client';

import { useAuth } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

/** Entry point: route the user to the right place based on auth + role. */
export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    // Agents go to their gated dashboard; everyone else (customers AND anonymous
    // visitors) sees the public product catalog.
    router.replace(user?.role === 'AGENT' ? '/agent' : '/products');
  }, [user, loading, router]);

  return (
    <main className="flex flex-1 items-center justify-center">
      <p className="text-sm text-neutral-400">Loading…</p>
    </main>
  );
}

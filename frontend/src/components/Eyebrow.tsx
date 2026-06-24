import type { ReactNode } from 'react';

/**
 * Small tracked-out, gold uppercase label used above section headings — the
 * "concierge" voice shared across the customer pages (home, collection, piece).
 */
export default function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <span className="text-[11px] font-medium uppercase tracking-[0.22em] text-amber-700">
      {children}
    </span>
  );
}

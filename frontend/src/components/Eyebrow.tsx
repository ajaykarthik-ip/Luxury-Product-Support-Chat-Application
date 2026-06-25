import type { ReactNode } from 'react';

/**
 * Small tracked-out brass label above section headings — the "concierge" voice
 * shared across the customer pages. Set in the mono utility face so it reads as
 * a maison reference marking (certificate / engraving), not body copy.
 */
export default function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <span className="font-mono text-[10px] font-medium uppercase tracking-[0.32em] text-brass">
      {children}
    </span>
  );
}

import type { ReactNode } from 'react';

/**
 * Scopes the warm-dark "Maison" theme to the customer experience without
 * touching the global body (the agent dashboard stays light). A fixed ink
 * backdrop prevents white overscroll flashes; the grain overlay adds material
 * depth so the large dark areas don't read as flat digital black.
 */
export default function MaisonShell({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`m-grain relative flex min-h-dvh flex-col bg-ink text-bone ${className}`}>
      {/* Fixed canvas behind everything — covers rubber-band overscroll. */}
      <div aria-hidden className="fixed inset-0 -z-10 bg-ink" />
      {children}
    </div>
  );
}

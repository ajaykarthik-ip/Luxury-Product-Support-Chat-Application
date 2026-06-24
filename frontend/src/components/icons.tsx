/**
 * Tiny inline SVG icons (no icon library — keeps the bundle lean and avoids the
 * templated look of literal "←"/"→" glyphs). `currentColor` so they inherit text
 * colour; size via `className`.
 */

export function ArrowLeft({ className = 'h-3.5 w-3.5' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      className={className}
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19 12H5m0 0 6 6m-6-6 6-6"
      />
    </svg>
  );
}

export function ArrowRight({ className = 'h-3.5 w-3.5' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      className={className}
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M5 12h14m0 0-6-6m6 6-6 6"
      />
    </svg>
  );
}

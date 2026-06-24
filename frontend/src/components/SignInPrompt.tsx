'use client';

import { useEffect, useState } from 'react';

/**
 * Small, Apple-style confirmation shown before sending a logged-out visitor to
 * sign in — so the redirect feels intentional, not a glitch. Backdrop blur, a
 * gentle scale-in, Escape/backdrop to dismiss.
 */
export default function SignInPrompt({
  open,
  productName,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  productName?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const [show, setShow] = useState(false);

  // Mount → next frame → animate in. Also wire Escape to dismiss.
  useEffect(() => {
    if (!open) {
      setShow(false);
      return;
    }
    const raf = requestAnimationFrame(() => setShow(true));
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCancel();
    window.addEventListener('keydown', onKey);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      <div
        onClick={onCancel}
        className={`absolute inset-0 bg-black/30 backdrop-blur-sm transition-opacity duration-150 ${
          show ? 'opacity-100' : 'opacity-0'
        }`}
      />
      <div
        className={`relative w-full max-w-xs rounded-2xl border border-stone-200 bg-white p-6 text-center shadow-xl transition-all duration-150 ${
          show ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
        }`}
      >
        <span className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-neutral-900 text-white">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            className="h-5 w-5"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M8 10.5h8M8 14h5m8-2c0 4.418-4.03 8-9 8a9.77 9.77 0 0 1-4-.85L3 20l1.4-3.5A7.8 7.8 0 0 1 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8Z"
            />
          </svg>
        </span>
        <h2 className="font-serif text-xl tracking-tight">Sign in to continue</h2>
        <p className="mt-2 text-sm leading-relaxed text-neutral-500">
          Sign in to start chatting with a DU specialist
          {productName ? ` about the ${productName}` : ''}.
        </p>
        <div className="mt-5 flex flex-col gap-2">
          <button
            onClick={onConfirm}
            className="w-full rounded-full bg-neutral-900 py-2.5 text-sm font-medium text-stone-50 hover:bg-neutral-800"
          >
            Sign in
          </button>
          <button
            onClick={onCancel}
            className="w-full rounded-full py-2 text-sm text-neutral-500 hover:text-neutral-800"
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}

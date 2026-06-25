import type { Metadata } from "next";
import { Geist, Geist_Mono, Fraunces, Playfair_Display } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth";

const geist = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

// Monospace utility face — used for the "maison" reference numbers, eyebrows,
// and technical labels (REF. DU-001, timestamps). Evokes certificates of
// authenticity / watch reference engravings.
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Display face for the customer "Maison" experience — a high-contrast old-style
// serif with more character than the usual Playfair. Used large, with restraint.
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  display: "swap",
});

// Retained for the agent dashboard, which still uses `font-serif` — keeping it
// loaded means the agent side is visually unchanged by the customer redesign.
const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

export const metadata: Metadata = {
  title: "DU Maison Concierge",
  description: "Specialist care for fine timepieces, bags, and leather, in real time.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geist.variable} ${geistMono.variable} ${fraunces.variable} ${playfair.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-white text-neutral-900">
        {/* AuthProvider (a client component) wraps the app so every page can
            read the logged-in user and JWT. */}
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}

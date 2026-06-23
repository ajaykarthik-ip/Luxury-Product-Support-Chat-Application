import type { Metadata } from "next";
import { Geist, Playfair_Display } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth";

const geist = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

// Serif display face for the "luxury" brand feel (headings, product names).
const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Maison — Product Support",
  description: "Real-time luxury product support chat",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geist.variable} ${playfair.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-white text-neutral-900">
        {/* AuthProvider (a client component) wraps the app so every page can
            read the logged-in user and JWT. */}
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}

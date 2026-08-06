import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";

import { AppProviders } from "@/components/providers/app-providers";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
  // `adjustFontFallback` keeps the layout from shifting before Inter loads.
  adjustFontFallback: true,
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.AUTH_URL ?? "http://localhost:3000"),
  title: {
    default: "FluxFin — Money, beautifully tracked",
    template: "%s · FluxFin",
  },
  description:
    "A premium expense tracker with budgets, goals, recurring transactions, and analytics that actually explain where your money went.",
  keywords: [
    "expense tracker",
    "personal finance",
    "budgeting app",
    "money management",
    "spending analytics",
  ],
  authors: [{ name: "FluxFin" }],
  openGraph: {
    type: "website",
    title: "FluxFin — Money, beautifully tracked",
    description:
      "Budgets, goals, recurring transactions, and analytics that actually explain where your money went.",
    siteName: "FluxFin",
  },
  twitter: {
    card: "summary_large_image",
    title: "FluxFin — Money, beautifully tracked",
    description:
      "Budgets, goals, recurring transactions, and analytics that actually explain where your money went.",
  },
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
  },
};

export const viewport: Viewport = {
  themeColor: "#08080B",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable} dark`}>
      <body className="min-h-dvh bg-canvas font-sans text-foreground">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}

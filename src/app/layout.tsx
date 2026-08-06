import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";

import { AppProviders } from "@/components/providers/app-providers";
import { ServiceWorkerRegistrar } from "@/components/pwa/service-worker-registrar";
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
  applicationName: "FluxFin",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "FluxFin",
    // "black-translucent" lets the gradient background run under the status
    // bar, which is what makes an installed PWA stop looking like a web page.
    statusBarStyle: "black-translucent",
  },
  other: {
    // Next emits the modern `mobile-web-app-capable`; iOS before 17.4 only
    // honours the Apple-prefixed one, and without it those devices open the
    // installed icon in a Safari tab instead of a standalone window.
    "apple-mobile-web-app-capable": "yes",
  },
  formatDetection: {
    // Stops iOS turning amounts and dates into tappable phone-number links.
    telephone: false,
    date: false,
    address: false,
    email: false,
  },
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#08080B",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  // Lets the layout extend into the notch / home-indicator area; the safe-area
  // insets in the mobile nav keep content clear of both.
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable} dark`}>
      <body className="min-h-dvh bg-canvas font-sans text-foreground">
        <AppProviders>{children}</AppProviders>
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}

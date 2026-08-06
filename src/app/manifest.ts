import type { MetadataRoute } from "next";

/**
 * Web app manifest — this is what makes FluxFin installable.
 *
 * Served from /manifest.webmanifest. `display: standalone` is what removes the
 * browser chrome once installed, so the app gets its own window and task-bar /
 * home-screen entry rather than living in a tab.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "FluxFin — Expense Tracker",
    short_name: "FluxFin",
    description:
      "Track spending, set budgets, and hit savings goals. Your money, beautifully tracked.",
    // Installed users should land in the app, not on the marketing page.
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#08080B",
    theme_color: "#08080B",
    categories: ["finance", "productivity", "business"],
    lang: "en",
    dir: "ltr",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-256.png", sizes: "256x256", type: "image/png", purpose: "any" },
      { src: "/icons/icon-384.png", sizes: "384x384", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      // Maskable icons carry extra padding so Android can crop them to any
      // shape (circle, squircle, rounded square) without clipping the mark.
      {
        src: "/icons/maskable-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    // Long-press the installed icon to jump straight into a task.
    shortcuts: [
      {
        name: "Add a transaction",
        short_name: "Add",
        description: "Record an expense or income",
        url: "/transactions?new=1",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
      },
      {
        name: "Transactions",
        short_name: "Transactions",
        description: "Search and manage every entry",
        url: "/transactions",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
      },
      {
        name: "Analytics",
        short_name: "Analytics",
        description: "Trends, breakdowns, and net worth",
        url: "/analytics",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
      },
    ],
  };
}

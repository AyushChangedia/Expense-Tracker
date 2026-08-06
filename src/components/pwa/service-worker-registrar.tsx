"use client";

import * as React from "react";
import { toast } from "sonner";

/**
 * Registers the service worker and offers a reload when a new build ships.
 *
 * Without the prompt, an installed PWA can sit on an old bundle indefinitely
 * because the window is never closed — the user just sees a stale app with no
 * idea why.
 */
export function ServiceWorkerRegistrar() {
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    // A dev-mode service worker fights the Next.js hot reloader.
    if (process.env.NODE_ENV !== "production") return;

    let registration: ServiceWorkerRegistration | undefined;

    const register = async () => {
      try {
        registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });

        registration.addEventListener("updatefound", () => {
          const installing = registration?.installing;
          if (!installing) return;

          installing.addEventListener("statechange", () => {
            // "installed" with an existing controller means an update is
            // waiting, not a first install.
            if (installing.state === "installed" && navigator.serviceWorker.controller) {
              toast("A new version of FluxFin is ready", {
                duration: Infinity,
                action: {
                  label: "Reload",
                  onClick: () => {
                    installing.postMessage("SKIP_WAITING");
                    window.location.reload();
                  },
                },
              });
            }
          });
        });
      } catch (error) {
        // An unavailable service worker degrades to a normal website, which is
        // a perfectly fine outcome — never surface it to the user.
        console.info("Service worker registration skipped:", error);
      }
    };

    void register();
  }, []);

  return null;
}

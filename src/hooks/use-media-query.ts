"use client";

import * as React from "react";

/**
 * SSR-safe media query hook. `useSyncExternalStore` avoids the hydration
 * flash you get from reading `window` inside an effect.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = React.useCallback(
    (onChange: () => void) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    [query],
  );

  return React.useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    // The server has no viewport; assume desktop and let the client correct it.
    () => false,
  );
}

export function useIsMobile() {
  return useMediaQuery("(max-width: 767px)");
}

export function useIsTablet() {
  return useMediaQuery("(max-width: 1023px)");
}

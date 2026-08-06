"use client";

import * as React from "react";

type ShortcutOptions = {
  /** ⌘ on macOS, Ctrl elsewhere. */
  meta?: boolean;
  shift?: boolean;
  alt?: boolean;
  /** Fire even while a text field has focus. Off by default. */
  allowInInput?: boolean;
  enabled?: boolean;
  preventDefault?: boolean;
};

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    target.isContentEditable
  );
}

/**
 * Binds a keyboard shortcut for as long as the component is mounted.
 *
 * `meta: true` matches ⌘ on macOS and Ctrl elsewhere, so callers never have to
 * branch on platform.
 */
export function useKeyboardShortcut(
  key: string | string[],
  handler: (event: KeyboardEvent) => void,
  {
    meta = false,
    shift = false,
    alt = false,
    allowInInput = false,
    enabled = true,
    preventDefault = true,
  }: ShortcutOptions = {},
) {
  const handlerRef = React.useRef(handler);

  React.useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  React.useEffect(() => {
    if (!enabled) return;

    const keys = (Array.isArray(key) ? key : [key]).map((k) => k.toLowerCase());

    function onKeyDown(event: KeyboardEvent) {
      if (!keys.includes(event.key.toLowerCase())) return;

      const metaPressed = event.metaKey || event.ctrlKey;
      if (meta !== metaPressed) return;
      if (shift !== event.shiftKey) return;
      if (alt !== event.altKey) return;

      if (!allowInInput && isEditableTarget(event.target)) return;

      if (preventDefault) event.preventDefault();
      handlerRef.current(event);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [key, meta, shift, alt, allowInInput, enabled, preventDefault]);
}

/** True on Apple platforms — used to label shortcuts ⌘K vs Ctrl K. */
export function useIsMac(): boolean {
  const [isMac, setIsMac] = React.useState(false);

  React.useEffect(() => {
    setIsMac(/mac|iphone|ipad|ipod/i.test(window.navigator.platform || navigator.userAgent));
  }, []);

  return isMac;
}

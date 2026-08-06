"use client";

import * as React from "react";
import {
  animate,
  useInView,
  useMotionValue,
  useReducedMotion,
  useTransform,
  motion,
} from "framer-motion";

import { formatCurrency } from "@/lib/currency";

type AnimatedCounterProps = {
  value: number;
  currency?: string;
  locale?: string;
  /** Render as plain number instead of currency. */
  plain?: boolean;
  suffix?: string;
  prefix?: string;
  decimals?: number;
  duration?: number;
  className?: string;
  signed?: boolean;
  compact?: boolean;
};

/**
 * Counts up to `value` when it scrolls into view, and re-animates from the
 * previous number whenever the value changes. Falls back to the final figure
 * immediately when the user prefers reduced motion.
 */
export function AnimatedCounter({
  value,
  currency = "USD",
  locale = "en-US",
  plain = false,
  suffix,
  prefix,
  decimals = 0,
  duration = 1.1,
  className,
  signed = false,
  compact = false,
}: AnimatedCounterProps) {
  const ref = React.useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const reduceMotion = useReducedMotion();

  const motionValue = useMotionValue(reduceMotion ? value : 0);
  const previous = React.useRef(0);

  const display = useTransform(motionValue, (latest) => {
    if (plain) {
      const formatted = latest.toLocaleString(locale, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      });
      return `${prefix ?? ""}${formatted}${suffix ?? ""}`;
    }
    return formatCurrency(latest, { currency, locale, signed, compact });
  });

  React.useEffect(() => {
    if (reduceMotion) {
      motionValue.set(value);
      previous.current = value;
      return;
    }

    if (!inView) return;

    const controls = animate(motionValue, value, {
      duration,
      ease: [0.16, 1, 0.3, 1],
    });

    previous.current = value;
    return () => controls.stop();
  }, [inView, value, duration, motionValue, reduceMotion]);

  return (
    <motion.span ref={ref} className={className}>
      {display}
    </motion.span>
  );
}

"use client";

import * as React from "react";
import { Eye, EyeOff } from "lucide-react";
import { motion } from "framer-motion";

import { Input, type InputProps } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/** Password field with a reveal toggle. */
export const PasswordInput = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, ...props }, ref) => {
    const [visible, setVisible] = React.useState(false);

    return (
      <div className="relative">
        <Input
          ref={ref}
          type={visible ? "text" : "password"}
          className={cn("pr-11", className)}
          {...props}
        />
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-lg p-2 text-subtle transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
          aria-label={visible ? "Hide password" : "Show password"}
          tabIndex={-1}
        >
          {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
    );
  },
);
PasswordInput.displayName = "PasswordInput";

const RULES = [
  { label: "8+ characters", test: (value: string) => value.length >= 8 },
  { label: "Lowercase", test: (value: string) => /[a-z]/.test(value) },
  { label: "Uppercase", test: (value: string) => /[A-Z]/.test(value) },
  { label: "Number", test: (value: string) => /[0-9]/.test(value) },
];

/**
 * Live checklist mirroring `passwordSchema`. Showing the rules as they are met
 * beats submitting and reading an error.
 */
export function PasswordStrength({ value }: { value: string }) {
  const met = RULES.filter((rule) => rule.test(value)).length;
  const percent = (met / RULES.length) * 100;

  const tone =
    met <= 1 ? "#EF4444" : met === 2 ? "#F59E0B" : met === 3 ? "#38BDF8" : "#22C55E";

  if (!value) return null;

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className="space-y-2 overflow-hidden pt-1"
    >
      <div className="h-1 w-full overflow-hidden rounded-full bg-white/[0.06]">
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: tone, boxShadow: `0 0 10px ${tone}80` }}
          animate={{ width: `${percent}%` }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        />
      </div>

      <ul className="flex flex-wrap gap-x-3 gap-y-1">
        {RULES.map((rule) => {
          const passed = rule.test(value);
          return (
            <li
              key={rule.label}
              className={cn(
                "flex items-center gap-1 text-[11px] transition-colors duration-200",
                passed ? "text-success" : "text-subtle",
              )}
            >
              <span
                className={cn(
                  "size-1.5 rounded-full transition-colors duration-200",
                  passed ? "bg-success" : "bg-white/20",
                )}
              />
              {rule.label}
            </li>
          );
        })}
      </ul>
    </motion.div>
  );
}

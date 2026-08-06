import * as React from "react";

import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Rendered inside the field, before the text. */
  icon?: React.ReactNode;
  /** Rendered inside the field, after the text (units, actions). */
  suffix?: React.ReactNode;
  invalid?: boolean;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, icon, suffix, invalid, ...props }, ref) => {
    const field = (
      <input
        type={type}
        ref={ref}
        aria-invalid={invalid || undefined}
        className={cn(
          "flex h-10 w-full rounded-xl border border-white/[0.10] bg-white/[0.03] px-3.5 py-2 text-sm text-white shadow-inner shadow-black/20 transition-all duration-300 ease-smooth",
          "placeholder:text-subtle",
          "hover:border-white/[0.18]",
          "focus-visible:border-primary/60 focus-visible:bg-white/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25 focus-visible:ring-offset-0",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-white",
          invalid &&
            "border-danger/60 focus-visible:border-danger focus-visible:ring-danger/25",
          icon && "pl-10",
          suffix && "pr-10",
          className,
        )}
        {...props}
      />
    );

    if (!icon && !suffix) return field;

    return (
      <div className="relative w-full">
        {icon ? (
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-subtle [&_svg]:size-4">
            {icon}
          </span>
        ) : null}
        {field}
        {suffix ? (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-subtle [&_svg]:size-4">
            {suffix}
          </span>
        ) : null}
      </div>
    );
  },
);
Input.displayName = "Input";

export { Input };

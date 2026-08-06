import * as React from "react";

import { cn } from "@/lib/utils";

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, invalid, ...props }, ref) => (
    <textarea
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(
        "flex min-h-[84px] w-full resize-y rounded-xl border border-white/[0.10] bg-white/[0.03] px-3.5 py-2.5 text-sm text-white shadow-inner shadow-black/20 transition-all duration-300 ease-smooth",
        "placeholder:text-subtle",
        "hover:border-white/[0.18]",
        "focus-visible:border-primary/60 focus-visible:bg-white/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25",
        "disabled:cursor-not-allowed disabled:opacity-50",
        invalid && "border-danger/60 focus-visible:border-danger focus-visible:ring-danger/25",
        className,
      )}
      {...props}
    />
  ),
);
Textarea.displayName = "Textarea";

export { Textarea };

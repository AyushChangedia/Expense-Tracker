import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "relative inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium transition-all duration-300 ease-smooth focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 active:scale-[0.98]",
  {
    variants: {
      variant: {
        // The brand button: gradient fill plus a glow that blooms on hover.
        default:
          "bg-brand-gradient bg-[length:200%_200%] text-white shadow-[0_8px_24px_-8px_rgba(124,58,237,0.7)] hover:bg-[position:100%_50%] hover:shadow-[0_12px_34px_-8px_rgba(124,58,237,0.95)]",
        secondary:
          "border border-white/[0.08] bg-white/[0.04] text-white hover:border-white/[0.16] hover:bg-white/[0.08]",
        outline:
          "border border-white/[0.12] bg-transparent text-white hover:border-primary/50 hover:bg-primary/10",
        ghost: "text-muted-foreground hover:bg-white/[0.06] hover:text-white",
        destructive:
          "bg-danger/90 text-white shadow-[0_8px_24px_-10px_rgba(239,68,68,0.8)] hover:bg-danger hover:shadow-[0_12px_30px_-10px_rgba(239,68,68,0.95)]",
        "destructive-ghost":
          "text-danger hover:bg-danger/10 hover:text-danger",
        success:
          "bg-success/90 text-white shadow-[0_8px_24px_-10px_rgba(34,197,94,0.8)] hover:bg-success",
        link: "text-primary-300 underline-offset-4 hover:underline hover:text-primary-200",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-8 rounded-lg px-3 text-xs",
        lg: "h-12 rounded-xl px-7 text-base",
        icon: "size-10",
        "icon-sm": "size-8 rounded-lg",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, variant, size, asChild = false, loading = false, children, disabled, ...props },
    ref,
  ) => {
    const Comp = asChild ? Slot : "button";

    // `asChild` forwards to a single child element, so a spinner cannot be
    // injected alongside it without breaking Slot's single-child contract.
    if (asChild) {
      return (
        <Comp
          className={cn(buttonVariants({ variant, size, className }))}
          ref={ref}
          {...props}
        >
          {children}
        </Comp>
      );
    }

    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {loading ? (
          <>
            <Loader2 className="size-4 animate-spin" aria-hidden />
            <span className="sr-only">Working…</span>
            <span aria-hidden className="contents">
              {children}
            </span>
          </>
        ) : (
          children
        )}
      </button>
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };

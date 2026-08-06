import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

/**
 * FluxFin design system.
 *
 * The palette is dark-only by design: every surface token is tuned against the
 * #08080B canvas, and the gradients are the product's primary brand signal.
 */
const config: Config = {
  darkMode: "class",
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
    "./src/lib/**/*.{ts,tsx}",
    "./src/hooks/**/*.{ts,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: { DEFAULT: "1rem", sm: "1.5rem", lg: "2rem", "2xl": "2.5rem" },
      screens: { "2xl": "1440px" },
    },
    extend: {
      colors: {
        canvas: "#08080B",
        surface: {
          DEFAULT: "#111827",
          muted: "#18181B",
          raised: "#1C1C21",
        },
        border: "rgba(255,255,255,0.08)",
        input: "rgba(255,255,255,0.10)",
        ring: "#8B5CF6",
        background: "#08080B",
        foreground: "#FFFFFF",
        primary: {
          DEFAULT: "#8B5CF6",
          foreground: "#FFFFFF",
          50: "#F3EFFF",
          100: "#E5DBFF",
          200: "#CDBAFF",
          300: "#B394FF",
          400: "#A855F7",
          500: "#8B5CF6",
          600: "#7C3AED",
          700: "#6825D4",
          800: "#521CA8",
          900: "#3B1479",
        },
        cyan: {
          DEFAULT: "#22D3EE",
          bright: "#38BDF8",
        },
        secondary: {
          DEFAULT: "#18181B",
          foreground: "#FFFFFF",
        },
        muted: {
          DEFAULT: "#18181B",
          foreground: "#A1A1AA",
        },
        subtle: "#71717A",
        accent: {
          DEFAULT: "#8B5CF6",
          foreground: "#FFFFFF",
        },
        popover: {
          DEFAULT: "#111827",
          foreground: "#FFFFFF",
        },
        card: {
          DEFAULT: "#111827",
          foreground: "#FFFFFF",
        },
        success: {
          DEFAULT: "#22C55E",
          soft: "rgba(34,197,94,0.12)",
        },
        danger: {
          DEFAULT: "#EF4444",
          soft: "rgba(239,68,68,0.12)",
        },
        destructive: {
          DEFAULT: "#EF4444",
          foreground: "#FFFFFF",
        },
        warning: {
          DEFAULT: "#F59E0B",
          soft: "rgba(245,158,11,0.12)",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      borderRadius: {
        lg: "0.75rem",
        xl: "1rem",
        "2xl": "1.25rem",
        "3xl": "1.75rem",
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(139,92,246,0.22), 0 18px 48px -18px rgba(124,58,237,0.55)",
        "glow-sm": "0 0 24px -6px rgba(139,92,246,0.55)",
        "glow-cyan": "0 0 0 1px rgba(34,211,238,0.22), 0 18px 48px -18px rgba(34,211,238,0.45)",
        card: "0 1px 0 0 rgba(255,255,255,0.04) inset, 0 24px 60px -32px rgba(0,0,0,0.9)",
        lift: "0 1px 0 0 rgba(255,255,255,0.07) inset, 0 32px 70px -28px rgba(0,0,0,0.95)",
      },
      backgroundImage: {
        "brand-gradient": "linear-gradient(135deg, #7C3AED 0%, #A855F7 50%, #38BDF8 100%)",
        "brand-gradient-soft":
          "linear-gradient(135deg, rgba(124,58,237,0.18) 0%, rgba(168,85,247,0.14) 50%, rgba(56,189,248,0.16) 100%)",
        "grid-faint":
          "linear-gradient(to right, rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.035) 1px, transparent 1px)",
      },
      backgroundSize: {
        grid: "56px 56px",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "fade-up": {
          from: { opacity: "0", transform: "translateY(12px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
        float: {
          "0%, 100%": { transform: "translate3d(0,0,0) scale(1)" },
          "50%": { transform: "translate3d(0,-24px,0) scale(1.06)" },
        },
        "float-slow": {
          "0%, 100%": { transform: "translate3d(0,0,0) scale(1.04)" },
          "50%": { transform: "translate3d(18px,20px,0) scale(0.96)" },
        },
        "gradient-pan": {
          "0%, 100%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
        },
        "pulse-ring": {
          "0%": { opacity: "0.7", transform: "scale(0.94)" },
          "70%": { opacity: "0", transform: "scale(1.25)" },
          "100%": { opacity: "0", transform: "scale(1.25)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-up": "fade-up 0.5s cubic-bezier(0.16,1,0.3,1) both",
        shimmer: "shimmer 1.8s infinite",
        float: "float 14s ease-in-out infinite",
        "float-slow": "float-slow 20s ease-in-out infinite",
        "gradient-pan": "gradient-pan 8s ease infinite",
        "pulse-ring": "pulse-ring 2.4s cubic-bezier(0.4,0,0.6,1) infinite",
      },
      transitionTimingFunction: {
        smooth: "cubic-bezier(0.16, 1, 0.3, 1)",
      },
    },
  },
  plugins: [tailwindcssAnimate],
};

export default config;

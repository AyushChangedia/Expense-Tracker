export type CurrencyOption = {
  code: string;
  label: string;
  symbol: string;
};

export const CURRENCIES: CurrencyOption[] = [
  { code: "USD", label: "US Dollar", symbol: "$" },
  { code: "EUR", label: "Euro", symbol: "€" },
  { code: "GBP", label: "British Pound", symbol: "£" },
  { code: "INR", label: "Indian Rupee", symbol: "₹" },
  { code: "JPY", label: "Japanese Yen", symbol: "¥" },
  { code: "CAD", label: "Canadian Dollar", symbol: "CA$" },
  { code: "AUD", label: "Australian Dollar", symbol: "A$" },
  { code: "SGD", label: "Singapore Dollar", symbol: "S$" },
  { code: "AED", label: "UAE Dirham", symbol: "د.إ" },
  { code: "CHF", label: "Swiss Franc", symbol: "CHF" },
  { code: "BRL", label: "Brazilian Real", symbol: "R$" },
  { code: "ZAR", label: "South African Rand", symbol: "R" },
];

export const DEFAULT_CURRENCY = "USD";

const symbolCache = new Map<string, string>();

export function currencySymbol(code: string): string {
  const known = CURRENCIES.find((c) => c.code === code);
  if (known) return known.symbol;

  const cached = symbolCache.get(code);
  if (cached) return cached;

  try {
    // Intl gives us the symbol for currencies outside our curated list.
    const parts = new Intl.NumberFormat("en", {
      style: "currency",
      currency: code,
    }).formatToParts(0);
    const symbol = parts.find((p) => p.type === "currency")?.value ?? code;
    symbolCache.set(code, symbol);
    return symbol;
  } catch {
    return code;
  }
}

type FormatOptions = {
  currency?: string;
  locale?: string;
  /** Drop the decimal part when the value is a whole number. */
  compact?: boolean;
  /** Always show a leading + or −. */
  signed?: boolean;
  maximumFractionDigits?: number;
};

export function formatCurrency(
  value: number,
  {
    currency = DEFAULT_CURRENCY,
    locale = "en-US",
    compact = false,
    signed = false,
    maximumFractionDigits,
  }: FormatOptions = {},
): string {
  const safeValue = Number.isFinite(value) ? value : 0;
  const abs = Math.abs(safeValue);

  let formatted: string;
  try {
    formatted = new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      notation: compact && abs >= 10_000 ? "compact" : "standard",
      maximumFractionDigits:
        maximumFractionDigits ?? (compact && abs >= 10_000 ? 1 : 2),
      minimumFractionDigits: compact && abs >= 10_000 ? 0 : 2,
    }).format(abs);
  } catch {
    formatted = `${currencySymbol(currency)}${abs.toFixed(2)}`;
  }

  if (signed && safeValue !== 0) {
    return `${safeValue > 0 ? "+" : "−"}${formatted}`;
  }
  return safeValue < 0 ? `−${formatted}` : formatted;
}

/** Compact axis/tick labels: 1.2K, 340, 1.1M. */
export function formatCompactNumber(value: number, locale = "en-US"): string {
  try {
    return new Intl.NumberFormat(locale, {
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(value);
  } catch {
    return String(Math.round(value));
  }
}

export function formatPercent(value: number, fractionDigits = 1): string {
  if (!Number.isFinite(value)) return "—";
  return `${value > 0 ? "+" : ""}${value.toFixed(fractionDigits)}%`;
}

/**
 * Parses user-typed money: "$1,234.50", "1 234,50", "12.5k".
 * Returns null when nothing numeric can be recovered.
 */
export function parseAmount(input: string): number | null {
  if (typeof input !== "string") return null;
  let raw = input.trim().toLowerCase();
  if (!raw) return null;

  let multiplier = 1;
  if (/[\d.,]\s*k$/.test(raw)) {
    multiplier = 1_000;
    raw = raw.replace(/k$/, "");
  } else if (/[\d.,]\s*m$/.test(raw)) {
    multiplier = 1_000_000;
    raw = raw.replace(/m$/, "");
  }

  // Strip everything that cannot be part of a number.
  raw = raw.replace(/[^0-9.,-]/g, "").trim();
  if (!raw) return null;

  const lastComma = raw.lastIndexOf(",");
  const lastDot = raw.lastIndexOf(".");

  if (lastComma > -1 && lastDot > -1) {
    // Whichever separator comes last is the decimal separator.
    if (lastComma > lastDot) {
      raw = raw.replace(/\./g, "").replace(",", ".");
    } else {
      raw = raw.replace(/,/g, "");
    }
  } else if (lastComma > -1) {
    const decimals = raw.length - lastComma - 1;
    // "1,50" is a decimal; "1,500" is a thousands separator.
    raw = decimals === 3 ? raw.replace(/,/g, "") : raw.replace(",", ".");
  }

  const parsed = Number.parseFloat(raw);
  if (!Number.isFinite(parsed)) return null;
  return parsed * multiplier;
}

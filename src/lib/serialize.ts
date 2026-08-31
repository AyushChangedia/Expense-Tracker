import { Prisma } from "@prisma/client";

/**
 * Prisma returns `Decimal` objects and `Date` instances. Neither crosses the
 * server -> client component boundary cleanly (Decimal throws, Date is fine
 * but inconsistent once nested in JSON), so every payload that reaches a
 * client component is normalised here: Decimal -> number, Date -> ISO string.
 */
type Serialized<T> = T extends Prisma.Decimal
  ? number
  : T extends Date
    ? string
    : T extends Array<infer U>
      ? Serialized<U>[]
      : T extends object
        ? { [K in keyof T]: Serialized<T[K]> }
        : T;

export function serialize<T>(value: T): Serialized<T> {
  if (value === null || value === undefined) {
    return value as Serialized<T>;
  }

  if (Prisma.Decimal.isDecimal(value)) {
    return (value as Prisma.Decimal).toNumber() as Serialized<T>;
  }

  if (value instanceof Date) {
    return value.toISOString() as Serialized<T>;
  }

  if (Array.isArray(value)) {
    return value.map((item) => serialize(item)) as Serialized<T>;
  }

  if (typeof value === "object") {
    const output: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      output[key] = serialize(item);
    }
    return output as Serialized<T>;
  }

  return value as Serialized<T>;
}

/** Convert a Decimal|number|string to a plain number, defaulting to 0. */
export function toNumber(
  value: Prisma.Decimal | number | string | null | undefined,
): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return value.toNumber();
}

/**
 * Money going *into* Prisma — keeps everything at 2dp.
 *
 * Non-finite input is refused rather than converted. `NaN.toFixed(2)` is the
 * string "NaN", and `new Prisma.Decimal("NaN")` is a perfectly valid Decimal
 * that only fails at the point of the INSERT, as a driver error naming a
 * column rather than the arithmetic that produced it. Infinity is the same
 * story. Both mean a calculation went wrong upstream, and the useful place to
 * find that out is here.
 */
export function toDecimal(value: number): Prisma.Decimal {
  if (!Number.isFinite(value)) {
    throw new TypeError(`Cannot store ${value} as a currency amount.`);
  }
  return new Prisma.Decimal(value.toFixed(2));
}

# Tests

```bash
npm test          # once
npm run test:watch
npm run check     # typecheck, lint, then the suite
```

Nothing to install. The suite runs on Node's built-in test runner through
`tsx`, which was already a dev dependency for `prisma db seed` — so adding
tests costs the project **no new packages**, and `tsx` resolves the `@/*`
alias from `tsconfig.json` the same way Next does.

## What is tested, and what is not

Everything under `src/lib/` that is a pure function of its arguments: money
formatting and parsing, the calendar-day helpers, the natural-language
quick-add parser, CSV and JSON import normalisation, the insights engine, and
the Zod schemas.

Deliberately **not** tested here:

- **React components.** They would need a DOM, a renderer and a testing
  library — three dependencies and a config file to assert things the type
  checker mostly already guarantees.
- **Server actions and queries.** They are thin wrappers over Prisma; testing
  them means a live PostgreSQL, which belongs in an integration suite with a
  container, not in a unit run that has to stay fast enough to use.
- **`runDueRecurring`.** It talks to the database. The scheduling arithmetic it
  depends on lives in `advanceRecurrence` and `computeNextRunDate`, and *that*
  is tested exhaustively — including the month-end cases that are the whole
  reason recurring rules go wrong.

The rule of thumb: test the code where a wrong answer is silent. A broken
component throws or renders visibly wrong. A subtly wrong `parseAmount` books
₹1.23 instead of ₹1,234.50 and nobody notices until they reconcile.

## Conventions

- One file per module under test, named `<module>.test.ts`.
- Dates are always passed in explicitly. No test may depend on the day it runs
  — every function that needs "now" takes it as a parameter for exactly this
  reason, and a test that reads the system clock is a test that fails on the
  1st of some month a year from now.

## Timezones

`npm run test:tz` runs the whole suite in five zones on both sides of the
meridian. This is not belt-and-braces: `toUtcDay` converts a *local* calendar
date to midnight UTC, so applying it to a value that is already a stored UTC
day walks the day backwards anywhere behind UTC, and the two cases are
indistinguishable by type. A suite that only runs in UTC cannot see it. CI
runs this target rather than plain `npm test`.

# FluxFin

A production-ready expense tracker and personal finance dashboard — budgets, goals,
recurring transactions, analytics, and a natural-language quick-add, all running
against your own PostgreSQL database.

Dark-only by design, built on Next.js 15 App Router with server components and
server actions throughout.

**Live demo → [expense-tracker-orcin-gamma-88.vercel.app](https://expense-tracker-orcin-gamma-88.vercel.app/)**

Sign up with any email to get your own workspace — accounts are isolated, and a
fresh one starts with the full category catalogue ready to go.

---

## Quick start

```bash
npm install
cp .env.example .env      # then set DATABASE_URL and AUTH_SECRET
npx prisma migrate dev
npm run db:seed           # optional — 12 months of demo data
npm run dev
```

Open <http://localhost:3000>.

If you seeded, sign in with:

| Field    | Value              |
| -------- | ------------------ |
| Email    | `demo@fluxfin.app` |
| Password | `Demo1234!`        |

### Required environment variables

| Variable       | Required | Notes                                       |
| -------------- | -------- | ------------------------------------------- |
| `DATABASE_URL` | yes      | PostgreSQL connection string                |
| `AUTH_SECRET`  | yes      | `openssl rand -base64 32`                   |
| `AUTH_URL`     | local    | `http://localhost:3000` — Vercel sets it    |

### Optional

| Variable                             | Effect                                                  |
| ------------------------------------ | ------------------------------------------------------- |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | Enables "Continue with Google". Omit and the button is hidden — email + password works on its own. |
| `RESEND_API_KEY`, `EMAIL_FROM`       | Sends real password-reset emails. Without it, the reset link is logged server-side and surfaced in the UI in development, so the flow is testable on a fresh clone. |

---

## Tech stack

| Layer      | Choice                                                             |
| ---------- | ------------------------------------------------------------------ |
| Framework  | Next.js 15 (App Router, React 19, TypeScript strict)                |
| Styling    | TailwindCSS 3 + custom design tokens, shadcn/ui-style Radix components |
| Motion     | Framer Motion                                                       |
| Charts     | Recharts                                                            |
| Icons      | Lucide                                                              |
| Data       | Prisma 6 + PostgreSQL                                               |
| Auth       | Auth.js v5 (credentials + Google OAuth), JWT sessions, bcrypt       |
| Validation | Zod on every input, client and server                               |
| Files      | PapaParse (CSV), ExcelJS (XLSX)                                     |

---

## Features

**Transactions** — create, edit, duplicate, delete, bulk delete, pin. Search across
descriptions, notes, categories, and tags. Filter by type, category, tag, date range,
and amount range. Sortable columns, configurable page size. Every delete offers
**undo** that restores the original row, id and tags intact.

**Dashboard** — five headline figures (income, expenses, savings, balance, and a
rolling 30-day net cash flow), a four-view chart deck, budget progress, goal
progress, pinned transactions, upcoming recurring entries, and an activity timeline.

**Budgets** — monthly caps per category or one overall cap. Progress bars turn amber
at 80% and red past 100%, with a straight-line projection of where the month lands
and a per-day allowance for what is left. Copy a whole month's budgets forward in
one click.

**Goals** — savings targets with optional deadlines. Contributions are logged
individually, and the required monthly contribution to land on time is computed
from what remains.

**Recurring** — daily, weekly, monthly, or yearly rules with an interval multiplier
(e.g. every 2 weeks). Rules materialise themselves on page load; a rule starting in
the past posts its whole backlog at once. Pause, resume, or delete — generated
transactions survive by default.

**Analytics** — monthly trend, income vs expenses, category breakdowns for both
sides of the ledger, net-worth curve, savings rate, weekday spending averages,
budget vs actual, and cumulative savings growth.

**Calendar** — a month grid shaded by spending intensity. Click a day to see its
transactions, double-click to add one.

**Insights** — a rule engine that scores your own aggregates (budget pace,
month-over-month deltas, category concentration, weekday clustering, goal funding
rates) and surfaces the strongest signals in plain English. No model call, no API
key: the same numbers always produce the same read.

**Natural-language quick add** — type `I spent $25 on pizza yesterday` and it parses
the amount, date, category, direction, and `#tags`, showing a live preview before
anything is saved. Fully deterministic and offline.

**Import / export** — import CSV, XLSX, or JSON with a preview step; column names
are matched loosely so most bank exports work unchanged, including separate
debit/credit columns. Export to CSV, a formatted Excel workbook with a summary
sheet, or JSON — plus a full account backup.

**Command palette** — `⌘K` / `Ctrl K` for global search and every navigation and
creation action. `⌘E` / `⌘I` add an expense or income from anywhere; `g` then a
letter jumps between pages.

**Settings** — profile, currency (12 presets plus any ISO code `Intl` accepts),
locale, date format, week start, password change, data export, clear-all-data, and
account deletion.

---

## Project structure

```
prisma/
  schema.prisma          # 14 models, enums, indexes
  migrations/            # committed SQL migrations
  seed.ts                # deterministic 12-month demo dataset
src/
  app/
    (auth)/              # login, signup, forgot/reset password
    (dashboard)/         # every authenticated page
    api/                 # auth handler, search, export, import preview
  components/
    ui/                  # Radix-based primitives
    charts/              # Recharts wrappers + shared tooltip/legend
    <feature>/           # dashboard, transactions, budgets, goals, …
    providers/           # session, preferences, transaction dialog
  lib/                   # auth, prisma, dates, currency, nlp, insights, …
  server/
    actions/             # mutations, "use server"
    queries/             # reads, called from server components
  hooks/
  types/
```

### Notes on the design

- **Money** is `Decimal(14,2)` in Postgres. Prisma returns `Decimal` objects, which
  cannot cross the server → client boundary, so `src/lib/serialize.ts` normalises
  every payload to plain numbers and ISO strings.
- **Dates** are calendar-day facts, stored at `00:00:00 UTC`. A transaction dated
  March 3 is March 3 for every viewer, and month boundaries in SQL never straddle a
  timezone offset.
- **Recurring rules** run on page load rather than via a cron job, so the app stays
  a single deployable unit with no external scheduler. The query is indexed on
  `nextRunDate` and returns nothing on almost every request.
- **Filters live in the URL**, so a filtered transaction view is shareable, survives
  a refresh, and the back button behaves.
- **Server actions** all return `{ ok: true, data } | { ok: false, error }`, so the
  UI has exactly one thing to branch on and nothing throws across the RSC boundary.

---

## Scripts

| Command              | Purpose                              |
| -------------------- | ------------------------------------ |
| `npm run dev`        | Development server                   |
| `npm run build`      | Generate Prisma client, build        |
| `npm run start`      | Serve the production build           |
| `npm run typecheck`  | `tsc --noEmit`                       |
| `npm run lint`       | ESLint                               |
| `npm run db:migrate` | Create and apply a migration         |
| `npm run db:deploy`  | Apply migrations (production)        |
| `npm run db:seed`    | Seed demo data                       |
| `npm run db:studio`  | Prisma Studio                        |
| `npm run db:reset`   | Drop, re-migrate, re-seed            |

---

## Deploying

**Neon + Vercel**

1. Import the repo into Vercel.
2. Add a Neon database from the Storage tab — it sets `DATABASE_URL` for you.
   Use the **direct (unpooled)** connection string: this app opens few
   connections, and migrations run cleanly without going through pgbouncer.
3. Set `AUTH_SECRET` (`openssl rand -base64 32`) and `AUTH_TRUST_HOST=true`. Add
   the Google variables only if you want OAuth.
4. Deploy. `npm run build` runs `prisma generate && prisma migrate deploy && next
   build`, so the schema is applied on every deploy — there is no separate
   migration step.

Seeding is optional and never runs automatically. To load the demo dataset, run
`npm run db:seed` locally with `DATABASE_URL` pointed at the deployed database.

For Google OAuth, add `https://your-domain/api/auth/callback/google` as an
authorised redirect URI.

---

## Accessibility and performance

Dark-only, but the palette holds contrast: body text sits at 4.6:1 against the
canvas and headings well above that. Every interactive element is reachable by
keyboard with a visible focus ring, dialogs trap focus via Radix, icon-only buttons
carry labels, and `prefers-reduced-motion` disables every animation.

Charts, ExcelJS, and heavy icon sets are code-split; `optimizePackageImports` trims
the icon and chart barrels. Lists are paginated server-side, aggregates use grouped
queries rather than per-row round trips, and the dashboard fetches its ten data sets
concurrently. Suspense boundaries stream each page in behind a skeleton that matches
the real layout.

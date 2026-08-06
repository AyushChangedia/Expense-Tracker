/**
 * Seeds a demo account with a year of believable financial history.
 *
 * Deterministic: a fixed-seed PRNG means `npm run db:seed` produces the same
 * numbers every time, so screenshots, tests, and demos stay stable.
 *
 * Run with:  npm run db:seed
 */

import { PrismaClient, type TransactionType } from "@prisma/client";
import bcrypt from "bcryptjs";

import { DEFAULT_CATEGORIES } from "../src/lib/categories";

const prisma = new PrismaClient();

const EMAIL = process.env.SEED_USER_EMAIL ?? "demo@fluxfin.app";
const PASSWORD = process.env.SEED_USER_PASSWORD ?? "Demo1234!";
const MONTHS_OF_HISTORY = 12;

// --- Deterministic PRNG (mulberry32) ---------------------------------------
let seedState = 0x9e3779b9;

function random(): number {
  seedState |= 0;
  seedState = (seedState + 0x6d2b79f5) | 0;
  let t = Math.imul(seedState ^ (seedState >>> 15), 1 | seedState);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function randomBetween(min: number, max: number): number {
  return min + random() * (max - min);
}

function randomInt(min: number, max: number): number {
  return Math.floor(randomBetween(min, max + 1));
}

function pick<T>(items: T[]): T {
  return items[randomInt(0, items.length - 1)];
}

function money(min: number, max: number): number {
  return Math.round(randomBetween(min, max) * 100) / 100;
}

function utcDay(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
}

// --- Transaction templates --------------------------------------------------

type Template = {
  slug: string;
  descriptions: string[];
  min: number;
  max: number;
  /** Roughly how many times this shows up per month. */
  perMonth: number;
  tags?: string[];
};

const EXPENSE_TEMPLATES: Template[] = [
  {
    slug: "food",
    descriptions: [
      "Grocery run", "Lunch with the team", "Coffee", "Dinner at Nori",
      "Weekend brunch", "Bakery", "Takeaway pizza", "Farmers market",
    ],
    min: 8, max: 95, perMonth: 12, tags: ["essentials"],
  },
  {
    slug: "transport",
    descriptions: [
      "Fuel", "Uber home", "Monthly transit pass", "Parking", "Train ticket",
    ],
    min: 3, max: 85, perMonth: 6,
  },
  {
    slug: "shopping",
    descriptions: [
      "Winter jacket", "Running shoes", "Headphones", "Desk lamp",
      "Birthday gift", "Household supplies",
    ],
    min: 18, max: 260, perMonth: 3, tags: ["wants"],
  },
  {
    slug: "bills",
    descriptions: ["Electricity", "Internet", "Water", "Phone plan", "Home insurance"],
    min: 28, max: 140, perMonth: 4, tags: ["essentials"],
  },
  {
    slug: "entertainment",
    descriptions: ["Cinema tickets", "Concert", "Board game night", "Museum entry"],
    min: 12, max: 120, perMonth: 2, tags: ["wants"],
  },
  {
    slug: "health",
    descriptions: ["Pharmacy", "Dentist", "Physio session", "Vitamins"],
    min: 15, max: 180, perMonth: 1,
  },
  {
    slug: "education",
    descriptions: ["Online course", "Technical book", "Workshop ticket"],
    min: 20, max: 240, perMonth: 1, tags: ["growth"],
  },
  {
    slug: "travel",
    descriptions: ["Flight", "Hotel night", "Airbnb", "Travel insurance"],
    min: 90, max: 620, perMonth: 0.4, tags: ["wants"],
  },
];

const INCOME_TEMPLATES: Template[] = [
  {
    slug: "freelance",
    descriptions: ["Client project", "Consulting day", "Design retainer"],
    min: 380, max: 1800, perMonth: 0.8, tags: ["side-income"],
  },
  {
    slug: "business",
    descriptions: ["Dividend payout", "Affiliate revenue", "Course sales"],
    min: 90, max: 700, perMonth: 0.5,
  },
];

/** Rules that become real recurring transactions, not one-offs. */
const RECURRING = [
  {
    slug: "salary", description: "Monthly salary", amount: 5400,
    type: "INCOME" as TransactionType, frequency: "MONTHLY" as const, dayOfMonth: 1,
  },
  {
    slug: "bills", description: "Rent", amount: 1450,
    type: "EXPENSE" as TransactionType, frequency: "MONTHLY" as const, dayOfMonth: 1,
  },
  {
    slug: "subscriptions", description: "Netflix", amount: 15.99,
    type: "EXPENSE" as TransactionType, frequency: "MONTHLY" as const, dayOfMonth: 8,
  },
  {
    slug: "subscriptions", description: "Spotify", amount: 10.99,
    type: "EXPENSE" as TransactionType, frequency: "MONTHLY" as const, dayOfMonth: 12,
  },
  {
    slug: "subscriptions", description: "iCloud storage", amount: 2.99,
    type: "EXPENSE" as TransactionType, frequency: "MONTHLY" as const, dayOfMonth: 18,
  },
  {
    slug: "health", description: "Gym membership", amount: 42,
    type: "EXPENSE" as TransactionType, frequency: "MONTHLY" as const, dayOfMonth: 5,
  },
  {
    slug: "investment", description: "Index fund contribution", amount: 600,
    type: "EXPENSE" as TransactionType, frequency: "MONTHLY" as const, dayOfMonth: 3,
  },
];

const TAG_COLORS: Record<string, string> = {
  essentials: "#22C55E",
  wants: "#EC4899",
  growth: "#38BDF8",
  "side-income": "#A855F7",
};

async function main() {
  console.log("Seeding FluxFin…\n");

  // --- User ---------------------------------------------------------------
  const passwordHash = await bcrypt.hash(PASSWORD, 12);

  const user = await prisma.user.upsert({
    where: { email: EMAIL },
    update: { passwordHash },
    create: {
      email: EMAIL,
      name: "Demo User",
      passwordHash,
      currency: "USD",
      locale: "en-US",
      dateFormat: "MMM d, yyyy",
      onboarded: true,
    },
  });
  console.log(`  user            ${user.email}`);

  // Start from a clean slate so re-running does not stack duplicate history.
  await prisma.$transaction([
    prisma.transaction.deleteMany({ where: { userId: user.id } }),
    prisma.recurringTransaction.deleteMany({ where: { userId: user.id } }),
    prisma.budget.deleteMany({ where: { userId: user.id } }),
    prisma.goalContribution.deleteMany({ where: { userId: user.id } }),
    prisma.goal.deleteMany({ where: { userId: user.id } }),
    prisma.tag.deleteMany({ where: { userId: user.id } }),
    prisma.activity.deleteMany({ where: { userId: user.id } }),
    prisma.notification.deleteMany({ where: { userId: user.id } }),
  ]);

  // --- Categories ---------------------------------------------------------
  await prisma.category.createMany({
    data: DEFAULT_CATEGORIES.map((category, index) => ({
      userId: user.id,
      name: category.name,
      slug: category.slug,
      kind: category.kind,
      icon: category.icon,
      gradientFrom: category.gradientFrom,
      gradientTo: category.gradientTo,
      isDefault: true,
      isFavorite: ["food", "transport", "salary", "bills"].includes(category.slug),
      sortOrder: index,
    })),
    skipDuplicates: true,
  });

  const categories = await prisma.category.findMany({
    where: { userId: user.id },
    select: { id: true, slug: true },
  });
  const categoryBySlug = new Map(categories.map((c) => [c.slug, c.id]));
  console.log(`  categories      ${categories.length}`);

  // --- Tags ---------------------------------------------------------------
  await prisma.tag.createMany({
    data: Object.entries(TAG_COLORS).map(([slug, color]) => ({
      userId: user.id,
      name: slug.replace(/-/g, " "),
      slug,
      color,
    })),
    skipDuplicates: true,
  });

  const tags = await prisma.tag.findMany({
    where: { userId: user.id },
    select: { id: true, slug: true },
  });
  const tagBySlug = new Map(tags.map((t) => [t.slug, t.id]));
  console.log(`  tags            ${tags.length}`);

  // --- Recurring rules ----------------------------------------------------
  const now = new Date();
  const historyStart = new Date(
    now.getFullYear(),
    now.getMonth() - (MONTHS_OF_HISTORY - 1),
    1,
  );

  const transactionRows: {
    userId: string;
    categoryId: string;
    type: TransactionType;
    amount: number;
    description: string;
    date: Date;
    notes?: string | null;
    isPinned?: boolean;
    recurringId?: string | null;
  }[] = [];

  for (const rule of RECURRING) {
    const categoryId = categoryBySlug.get(rule.slug);
    if (!categoryId) continue;

    const startDate = utcDay(
      historyStart.getFullYear(),
      historyStart.getMonth(),
      rule.dayOfMonth,
    );

    // The next run is the first occurrence after today.
    const nextRun = utcDay(now.getFullYear(), now.getMonth() + 1, rule.dayOfMonth);

    const created = await prisma.recurringTransaction.create({
      data: {
        userId: user.id,
        categoryId,
        type: rule.type,
        amount: rule.amount,
        description: rule.description,
        frequency: rule.frequency,
        interval: 1,
        startDate,
        nextRunDate: nextRun,
        lastRunDate: utcDay(now.getFullYear(), now.getMonth(), rule.dayOfMonth),
        isActive: true,
      },
      select: { id: true },
    });

    // Materialise the history this rule would have produced.
    for (let offset = 0; offset < MONTHS_OF_HISTORY; offset += 1) {
      const date = utcDay(
        historyStart.getFullYear(),
        historyStart.getMonth() + offset,
        rule.dayOfMonth,
      );
      if (date.getTime() > now.getTime()) break;

      // Salary creeps up a little over the year, like the real thing.
      const drift =
        rule.description === "Monthly salary" ? 1 + offset * 0.006 : 1;

      transactionRows.push({
        userId: user.id,
        categoryId,
        type: rule.type,
        amount: Math.round(rule.amount * drift * 100) / 100,
        description: rule.description,
        date,
        recurringId: created.id,
      });
    }
  }
  console.log(`  recurring       ${RECURRING.length}`);

  // --- Variable transactions ---------------------------------------------
  const taggedRows: { index: number; tagSlugs: string[] }[] = [];

  for (let offset = 0; offset < MONTHS_OF_HISTORY; offset += 1) {
    const monthDate = new Date(
      historyStart.getFullYear(),
      historyStart.getMonth() + offset,
      1,
    );
    const year = monthDate.getFullYear();
    const monthIndex = monthDate.getMonth();
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    const isCurrentMonth =
      year === now.getFullYear() && monthIndex === now.getMonth();
    const lastDay = isCurrentMonth ? now.getDate() : daysInMonth;

    // Seasonal lift towards the end of the year.
    const seasonal = 1 + Math.sin((monthIndex / 12) * Math.PI * 2) * 0.12;

    for (const template of [...EXPENSE_TEMPLATES, ...INCOME_TEMPLATES]) {
      const isIncome = INCOME_TEMPLATES.includes(template);
      const target = template.perMonth * seasonal;
      // Fractional rates become a probability rather than being floored to 0.
      const count =
        Math.floor(target) + (random() < target - Math.floor(target) ? 1 : 0);

      for (let i = 0; i < count; i += 1) {
        const day = randomInt(1, lastDay);
        const categoryId = categoryBySlug.get(template.slug);
        if (!categoryId) continue;

        transactionRows.push({
          userId: user.id,
          categoryId,
          type: isIncome ? "INCOME" : "EXPENSE",
          amount: money(template.min, template.max * seasonal),
          description: pick(template.descriptions),
          date: utcDay(year, monthIndex, day),
        });

        if (template.tags?.length) {
          taggedRows.push({
            index: transactionRows.length - 1,
            tagSlugs: template.tags,
          });
        }
      }
    }
  }

  // Pin a couple of recent entries so the dashboard panel has content.
  const recentIndexes = transactionRows
    .map((row, index) => ({ index, time: row.date.getTime() }))
    .sort((a, b) => b.time - a.time)
    .slice(0, 2);
  for (const entry of recentIndexes) {
    transactionRows[entry.index].isPinned = true;
    transactionRows[entry.index].notes = "Worth keeping an eye on.";
  }

  // Insert with explicit ids so the tag join rows can reference them.
  const withIds = transactionRows.map((row) => ({
    id: crypto.randomUUID(),
    ...row,
  }));

  await prisma.transaction.createMany({ data: withIds });

  const tagLinks = taggedRows.flatMap((entry) =>
    entry.tagSlugs
      .map((slug) => tagBySlug.get(slug))
      .filter((id): id is string => Boolean(id))
      .map((tagId) => ({ transactionId: withIds[entry.index].id, tagId })),
  );

  if (tagLinks.length > 0) {
    await prisma.transactionTag.createMany({
      data: tagLinks,
      skipDuplicates: true,
    });
  }
  console.log(`  transactions    ${withIds.length}`);

  // --- Budgets (current and previous month) -------------------------------
  const budgetPlan: { slug: string | null; amount: number }[] = [
    { slug: null, amount: 3400 },
    { slug: "food", amount: 650 },
    { slug: "transport", amount: 260 },
    { slug: "shopping", amount: 320 },
    { slug: "bills", amount: 1750 },
    { slug: "entertainment", amount: 180 },
    { slug: "subscriptions", amount: 60 },
  ];

  const budgetMonths = [
    { year: now.getFullYear(), month: now.getMonth() + 1 },
    {
      year: now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear(),
      month: now.getMonth() === 0 ? 12 : now.getMonth(),
    },
  ];

  const budgetData = budgetMonths.flatMap((period) =>
    budgetPlan
      .map((plan) => ({
        userId: user.id,
        categoryId: plan.slug ? (categoryBySlug.get(plan.slug) ?? null) : null,
        amount: plan.amount,
        month: period.month,
        year: period.year,
      }))
      .filter((budget) => plan_isValid(budget)),
  );

  await prisma.budget.createMany({ data: budgetData, skipDuplicates: true });
  console.log(`  budgets         ${budgetData.length}`);

  // --- Goals --------------------------------------------------------------
  const goalPlan = [
    {
      name: "Emergency fund",
      targetAmount: 12000,
      currentAmount: 7400,
      icon: "PiggyBank",
      gradientFrom: "#22C55E",
      gradientTo: "#4ADE80",
      monthsOut: 8,
      notes: "Six months of essential expenses.",
    },
    {
      name: "Japan trip",
      targetAmount: 4500,
      currentAmount: 1850,
      icon: "Plane",
      gradientFrom: "#14B8A6",
      gradientTo: "#22D3EE",
      monthsOut: 6,
      notes: "Two weeks in spring.",
    },
    {
      name: "New laptop",
      targetAmount: 2600,
      currentAmount: 2600,
      icon: "Laptop",
      gradientFrom: "#7C3AED",
      gradientTo: "#38BDF8",
      monthsOut: -1,
      notes: "Replaced the old machine.",
    },
  ];

  for (const plan of goalPlan) {
    const deadline = new Date(
      now.getFullYear(),
      now.getMonth() + plan.monthsOut,
      15,
    );

    const goal = await prisma.goal.create({
      data: {
        userId: user.id,
        name: plan.name,
        targetAmount: plan.targetAmount,
        currentAmount: plan.currentAmount,
        deadline: plan.monthsOut > 0 ? deadline : null,
        icon: plan.icon,
        gradientFrom: plan.gradientFrom,
        gradientTo: plan.gradientTo,
        notes: plan.notes,
        status: plan.currentAmount >= plan.targetAmount ? "COMPLETED" : "ACTIVE",
      },
      select: { id: true },
    });

    // Spread the balance across the last few months so the savings-growth
    // chart has a real curve rather than one spike.
    const instalments = 6;
    const each = Math.round((plan.currentAmount / instalments) * 100) / 100;

    await prisma.goalContribution.createMany({
      data: Array.from({ length: instalments }, (_, index) => ({
        goalId: goal.id,
        userId: user.id,
        amount: each,
        date: utcDay(now.getFullYear(), now.getMonth() - (instalments - 1 - index), 20),
        note: index === 0 ? "Initial deposit" : "Monthly top-up",
      })),
    });
  }
  console.log(`  goals           ${goalPlan.length}`);

  // --- Activity + notifications -------------------------------------------
  await prisma.activity.createMany({
    data: [
      {
        userId: user.id,
        action: "imported",
        entity: "transaction",
        summary: `Seeded ${withIds.length} transactions across ${MONTHS_OF_HISTORY} months`,
      },
      {
        userId: user.id,
        action: "created",
        entity: "budget",
        summary: `Created ${budgetData.length} budgets`,
      },
      {
        userId: user.id,
        action: "created",
        entity: "goal",
        summary: `Created ${goalPlan.length} savings goals`,
      },
    ],
  });

  await prisma.notification.create({
    data: {
      userId: user.id,
      title: "Welcome to FluxFin",
      message: `Your demo account has ${MONTHS_OF_HISTORY} months of history, budgets, goals, and recurring rules ready to explore.`,
      type: "SUCCESS",
      href: "/dashboard",
    },
  });

  console.log("\nDone.\n");
  console.log(`  Sign in with:  ${EMAIL}`);
  console.log(`  Password:      ${PASSWORD}\n`);
}

/** Drops category budgets whose category could not be resolved. */
function plan_isValid(budget: { categoryId: string | null; amount: number }): boolean {
  return budget.amount > 0;
}

main()
  .catch((error) => {
    console.error("\nSeed failed:\n", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

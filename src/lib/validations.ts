import { z } from "zod";

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

export const transactionTypeSchema = z.enum(["INCOME", "EXPENSE"]);
export const categoryKindSchema = z.enum(["INCOME", "EXPENSE", "BOTH"]);
export const frequencySchema = z.enum(["DAILY", "WEEKLY", "MONTHLY", "YEARLY"]);
export const goalStatusSchema = z.enum(["ACTIVE", "COMPLETED", "ARCHIVED"]);

const hexColor = z
  .string()
  .regex(/^#([0-9a-fA-F]{6})$/, "Must be a 6-digit hex colour");

/**
 * Money: positive, at most 2 decimals, capped below the Decimal(14,2) limit.
 *
 * The decimal check cannot be `Number.isInteger(value * 100)`, because
 * 12.34 * 100 is 1233.9999999999998 in binary floating point and half the
 * valid amounts in the world would be rejected. It compares against the
 * rounded value within a tolerance instead.
 *
 * It also cannot be `Number.isInteger(Math.round(value * 100))`, which is what
 * it was: Math.round returns an integer by definition, so the refinement was
 * always true and a third decimal place was never rejected at all.
 */
const CENT_TOLERANCE = 1e-6;

export const amountSchema = z
  .number({ invalid_type_error: "Enter a valid amount" })
  .finite("Enter a valid amount")
  .positive("Amount must be greater than zero")
  .max(999_999_999.99, "That amount is too large")
  .refine(
    (value) => {
      const cents = value * 100;
      return Math.abs(cents - Math.round(cents)) < CENT_TOLERANCE;
    },
    { message: "Amount can have at most 2 decimal places" },
  );

/** Accepts a Date, an ISO string, or `yyyy-MM-dd`. */
export const dateSchema = z.union([z.date(), z.string().min(1)]).transform((value, ctx) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Enter a valid date" });
    return z.NEVER;
  }
  return date;
});

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export const passwordSchema = z
  .string()
  .min(8, "Use at least 8 characters")
  .max(72, "Passwords are limited to 72 characters")
  .regex(/[a-z]/, "Include a lowercase letter")
  .regex(/[A-Z]/, "Include an uppercase letter")
  .regex(/[0-9]/, "Include a number");

export const signUpSchema = z
  .object({
    name: z.string().trim().min(2, "Enter your name").max(60),
    email: z.string().trim().toLowerCase().email("Enter a valid email"),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const signInSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(1, "Enter your password"),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
});

export const resetPasswordSchema = z
  .object({
    token: z.string().min(10, "This reset link is not valid"),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password"),
    newPassword: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  })
  .refine((data) => data.newPassword !== data.currentPassword, {
    message: "Choose a password you have not used before",
    path: ["newPassword"],
  });

// ---------------------------------------------------------------------------
// Transactions
// ---------------------------------------------------------------------------

export const transactionSchema = z.object({
  type: transactionTypeSchema,
  amount: amountSchema,
  description: z.string().trim().min(1, "Add a description").max(140),
  categoryId: z.string().min(1, "Pick a category"),
  date: dateSchema,
  notes: z.string().trim().max(500).optional().or(z.literal("")),
  tags: z.array(z.string().trim().min(1).max(30)).max(10).default([]),
  isPinned: z.boolean().default(false),
});

export const updateTransactionSchema = transactionSchema.extend({
  id: z.string().min(1),
});

export const transactionIdSchema = z.object({ id: z.string().min(1) });

export const bulkIdsSchema = z.object({
  ids: z.array(z.string().min(1)).min(1, "Select at least one transaction").max(500),
});

export const transactionSortSchema = z.enum([
  "date",
  "amount",
  "description",
  "category",
  "createdAt",
]);

export const transactionFilterSchema = z.object({
  query: z.string().trim().max(120).optional(),
  type: z.union([transactionTypeSchema, z.literal("ALL")]).default("ALL"),
  categoryIds: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
  from: z.string().optional(),
  to: z.string().optional(),
  minAmount: z.number().nonnegative().optional(),
  maxAmount: z.number().nonnegative().optional(),
  pinnedOnly: z.boolean().default(false),
  sort: transactionSortSchema.default("date"),
  direction: z.enum(["asc", "desc"]).default("desc"),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(5).max(100).default(10),
});

export type TransactionFilterInput = z.input<typeof transactionFilterSchema>;
export type TransactionFilters = z.output<typeof transactionFilterSchema>;

// ---------------------------------------------------------------------------
// Categories & tags
// ---------------------------------------------------------------------------

export const categorySchema = z.object({
  name: z.string().trim().min(1, "Name the category").max(40),
  kind: categoryKindSchema,
  icon: z.string().min(1).max(40),
  gradientFrom: hexColor,
  gradientTo: hexColor,
});

export const updateCategorySchema = categorySchema.extend({
  id: z.string().min(1),
});

export const tagSchema = z.object({
  name: z.string().trim().min(1, "Name the tag").max(30),
  color: hexColor.default("#8B5CF6"),
});

// ---------------------------------------------------------------------------
// Budgets
// ---------------------------------------------------------------------------

export const budgetSchema = z.object({
  /** null / "" = an overall budget spanning every expense category. */
  categoryId: z.string().nullable().optional(),
  amount: amountSchema,
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2000).max(2100),
});

export const updateBudgetSchema = budgetSchema.extend({ id: z.string().min(1) });

// ---------------------------------------------------------------------------
// Goals
// ---------------------------------------------------------------------------

export const goalSchema = z.object({
  name: z.string().trim().min(1, "Name the goal").max(60),
  targetAmount: amountSchema,
  currentAmount: z.number().min(0).max(999_999_999.99).default(0),
  deadline: z.union([dateSchema, z.null()]).optional(),
  icon: z.string().min(1).max(40).default("Target"),
  gradientFrom: hexColor.default("#7C3AED"),
  gradientTo: hexColor.default("#38BDF8"),
  notes: z.string().trim().max(300).optional().or(z.literal("")),
});

export const updateGoalSchema = goalSchema.extend({ id: z.string().min(1) });

export const goalContributionSchema = z.object({
  goalId: z.string().min(1),
  amount: amountSchema,
  note: z.string().trim().max(140).optional().or(z.literal("")),
});

// ---------------------------------------------------------------------------
// Recurring
// ---------------------------------------------------------------------------

export const recurringSchema = z
  .object({
    type: transactionTypeSchema,
    amount: amountSchema,
    description: z.string().trim().min(1, "Add a description").max(140),
    categoryId: z.string().min(1, "Pick a category"),
    frequency: frequencySchema,
    interval: z.number().int().min(1).max(52).default(1),
    startDate: dateSchema,
    endDate: z.union([dateSchema, z.null()]).optional(),
    notes: z.string().trim().max(500).optional().or(z.literal("")),
    isActive: z.boolean().default(true),
  })
  .refine(
    (data) => !data.endDate || data.endDate.getTime() >= data.startDate.getTime(),
    { message: "The end date must be after the start date", path: ["endDate"] },
  );

export const updateRecurringSchema = z
  .object({
    id: z.string().min(1),
    type: transactionTypeSchema,
    amount: amountSchema,
    description: z.string().trim().min(1, "Add a description").max(140),
    categoryId: z.string().min(1, "Pick a category"),
    frequency: frequencySchema,
    interval: z.number().int().min(1).max(52).default(1),
    startDate: dateSchema,
    endDate: z.union([dateSchema, z.null()]).optional(),
    notes: z.string().trim().max(500).optional().or(z.literal("")),
    isActive: z.boolean().default(true),
  })
  .refine(
    (data) => !data.endDate || data.endDate.getTime() >= data.startDate.getTime(),
    { message: "The end date must be after the start date", path: ["endDate"] },
  );

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export const profileSchema = z.object({
  name: z.string().trim().min(2, "Enter your name").max(60),
  image: z.string().url("Enter a valid image URL").max(500).optional().or(z.literal("")),
});

export const preferencesSchema = z.object({
  currency: z.string().length(3, "Pick a currency"),
  dateFormat: z.string().min(1).max(30),
  locale: z.string().min(2).max(10),
  weekStart: z.number().int().min(0).max(1),
});

export const deleteAccountSchema = z.object({
  confirmation: z
    .string()
    .refine((value) => value.trim().toUpperCase() === "DELETE", {
      message: 'Type DELETE to confirm',
    }),
});

// ---------------------------------------------------------------------------
// Import
// ---------------------------------------------------------------------------

export const importRowSchema = z.object({
  date: z.string().min(1),
  description: z.string().trim().min(1).max(140),
  amount: z.union([z.string(), z.number()]),
  type: z.string().optional(),
  category: z.string().optional(),
  notes: z.string().optional(),
  tags: z.string().optional(),
});

export type ImportRow = z.infer<typeof importRowSchema>;

// ---------------------------------------------------------------------------
// Natural language quick-add
// ---------------------------------------------------------------------------

export const naturalLanguageSchema = z.object({
  text: z.string().trim().min(3, "Describe the transaction").max(200),
});

export type SignUpInput = z.infer<typeof signUpSchema>;
export type SignInInput = z.infer<typeof signInSchema>;
export type TransactionInput = z.input<typeof transactionSchema>;
export type BudgetInput = z.input<typeof budgetSchema>;
export type GoalInput = z.input<typeof goalSchema>;
export type RecurringInput = z.input<typeof recurringSchema>;

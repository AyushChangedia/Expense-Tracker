import type {
  CategoryKind,
  GoalStatus,
  NotificationType,
  RecurrenceFrequency,
  TransactionType,
} from "@prisma/client";

/** The shape every server action returns, so the UI has one thing to branch on. */
export type ActionResult<T = undefined> =
  | { ok: true; data: T; message?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

export type CategoryDTO = {
  id: string;
  name: string;
  slug: string;
  kind: CategoryKind;
  icon: string;
  gradientFrom: string;
  gradientTo: string;
  isDefault: boolean;
  isFavorite: boolean;
  sortOrder: number;
};

export type TagDTO = {
  id: string;
  name: string;
  slug: string;
  color: string;
};

export type TransactionDTO = {
  id: string;
  type: TransactionType;
  amount: number;
  description: string;
  notes: string | null;
  date: string;
  isPinned: boolean;
  recurringId: string | null;
  createdAt: string;
  category: CategoryDTO;
  tags: TagDTO[];
};

export type TransactionPage = {
  items: TransactionDTO[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
  totals: { income: number; expense: number; net: number };
};

export type BudgetDTO = {
  id: string;
  categoryId: string | null;
  amount: number;
  month: number;
  year: number;
  category: CategoryDTO | null;
};

export type BudgetProgress = BudgetDTO & {
  spent: number;
  remaining: number;
  percentUsed: number;
  status: "healthy" | "warning" | "exceeded";
  transactionCount: number;
  /** Spend per day needed to finish the month exactly on budget. */
  dailyAllowance: number;
  projectedSpend: number;
};

export type GoalDTO = {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  deadline: string | null;
  icon: string;
  gradientFrom: string;
  gradientTo: string;
  status: GoalStatus;
  notes: string | null;
  createdAt: string;
  percentComplete: number;
  remaining: number;
  daysLeft: number | null;
  /** Monthly saving needed to hit the target by the deadline. */
  requiredPerMonth: number | null;
  contributions: GoalContributionDTO[];
};

export type GoalContributionDTO = {
  id: string;
  amount: number;
  date: string;
  note: string | null;
};

export type RecurringDTO = {
  id: string;
  type: TransactionType;
  amount: number;
  description: string;
  notes: string | null;
  frequency: RecurrenceFrequency;
  interval: number;
  startDate: string;
  endDate: string | null;
  nextRunDate: string;
  lastRunDate: string | null;
  isActive: boolean;
  category: CategoryDTO;
  generatedCount: number;
};

export type NotificationDTO = {
  id: string;
  title: string;
  message: string;
  type: NotificationType;
  href: string | null;
  read: boolean;
  createdAt: string;
};

export type ActivityDTO = {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  summary: string;
  amount: number | null;
  createdAt: string;
};

export type UserPreferences = {
  currency: string;
  dateFormat: string;
  locale: string;
  weekStart: number;
};

export type UserProfile = UserPreferences & {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  hasPassword: boolean;
  createdAt: string;
};

// --- Dashboard / analytics ------------------------------------------------

export type StatSummary = {
  income: number;
  expenses: number;
  savings: number;
  balance: number;
  netCashFlow: number;
  savingsRate: number;
  incomeChange: number | null;
  expenseChange: number | null;
  savingsChange: number | null;
  netCashFlowChange: number | null;
  transactionCount: number;
};

export type CategoryBreakdownItem = {
  categoryId: string;
  name: string;
  icon: string;
  gradientFrom: string;
  gradientTo: string;
  total: number;
  count: number;
  share: number;
};

export type MonthlyTrendPoint = {
  key: string;
  label: string;
  longLabel: string;
  income: number;
  expenses: number;
  net: number;
  savingsRate: number;
};

export type DailyPoint = {
  date: string;
  label: string;
  income: number;
  expenses: number;
  net: number;
};

export type CumulativePoint = {
  date: string;
  label: string;
  value: number;
};

export type Insight = {
  id: string;
  title: string;
  detail: string;
  tone: "positive" | "neutral" | "warning" | "critical";
  icon: string;
  metric?: string;
};

export type DashboardData = {
  summary: StatSummary;
  categoryBreakdown: CategoryBreakdownItem[];
  monthlyTrend: MonthlyTrendPoint[];
  weeklySpending: DailyPoint[];
  recentTransactions: TransactionDTO[];
  budgets: BudgetProgress[];
  goals: GoalDTO[];
  insights: Insight[];
  activities: ActivityDTO[];
  pinned: TransactionDTO[];
  upcomingRecurring: RecurringDTO[];
};

export type ParsedTransactionDraft = {
  type: TransactionType;
  amount: number | null;
  description: string;
  date: string;
  categorySlug: string | null;
  categoryId: string | null;
  tags: string[];
  confidence: number;
};

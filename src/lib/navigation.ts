import {
  BarChart3,
  CalendarDays,
  LayoutDashboard,
  ListOrdered,
  PiggyBank,
  RefreshCw,
  Settings,
  Shapes,
  Sparkles,
  Target,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  description: string;
  /** Single-key shortcut, pressed after `g` (e.g. g then d). */
  shortcut?: string;
};

export type NavSection = {
  label: string;
  items: NavItem[];
};

/**
 * The single source of truth for navigation — consumed by the sidebar, the
 * mobile nav, and the command palette, so they can never drift apart.
 */
export const NAV_SECTIONS: NavSection[] = [
  {
    label: "Overview",
    items: [
      {
        href: "/dashboard",
        label: "Dashboard",
        icon: LayoutDashboard,
        description: "Your month at a glance",
        shortcut: "d",
      },
      {
        href: "/analytics",
        label: "Analytics",
        icon: BarChart3,
        description: "Trends, breakdowns, and net worth",
        shortcut: "a",
      },
      {
        href: "/insights",
        label: "Insights",
        icon: Sparkles,
        description: "What your numbers are telling you",
        shortcut: "i",
      },
    ],
  },
  {
    label: "Money",
    items: [
      {
        href: "/transactions",
        label: "Transactions",
        icon: ListOrdered,
        description: "Every entry, searchable",
        shortcut: "t",
      },
      {
        href: "/budgets",
        label: "Budgets",
        icon: PiggyBank,
        description: "Monthly caps and progress",
        shortcut: "b",
      },
      {
        href: "/goals",
        label: "Goals",
        icon: Target,
        description: "Savings targets and contributions",
        shortcut: "g",
      },
      {
        href: "/recurring",
        label: "Recurring",
        icon: RefreshCw,
        description: "Rules that post themselves",
        shortcut: "r",
      },
    ],
  },
  {
    label: "Organise",
    items: [
      {
        href: "/calendar",
        label: "Calendar",
        icon: CalendarDays,
        description: "Spending day by day",
        shortcut: "c",
      },
      {
        href: "/categories",
        label: "Categories",
        icon: Shapes,
        description: "Icons, gradients, and tags",
      },
      {
        href: "/settings",
        label: "Settings",
        icon: Settings,
        description: "Currency, profile, and data",
        shortcut: "s",
      },
    ],
  },
];

export const NAV_ITEMS: NavItem[] = NAV_SECTIONS.flatMap((section) => section.items);

/** The five destinations pinned to the mobile bottom bar. */
export const MOBILE_NAV_ITEMS: NavItem[] = [
  NAV_ITEMS[0], // Dashboard
  NAV_ITEMS[3], // Transactions
  NAV_ITEMS[4], // Budgets
  NAV_ITEMS[1], // Analytics
  NAV_ITEMS[7], // Calendar
].filter(Boolean);

/** Longest-prefix match so /transactions?page=2 still highlights Transactions. */
export function isActivePath(pathname: string, href: string): boolean {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(`${href}/`);
}

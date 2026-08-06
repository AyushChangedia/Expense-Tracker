import type { CategoryKind } from "@prisma/client";
import {
  Banknote,
  Briefcase,
  Car,
  Clapperboard,
  GraduationCap,
  HeartPulse,
  Laptop,
  Plane,
  ReceiptText,
  RefreshCw,
  Shapes,
  ShoppingBag,
  Target,
  TrendingUp,
  UtensilsCrossed,
  Wallet,
  PiggyBank,
  Home,
  Gift,
  Dumbbell,
  Coffee,
  Fuel,
  Smartphone,
  BookOpen,
  type LucideIcon,
} from "lucide-react";

export type CategorySeed = {
  name: string;
  slug: string;
  kind: CategoryKind;
  icon: string;
  gradientFrom: string;
  gradientTo: string;
};

/**
 * The catalogue every new account starts with. `slug` is the stable key —
 * renaming a category in the UI never changes it, so imports and seeds keep
 * resolving.
 */
export const DEFAULT_CATEGORIES: CategorySeed[] = [
  {
    name: "Food",
    slug: "food",
    kind: "EXPENSE",
    icon: "UtensilsCrossed",
    gradientFrom: "#F97316",
    gradientTo: "#FB7185",
  },
  {
    name: "Shopping",
    slug: "shopping",
    kind: "EXPENSE",
    icon: "ShoppingBag",
    gradientFrom: "#A855F7",
    gradientTo: "#EC4899",
  },
  {
    name: "Transport",
    slug: "transport",
    kind: "EXPENSE",
    icon: "Car",
    gradientFrom: "#38BDF8",
    gradientTo: "#6366F1",
  },
  {
    name: "Bills",
    slug: "bills",
    kind: "EXPENSE",
    icon: "ReceiptText",
    gradientFrom: "#F59E0B",
    gradientTo: "#EF4444",
  },
  {
    name: "Entertainment",
    slug: "entertainment",
    kind: "EXPENSE",
    icon: "Clapperboard",
    gradientFrom: "#EC4899",
    gradientTo: "#8B5CF6",
  },
  {
    name: "Subscriptions",
    slug: "subscriptions",
    kind: "EXPENSE",
    icon: "RefreshCw",
    gradientFrom: "#22D3EE",
    gradientTo: "#3B82F6",
  },
  {
    name: "Travel",
    slug: "travel",
    kind: "EXPENSE",
    icon: "Plane",
    gradientFrom: "#14B8A6",
    gradientTo: "#22D3EE",
  },
  {
    name: "Education",
    slug: "education",
    kind: "EXPENSE",
    icon: "GraduationCap",
    gradientFrom: "#6366F1",
    gradientTo: "#A855F7",
  },
  {
    name: "Health",
    slug: "health",
    kind: "EXPENSE",
    icon: "HeartPulse",
    gradientFrom: "#EF4444",
    gradientTo: "#F97316",
  },
  {
    name: "Investment",
    slug: "investment",
    kind: "EXPENSE",
    icon: "TrendingUp",
    gradientFrom: "#22C55E",
    gradientTo: "#14B8A6",
  },
  {
    name: "Salary",
    slug: "salary",
    kind: "INCOME",
    icon: "Banknote",
    gradientFrom: "#22C55E",
    gradientTo: "#4ADE80",
  },
  {
    name: "Freelance",
    slug: "freelance",
    kind: "INCOME",
    icon: "Laptop",
    gradientFrom: "#22D3EE",
    gradientTo: "#22C55E",
  },
  {
    name: "Business",
    slug: "business",
    kind: "INCOME",
    icon: "Briefcase",
    gradientFrom: "#A855F7",
    gradientTo: "#38BDF8",
  },
  {
    name: "Other",
    slug: "other",
    kind: "BOTH",
    icon: "Shapes",
    gradientFrom: "#71717A",
    gradientTo: "#A1A1AA",
  },
];

/**
 * Icons that can be attached to a category or goal. Kept as an explicit map so
 * the bundle only ships the icons we actually offer, and an unknown value from
 * the database degrades to a sensible default instead of crashing the tree.
 */
export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  UtensilsCrossed,
  ShoppingBag,
  Car,
  ReceiptText,
  Clapperboard,
  RefreshCw,
  Plane,
  GraduationCap,
  HeartPulse,
  TrendingUp,
  Banknote,
  Laptop,
  Briefcase,
  Shapes,
  Target,
  Wallet,
  PiggyBank,
  Home,
  Gift,
  Dumbbell,
  Coffee,
  Fuel,
  Smartphone,
  BookOpen,
};

export const ICON_NAMES = Object.keys(CATEGORY_ICONS);

export function getCategoryIcon(name: string | null | undefined): LucideIcon {
  if (!name) return Shapes;
  return CATEGORY_ICONS[name] ?? Shapes;
}

/** Preset gradients offered in the category / goal editors. */
export const GRADIENT_PRESETS: { from: string; to: string; label: string }[] = [
  { from: "#7C3AED", to: "#38BDF8", label: "Aurora" },
  { from: "#A855F7", to: "#EC4899", label: "Orchid" },
  { from: "#F97316", to: "#FB7185", label: "Sunset" },
  { from: "#22C55E", to: "#4ADE80", label: "Mint" },
  { from: "#22D3EE", to: "#3B82F6", label: "Lagoon" },
  { from: "#F59E0B", to: "#EF4444", label: "Ember" },
  { from: "#6366F1", to: "#A855F7", label: "Indigo" },
  { from: "#14B8A6", to: "#22D3EE", label: "Reef" },
  { from: "#EF4444", to: "#F97316", label: "Coral" },
  { from: "#71717A", to: "#A1A1AA", label: "Graphite" },
];

/**
 * Keyword hints used by the natural-language parser to guess a category from
 * free text such as "spent 25 on pizza". Order matters only in that the parser
 * scores every match and takes the strongest.
 */
export const CATEGORY_KEYWORDS: Record<string, string[]> = {
  food: [
    "pizza", "coffee", "lunch", "dinner", "breakfast", "brunch", "restaurant",
    "groceries", "grocery", "food", "snack", "burger", "sushi", "cafe", "meal",
    "takeout", "starbucks", "mcdonalds", "doordash", "ubereats", "bakery", "deli",
  ],
  shopping: [
    "shopping", "clothes", "clothing", "shoes", "amazon", "shirt", "jeans",
    "jacket", "mall", "store", "purchase", "furniture", "ikea", "electronics",
    "headphones", "laptop bag", "gift",
  ],
  transport: [
    "uber", "lyft", "taxi", "cab", "bus", "train", "metro", "subway", "fuel",
    "gas", "petrol", "parking", "toll", "transport", "commute", "flight ticket",
    "bike", "scooter",
  ],
  bills: [
    "rent", "electricity", "water bill", "internet", "wifi", "phone bill",
    "utility", "utilities", "bill", "mortgage", "insurance", "council tax",
    "broadband", "heating",
  ],
  entertainment: [
    "movie", "cinema", "concert", "game", "gaming", "steam", "playstation",
    "xbox", "bar", "club", "party", "theatre", "theater", "entertainment",
    "bowling", "museum",
  ],
  subscriptions: [
    "netflix", "spotify", "subscription", "membership", "icloud", "dropbox",
    "youtube premium", "hulu", "disney", "prime", "adobe", "notion", "figma",
    "chatgpt", "gym membership",
  ],
  travel: [
    "flight", "hotel", "airbnb", "travel", "vacation", "holiday", "trip",
    "booking", "resort", "hostel", "luggage", "visa fee",
  ],
  education: [
    "course", "tuition", "book", "books", "udemy", "coursera", "class", "school",
    "college", "university", "workshop", "certification", "exam fee", "education",
  ],
  health: [
    "doctor", "pharmacy", "medicine", "hospital", "dentist", "gym", "health",
    "therapy", "clinic", "prescription", "vitamins", "checkup", "physio",
  ],
  investment: [
    "investment", "stocks", "stock", "crypto", "bitcoin", "etf", "mutual fund",
    "index fund", "bonds", "portfolio", "brokerage", "401k", "ira",
  ],
  salary: ["salary", "paycheck", "payroll", "wages", "monthly pay", "stipend"],
  freelance: [
    "freelance", "client", "gig", "contract work", "commission", "consulting",
    "side project", "upwork", "fiverr",
  ],
  business: [
    "business", "revenue", "sales", "invoice", "profit", "dividend", "royalty",
    "rental income",
  ],
};

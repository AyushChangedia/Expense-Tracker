"use client";

import * as React from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  Database,
  Download,
  FileJson,
  FileSpreadsheet,
  FileText,
  KeyRound,
  Loader2,
  User as UserIcon,
} from "lucide-react";
import { toast } from "sonner";
import type { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Field, FormError } from "@/components/auth/auth-card";
import { PasswordInput, PasswordStrength } from "@/components/auth/password-input";
import { SectionHeading } from "@/components/shared/page-header";
import { ImportPanel } from "@/components/settings/import-panel";
import { CURRENCIES, currencySymbol } from "@/lib/currency";
import { DATE_FORMATS } from "@/lib/dates";
import { changePassword } from "@/server/actions/auth";
import {
  clearAllData,
  deleteAccount,
  updatePreferences,
  updateProfile,
} from "@/server/actions/settings";
import {
  changePasswordSchema,
  preferencesSchema,
  profileSchema,
} from "@/lib/validations";
import { initials, cn } from "@/lib/utils";
import type { UserProfile } from "@/types";

const TABS = ["profile", "preferences", "security", "data"] as const;
type Tab = (typeof TABS)[number];

export function SettingsView({ profile }: { profile: UserProfile }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const requested = searchParams.get("tab");
  const activeTab: Tab = TABS.includes(requested as Tab) ? (requested as Tab) : "profile";

  function setTab(tab: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tab);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <Tabs value={activeTab} onValueChange={setTab}>
      <TabsList className="w-full overflow-x-auto sm:w-auto">
        <TabsTrigger value="profile">
          <UserIcon className="size-4" />
          Profile
        </TabsTrigger>
        <TabsTrigger value="preferences">Preferences</TabsTrigger>
        <TabsTrigger value="security">
          <KeyRound className="size-4" />
          Security
        </TabsTrigger>
        <TabsTrigger value="data">
          <Database className="size-4" />
          Data
        </TabsTrigger>
      </TabsList>

      <TabsContent value="profile">
        <ProfileSection profile={profile} />
      </TabsContent>

      <TabsContent value="preferences">
        <PreferencesSection profile={profile} />
      </TabsContent>

      <TabsContent value="security">
        <SecuritySection profile={profile} />
      </TabsContent>

      <TabsContent value="data" className="space-y-4">
        <ExportSection />
        <ImportPanel />
        <DangerZone />
      </TabsContent>
    </Tabs>
  );
}

function Panel({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      className={cn("glass glow-border p-5 sm:p-6", className)}
    >
      <SectionHeading title={title} description={description} className="mb-5" />
      {children}
    </motion.section>
  );
}

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

type ProfileValues = z.input<typeof profileSchema>;

function ProfileSection({ profile }: { profile: UserProfile }) {
  const router = useRouter();
  const { update: updateSession } = useSession();
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const form = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: profile.name ?? "", image: profile.image ?? "" },
  });

  const image = form.watch("image");
  const name = form.watch("name");

  async function onSubmit(values: ProfileValues) {
    setPending(true);
    setError(null);

    const result = await updateProfile(values);
    setPending(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    toast.success("Profile updated");
    // Refresh the JWT so the avatar and name in the topbar update immediately.
    await updateSession();
    router.refresh();
  }

  return (
    <Panel
      title="Your profile"
      description="How you appear inside the app. Your email is fixed to the account."
    >
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <FormError message={error} />

        <div className="flex items-center gap-4">
          <Avatar className="size-16">
            {image ? <AvatarImage src={image} alt="" /> : null}
            <AvatarFallback className="text-lg">
              {initials(name, profile.email)}
            </AvatarFallback>
          </Avatar>

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-white">
              {name || "Your name"}
            </p>
            <p className="truncate text-xs text-subtle">{profile.email}</p>
          </div>
        </div>

        <Field label="Name" htmlFor="name" error={form.formState.errors.name?.message}>
          <Input
            id="name"
            maxLength={60}
            invalid={Boolean(form.formState.errors.name)}
            {...form.register("name")}
          />
        </Field>

        <Field
          label="Avatar URL"
          htmlFor="image"
          hint="Optional — paste a link to an image."
          error={form.formState.errors.image?.message}
        >
          <Input
            id="image"
            type="url"
            placeholder="https://…"
            invalid={Boolean(form.formState.errors.image)}
            {...form.register("image")}
          />
        </Field>

        <div className="flex justify-end">
          <Button type="submit" loading={pending}>
            Save profile
          </Button>
        </div>
      </form>
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// Preferences
// ---------------------------------------------------------------------------

type PreferenceValues = z.input<typeof preferencesSchema>;

const LOCALES = [
  { value: "en-US", label: "English (US)" },
  { value: "en-GB", label: "English (UK)" },
  { value: "en-IN", label: "English (India)" },
  { value: "de-DE", label: "German" },
  { value: "fr-FR", label: "French" },
  { value: "es-ES", label: "Spanish" },
  { value: "pt-BR", label: "Portuguese (Brazil)" },
  { value: "ja-JP", label: "Japanese" },
];

function PreferencesSection({ profile }: { profile: UserProfile }) {
  const router = useRouter();
  const { update: updateSession } = useSession();
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const form = useForm<PreferenceValues>({
    resolver: zodResolver(preferencesSchema),
    defaultValues: {
      currency: profile.currency,
      dateFormat: profile.dateFormat,
      locale: profile.locale,
      weekStart: profile.weekStart,
    },
  });

  const currency = form.watch("currency");
  const locale = form.watch("locale");

  const preview = React.useMemo(() => {
    try {
      return new Intl.NumberFormat(locale, {
        style: "currency",
        currency,
      }).format(1234.56);
    } catch {
      return `${currencySymbol(currency)}1,234.56`;
    }
  }, [currency, locale]);

  async function onSubmit(values: PreferenceValues) {
    setPending(true);
    setError(null);

    const result = await updatePreferences(values);
    setPending(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    toast.success("Preferences saved");
    await updateSession();
    router.refresh();
  }

  return (
    <Panel
      title="Regional preferences"
      description="These drive how every amount and date is rendered across the app."
    >
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <FormError message={error} />

        <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
          <p className="text-[11px] uppercase tracking-wider text-subtle">Preview</p>
          <p className="tabular mt-1 text-2xl font-semibold text-white">{preview}</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Currency" htmlFor="currency">
            <Controller
              control={form.control}
              name="currency"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="currency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((option) => (
                      <SelectItem key={option.code} value={option.code}>
                        {option.symbol} {option.code} · {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>

          <Field label="Number & date locale" htmlFor="locale">
            <Controller
              control={form.control}
              name="locale"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="locale">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LOCALES.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>

          <Field label="Date format" htmlFor="dateFormat">
            <Controller
              control={form.control}
              name="dateFormat"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="dateFormat">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DATE_FORMATS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>

          <Field label="Week starts on" htmlFor="weekStart">
            <Controller
              control={form.control}
              name="weekStart"
              render={({ field }) => (
                <Select
                  value={String(field.value)}
                  onValueChange={(value) => field.onChange(Number(value))}
                >
                  <SelectTrigger id="weekStart">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">Sunday</SelectItem>
                    <SelectItem value="1">Monday</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
        </div>

        <div className="flex justify-end">
          <Button type="submit" loading={pending}>
            Save preferences
          </Button>
        </div>
      </form>
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// Security
// ---------------------------------------------------------------------------

type PasswordValues = z.input<typeof changePasswordSchema>;

function SecuritySection({ profile }: { profile: UserProfile }) {
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const form = useForm<PasswordValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
    mode: "onBlur",
  });

  const newPassword = form.watch("newPassword");

  async function onSubmit(values: PasswordValues) {
    setPending(true);
    setError(null);

    const result = await changePassword(values);
    setPending(false);

    if (!result.ok) {
      setError(result.error);
      for (const [field, messages] of Object.entries(result.fieldErrors ?? {})) {
        if (messages?.[0]) {
          form.setError(field as keyof PasswordValues, { message: messages[0] });
        }
      }
      return;
    }

    toast.success("Password updated");
    form.reset();
  }

  if (!profile.hasPassword) {
    return (
      <Panel
        title="Password"
        description="This account signs in through Google, so there is no password stored here."
      >
        <div className="flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/[0.06] p-4">
          <KeyRound className="mt-0.5 size-4 shrink-0 text-primary-300" />
          <p className="text-sm leading-relaxed text-muted-foreground">
            Manage your sign-in credentials from your Google account. Everything
            else on this page still applies to your FluxFin data.
          </p>
        </div>
      </Panel>
    );
  }

  return (
    <Panel
      title="Change password"
      description="Pick something you have not used here before."
    >
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="max-w-md space-y-4"
        noValidate
      >
        <FormError message={error} />

        <Field
          label="Current password"
          htmlFor="currentPassword"
          error={form.formState.errors.currentPassword?.message}
        >
          <PasswordInput
            id="currentPassword"
            autoComplete="current-password"
            invalid={Boolean(form.formState.errors.currentPassword)}
            {...form.register("currentPassword")}
          />
        </Field>

        <Field
          label="New password"
          htmlFor="newPassword"
          error={form.formState.errors.newPassword?.message}
        >
          <PasswordInput
            id="newPassword"
            autoComplete="new-password"
            invalid={Boolean(form.formState.errors.newPassword)}
            {...form.register("newPassword")}
          />
          <PasswordStrength value={newPassword ?? ""} />
        </Field>

        <Field
          label="Confirm new password"
          htmlFor="confirmPassword"
          error={form.formState.errors.confirmPassword?.message}
        >
          <PasswordInput
            id="confirmPassword"
            autoComplete="new-password"
            invalid={Boolean(form.formState.errors.confirmPassword)}
            {...form.register("confirmPassword")}
          />
        </Field>

        <div className="flex justify-end">
          <Button type="submit" loading={pending}>
            Update password
          </Button>
        </div>
      </form>
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

const EXPORTS = [
  {
    format: "csv",
    label: "CSV",
    description: "Universal — opens in any spreadsheet tool.",
    icon: FileText,
    gradient: "from-[#22C55E] to-[#4ADE80]",
  },
  {
    format: "xlsx",
    label: "Excel",
    description: "Formatted workbook with a summary sheet.",
    icon: FileSpreadsheet,
    gradient: "from-[#38BDF8] to-[#22D3EE]",
  },
  {
    format: "json",
    label: "JSON",
    description: "Transactions only, machine-readable.",
    icon: FileJson,
    gradient: "from-[#A855F7] to-[#EC4899]",
  },
];

function ExportSection() {
  return (
    <Panel
      title="Export your data"
      description="Everything is generated on demand from your account — nothing is cached or shared."
    >
      <div className="grid gap-3 sm:grid-cols-3">
        {EXPORTS.map((item) => (
          <a
            key={item.format}
            href={`/api/export?format=${item.format}`}
            download
            className="glass-muted group flex flex-col gap-3 p-4 transition-all duration-500 ease-smooth hover:-translate-y-1 hover:shadow-lift"
          >
            <span
              className={`grid size-10 place-items-center rounded-xl bg-gradient-to-br ${item.gradient} transition-transform duration-500 group-hover:scale-105`}
            >
              <item.icon className="size-[18px] text-white" strokeWidth={1.9} />
            </span>

            <span>
              <span className="flex items-center gap-1.5 text-sm font-semibold text-white">
                {item.label}
                <Download className="size-3 text-subtle transition-transform duration-300 group-hover:translate-y-0.5" />
              </span>
              <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                {item.description}
              </span>
            </span>
          </a>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
        <div>
          <p className="text-sm font-medium text-white">Full account backup</p>
          <p className="text-xs text-muted-foreground">
            Categories, tags, budgets, goals, and recurring rules alongside every
            transaction.
          </p>
        </div>
        <Button asChild variant="secondary" size="sm">
          <a href="/api/export?format=json&scope=full" download>
            <Download className="size-4" />
            Download backup
          </a>
        </Button>
      </div>
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// Danger zone
// ---------------------------------------------------------------------------

function DangerZone() {
  const router = useRouter();
  const [clearOpen, setClearOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [confirmation, setConfirmation] = React.useState("");
  const [pending, setPending] = React.useState(false);

  async function handleClear() {
    setPending(true);
    const result = await clearAllData({ confirmation });
    setPending(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    toast.success(`Cleared ${result.data.transactions} transactions`);
    setClearOpen(false);
    setConfirmation("");
    router.refresh();
  }

  async function handleDelete() {
    setPending(true);
    const result = await deleteAccount({ confirmation });

    if (!result.ok) {
      setPending(false);
      toast.error(result.error);
      return;
    }
    // On success the action redirects to "/" — nothing further to do here.
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      className="glass border-danger/20 p-5 sm:p-6"
    >
      <div className="mb-5 flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-danger/20 bg-danger/10">
          <AlertTriangle className="size-4 text-danger" />
        </span>
        <div>
          <h2 className="text-sm font-semibold text-white">Danger zone</h2>
          <p className="text-xs text-muted-foreground">
            Both actions are permanent. Export a backup first if you are unsure.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/[0.08] p-4">
          <div>
            <p className="text-sm font-medium text-white">Clear all data</p>
            <p className="text-xs text-muted-foreground">
              Wipes transactions, budgets, goals, and rules. Your account and
              categories stay.
            </p>
          </div>
          <Button variant="secondary" size="sm" onClick={() => setClearOpen(true)}>
            Clear data
          </Button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-danger/20 bg-danger/[0.04] p-4">
          <div>
            <p className="text-sm font-medium text-white">Delete account</p>
            <p className="text-xs text-muted-foreground">
              Removes your account and every record attached to it.
            </p>
          </div>
          <Button variant="destructive" size="sm" onClick={() => setDeleteOpen(true)}>
            Delete account
          </Button>
        </div>
      </div>

      <ConfirmTypeDialog
        open={clearOpen}
        onOpenChange={(open) => {
          setClearOpen(open);
          if (!open) setConfirmation("");
        }}
        title="Clear all your data?"
        description="Transactions, budgets, goals, recurring rules, notifications, and activity history are all removed. Your account, categories, and tags remain."
        confirmLabel="Clear everything"
        value={confirmation}
        onValueChange={setConfirmation}
        pending={pending}
        onConfirm={handleClear}
      />

      <ConfirmTypeDialog
        open={deleteOpen}
        onOpenChange={(open) => {
          setDeleteOpen(open);
          if (!open) setConfirmation("");
        }}
        title="Delete your account?"
        description="This removes your account and every record attached to it. There is no way back."
        confirmLabel="Delete my account"
        value={confirmation}
        onValueChange={setConfirmation}
        pending={pending}
        onConfirm={handleDelete}
      />
    </motion.section>
  );
}

/** Shared "type DELETE to confirm" dialog for the destructive actions. */
function ConfirmTypeDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  value,
  onValueChange,
  pending,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  value: string;
  onValueChange: (value: string) => void;
  pending: boolean;
  onConfirm: () => void | Promise<void>;
}) {
  const armed = value.trim().toUpperCase() === "DELETE";

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>

        <div className="mt-4 space-y-1.5">
          <label
            htmlFor="confirm-delete"
            className="text-xs font-medium uppercase tracking-wider text-muted-foreground"
          >
            Type <span className="font-mono text-danger">DELETE</span> to confirm
          </label>
          <Input
            id="confirm-delete"
            value={value}
            onChange={(event) => onValueChange(event.target.value)}
            placeholder="DELETE"
            autoComplete="off"
          />
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={!armed || pending}
            onClick={(event) => {
              event.preventDefault();
              void onConfirm();
            }}
          >
            {pending ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Working…
              </>
            ) : (
              confirmLabel
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

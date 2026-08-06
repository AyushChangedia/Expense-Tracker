"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  MoreHorizontal,
  Pencil,
  Plus,
  Star,
  Tag as TagIcon,
  Trash2,
  X,
} from "lucide-react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import type { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { Field, FormError } from "@/components/auth/auth-card";
import { EmptyState } from "@/components/shared/empty-state";
import { SectionHeading } from "@/components/shared/page-header";
import { usePreferences } from "@/components/providers/preferences-provider";
import { GRADIENT_PRESETS, ICON_NAMES, getCategoryIcon } from "@/lib/categories";
import { categorySchema } from "@/lib/validations";
import { cn } from "@/lib/utils";
import {
  createCategory,
  createTag,
  deleteCategory,
  deleteTag,
  toggleCategoryFavorite,
  updateCategory,
} from "@/server/actions/categories";
import type { CategoryDTO } from "@/types";

type CategoryWithUsage = CategoryDTO & {
  transactionCount: number;
  totalAmount: number;
};

type TagWithUsage = {
  id: string;
  name: string;
  slug: string;
  color: string;
  transactionCount: number;
};

const KIND_LABEL = {
  EXPENSE: "Expense",
  INCOME: "Income",
  BOTH: "Both",
} as const;

export function CategoriesView({
  categories,
  tags,
}: {
  categories: CategoryWithUsage[];
  tags: TagWithUsage[];
}) {
  const router = useRouter();
  const { formatMoney } = usePreferences();

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<CategoryDTO | null>(null);
  const [deleting, setDeleting] = React.useState<CategoryWithUsage | null>(null);
  const [pending, setPending] = React.useState(false);

  async function handleDelete() {
    if (!deleting) return;
    setPending(true);

    const result = await deleteCategory(deleting.id);
    setPending(false);
    setDeleting(null);

    if (result.ok) {
      toast.success("Category deleted");
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  async function handleFavorite(category: CategoryWithUsage) {
    const result = await toggleCategoryFavorite(category.id);
    if (result.ok) router.refresh();
    else toast.error(result.error);
  }

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <SectionHeading
          title="Categories"
          description="Every category carries its own icon and gradient across the whole app."
          action={
            <Button
              size="sm"
              onClick={() => {
                setEditing(null);
                setDialogOpen(true);
              }}
            >
              <Plus className="size-4" />
              New category
            </Button>
          }
        />

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <AnimatePresence initial={false}>
            {categories.map((category, index) => {
              const Icon = getCategoryIcon(category.icon);

              return (
                <motion.article
                  key={category.id}
                  layout
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{
                    duration: 0.4,
                    delay: Math.min(index * 0.03, 0.25),
                    ease: [0.16, 1, 0.3, 1],
                  }}
                  className="glass glow-border group p-4 transition-all duration-500 ease-smooth hover:-translate-y-1"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span
                      className="grid size-10 shrink-0 place-items-center rounded-xl"
                      style={{
                        background: `linear-gradient(135deg, ${category.gradientFrom}, ${category.gradientTo})`,
                        boxShadow: `0 8px 22px -12px ${category.gradientFrom}`,
                      }}
                    >
                      <Icon className="size-[18px] text-white" strokeWidth={2} />
                    </span>

                    <div className="flex items-center gap-0.5">
                      <button
                        type="button"
                        onClick={() => void handleFavorite(category)}
                        className={cn(
                          "rounded-lg p-1.5 transition-colors",
                          category.isFavorite
                            ? "text-warning"
                            : "text-subtle opacity-0 hover:text-white focus-visible:opacity-100 group-hover:opacity-100",
                        )}
                        aria-label={
                          category.isFavorite
                            ? `Unfavourite ${category.name}`
                            : `Favourite ${category.name}`
                        }
                      >
                        <Star
                          className="size-3.5"
                          fill={category.isFavorite ? "currentColor" : "none"}
                        />
                      </button>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            className="rounded-lg p-1.5 text-subtle opacity-0 transition-all hover:bg-white/[0.08] hover:text-white focus-visible:opacity-100 group-hover:opacity-100"
                            aria-label={`Actions for ${category.name}`}
                          >
                            <MoreHorizontal className="size-4" />
                          </button>
                        </DropdownMenuTrigger>

                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onSelect={() => {
                              setEditing(category);
                              setDialogOpen(true);
                            }}
                          >
                            <Pencil />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            destructive
                            onSelect={() => setDeleting(category)}
                          >
                            <Trash2 />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>

                  <p className="mt-3 truncate text-sm font-semibold text-white">
                    {category.name}
                  </p>

                  <div className="mt-1 flex items-center gap-2">
                    <Badge
                      variant={
                        category.kind === "INCOME"
                          ? "success"
                          : category.kind === "BOTH"
                            ? "secondary"
                            : "danger"
                      }
                      className="px-1.5 py-0 text-[10px]"
                    >
                      {KIND_LABEL[category.kind]}
                    </Badge>
                    {category.isDefault ? (
                      <span className="text-[10px] text-subtle">built-in</span>
                    ) : null}
                  </div>

                  <div className="mt-3 border-t border-white/[0.06] pt-2.5 text-[11px]">
                    <p className="tabular text-muted-foreground">
                      {formatMoney(category.totalAmount, { compact: true })}
                    </p>
                    <p className="text-subtle">
                      {category.transactionCount}{" "}
                      {category.transactionCount === 1 ? "transaction" : "transactions"}
                    </p>
                  </div>
                </motion.article>
              );
            })}
          </AnimatePresence>
        </div>
      </section>

      <TagsSection tags={tags} />

      <CategoryDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        category={editing}
      />

      <AlertDialog open={Boolean(deleting)} onOpenChange={() => setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete &ldquo;{deleting?.name}&rdquo;?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting && deleting.transactionCount > 0
                ? `This category still has ${deleting.transactionCount} ${
                    deleting.transactionCount === 1 ? "transaction" : "transactions"
                  }. Move them to another category first — deleting will be refused otherwise.`
                : "This category is unused, so removing it is safe."}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={(event) => {
                event.preventDefault();
                void handleDelete();
              }}
              disabled={pending}
            >
              {pending ? "Deleting…" : "Delete category"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tags
// ---------------------------------------------------------------------------

function TagsSection({ tags }: { tags: TagWithUsage[] }) {
  const router = useRouter();
  const [name, setName] = React.useState("");
  const [color, setColor] = React.useState("#8B5CF6");
  const [pending, setPending] = React.useState(false);

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;

    setPending(true);
    const result = await createTag({ name: name.trim(), color });
    setPending(false);

    if (result.ok) {
      toast.success("Tag created");
      setName("");
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  async function handleDelete(tag: TagWithUsage) {
    const result = await deleteTag(tag.id);
    if (result.ok) {
      toast.success(`Removed "${tag.name}"`);
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  return (
    <section className="space-y-3">
      <SectionHeading
        title="Tags"
        description="Free-form labels for cutting across categories. Deleting a tag leaves its transactions untouched."
      />

      <div className="glass glow-border p-5">
        <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-2">
          <div className="min-w-[180px] flex-1 space-y-1.5">
            <label
              htmlFor="tag-name"
              className="text-xs font-medium uppercase tracking-wider text-muted-foreground"
            >
              New tag
            </label>
            <Input
              id="tag-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. work-trip"
              maxLength={30}
              icon={<TagIcon />}
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="tag-color"
              className="text-xs font-medium uppercase tracking-wider text-muted-foreground"
            >
              Colour
            </label>
            <input
              id="tag-color"
              type="color"
              value={color}
              onChange={(event) => setColor(event.target.value)}
              className="h-10 w-14 cursor-pointer rounded-xl border border-white/[0.10] bg-transparent p-1"
            />
          </div>

          <Button type="submit" loading={pending} disabled={!name.trim()}>
            <Plus className="size-4" />
            Add tag
          </Button>
        </form>

        {tags.length === 0 ? (
          <EmptyState
            icon={TagIcon}
            title="No tags yet"
            description="Tags are also created automatically whenever you type a new one on a transaction."
            compact
          />
        ) : (
          <div className="mt-5 flex flex-wrap gap-2 border-t border-white/[0.06] pt-5">
            <AnimatePresence initial={false}>
              {tags.map((tag) => (
                <motion.span
                  key={tag.id}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.2 }}
                  className="group inline-flex items-center gap-1.5 rounded-full border py-1 pl-3 pr-1.5 text-xs"
                  style={{
                    borderColor: `${tag.color}40`,
                    background: `${tag.color}14`,
                    color: tag.color,
                  }}
                >
                  {tag.name}
                  <span className="tabular text-[10px] opacity-60">
                    {tag.transactionCount}
                  </span>
                  <button
                    type="button"
                    onClick={() => void handleDelete(tag)}
                    className="rounded-full p-0.5 opacity-0 transition-opacity hover:bg-white/[0.12] focus-visible:opacity-100 group-hover:opacity-100"
                    aria-label={`Delete tag ${tag.name}`}
                  >
                    <X className="size-3" />
                  </button>
                </motion.span>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Category dialog
// ---------------------------------------------------------------------------

const formSchema = categorySchema;
type FormValues = z.input<typeof formSchema>;

function CategoryDialog({
  open,
  onOpenChange,
  category,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category?: CategoryDTO | null;
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const isEdit = Boolean(category);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      kind: "EXPENSE",
      icon: "Shapes",
      gradientFrom: "#7C3AED",
      gradientTo: "#38BDF8",
    },
  });

  React.useEffect(() => {
    if (!open) return;
    form.reset({
      name: category?.name ?? "",
      kind: category?.kind ?? "EXPENSE",
      icon: category?.icon ?? "Shapes",
      gradientFrom: category?.gradientFrom ?? "#7C3AED",
      gradientTo: category?.gradientTo ?? "#38BDF8",
    });
    setError(null);
  }, [open, category, form]);

  const icon = form.watch("icon");
  const gradientFrom = form.watch("gradientFrom");
  const gradientTo = form.watch("gradientTo");
  const PreviewIcon = getCategoryIcon(icon);

  async function onSubmit(values: FormValues) {
    setPending(true);
    setError(null);

    const result = isEdit
      ? await updateCategory({ ...values, id: category!.id })
      : await createCategory(values);

    setPending(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    toast.success(isEdit ? "Category updated" : "Category created");
    onOpenChange(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit category" : "New category"}</DialogTitle>
          <DialogDescription>
            The icon and gradient you pick appear everywhere this category shows
            up — lists, charts, and the calendar.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="pb-6">
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <FormError message={error} />

            <div className="flex items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.02] p-3.5">
              <span
                className="grid size-12 shrink-0 place-items-center rounded-xl"
                style={{
                  background: `linear-gradient(135deg, ${gradientFrom}, ${gradientTo})`,
                  boxShadow: `0 8px 24px -10px ${gradientFrom}`,
                }}
              >
                <PreviewIcon className="size-5 text-white" strokeWidth={2} />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-white">
                  {form.watch("name") || "Your category"}
                </p>
                <p className="text-xs text-subtle">Live preview</p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Name"
                htmlFor="name"
                error={form.formState.errors.name?.message}
              >
                <Input
                  id="name"
                  placeholder="Pets"
                  autoFocus
                  maxLength={40}
                  invalid={Boolean(form.formState.errors.name)}
                  {...form.register("name")}
                />
              </Field>

              <Field label="Applies to" htmlFor="kind">
                <Controller
                  control={form.control}
                  name="kind"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="kind">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="EXPENSE">Expenses</SelectItem>
                        <SelectItem value="INCOME">Income</SelectItem>
                        <SelectItem value="BOTH">Both</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
            </div>

            <div className="space-y-1.5">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Icon
              </p>
              <Controller
                control={form.control}
                name="icon"
                render={({ field }) => (
                  <div className="grid grid-cols-8 gap-1.5 sm:grid-cols-12">
                    {ICON_NAMES.map((name) => {
                      const Icon = getCategoryIcon(name);
                      const active = field.value === name;
                      return (
                        <button
                          key={name}
                          type="button"
                          onClick={() => field.onChange(name)}
                          className={cn(
                            "grid aspect-square place-items-center rounded-lg border transition-all duration-200",
                            active
                              ? "border-primary/50 bg-primary/15 text-primary-200"
                              : "border-white/[0.08] text-subtle hover:border-white/[0.18] hover:text-white",
                          )}
                          aria-label={name}
                          aria-pressed={active}
                        >
                          <Icon className="size-4" strokeWidth={2} />
                        </button>
                      );
                    })}
                  </div>
                )}
              />
            </div>

            <div className="space-y-1.5">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Gradient
              </p>
              <div className="flex flex-wrap gap-1.5">
                {GRADIENT_PRESETS.map((preset) => {
                  const active =
                    gradientFrom === preset.from && gradientTo === preset.to;
                  return (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => {
                        form.setValue("gradientFrom", preset.from, { shouldDirty: true });
                        form.setValue("gradientTo", preset.to, { shouldDirty: true });
                      }}
                      className={cn(
                        "size-9 rounded-lg border-2 transition-all duration-200",
                        active ? "scale-110 border-white" : "border-transparent hover:scale-105",
                      )}
                      style={{
                        background: `linear-gradient(135deg, ${preset.from}, ${preset.to})`,
                      }}
                      aria-label={preset.label}
                      aria-pressed={active}
                      title={preset.label}
                    />
                  );
                })}
              </div>
            </div>

            <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="secondary"
                onClick={() => onOpenChange(false)}
                disabled={pending}
              >
                Cancel
              </Button>
              <Button type="submit" loading={pending}>
                {isEdit ? "Save changes" : "Create category"}
              </Button>
            </div>
          </form>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}

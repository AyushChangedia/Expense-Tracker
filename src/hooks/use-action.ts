"use client";

import * as React from "react";
import { toast } from "sonner";

import type { ActionResult } from "@/types";

type UseActionOptions<T> = {
  onSuccess?: (data: T, message?: string) => void;
  onError?: (error: string, fieldErrors?: Record<string, string[]>) => void;
  /** Show a toast automatically. Defaults to true for both outcomes. */
  successToast?: boolean | string;
  errorToast?: boolean;
};

/**
 * Runs a server action with pending state, field errors, and toasts wired up.
 *
 * `useTransition` keeps the surrounding UI interactive and lets React batch the
 * server-side revalidation that follows the action.
 */
export function useAction<TInput, TData>(
  action: (input: TInput) => Promise<ActionResult<TData>>,
  {
    onSuccess,
    onError,
    successToast = true,
    errorToast = true,
  }: UseActionOptions<TData> = {},
) {
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string[]>>({});

  const execute = React.useCallback(
    (input: TInput) =>
      new Promise<ActionResult<TData>>((resolve) => {
        setError(null);
        setFieldErrors({});

        startTransition(async () => {
          const result = await action(input);

          if (result.ok) {
            if (successToast) {
              const message =
                typeof successToast === "string"
                  ? successToast
                  : (result.message ?? "Done");
              toast.success(message);
            }
            onSuccess?.(result.data, result.message);
          } else {
            setError(result.error);
            setFieldErrors(result.fieldErrors ?? {});
            if (errorToast) toast.error(result.error);
            onError?.(result.error, result.fieldErrors);
          }

          resolve(result);
        });
      }),
    [action, onSuccess, onError, successToast, errorToast],
  );

  const reset = React.useCallback(() => {
    setError(null);
    setFieldErrors({});
  }, []);

  return { execute, pending, error, fieldErrors, reset };
}

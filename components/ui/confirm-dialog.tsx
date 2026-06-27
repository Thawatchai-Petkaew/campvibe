"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
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

interface ConfirmDialogProps {
  /** Controls dialog visibility. */
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Title rendered inside AlertDialogTitle. */
  title: React.ReactNode;
  /** Optional description rendered inside AlertDialogDescription. */
  description?: React.ReactNode;
  /** Label for the confirm action button. */
  confirmLabel: string;
  /** Label for the cancel button. */
  cancelLabel: string;
  /** Called when the user clicks the confirm action. */
  onConfirm: () => void | Promise<void>;
  /** When true: confirm button is disabled and shows a loading spinner. */
  isLoading?: boolean;
  /** When true: confirm button uses the `destructive` variant. */
  destructive?: boolean;
  /** Optional data-testid forwarded to the AlertDialogContent (for QA assertions). */
  "data-testid"?: string;
}

/**
 * ConfirmDialog — canonical destructive-confirm wrapper over AlertDialog.
 *
 * Compose from: AlertDialog + AlertDialogContent + Header + Title + Description
 * + Footer + Cancel + Action — per the DESIGN.md §3 overlay grammar.
 *
 * Copy comes from the caller via props (i18n stays at the call site).
 * Token-only — no hardcoded hex, px, or shadow.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel,
  onConfirm,
  isLoading = false,
  destructive = false,
  "data-testid": dataTestId,
}: ConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent data-testid={dataTestId}>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description != null && (
            <AlertDialogDescription>{description}</AlertDialogDescription>
          )}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>
            {cancelLabel}
          </AlertDialogCancel>
          <AlertDialogAction
            variant={destructive ? "destructive" : "default"}
            disabled={isLoading}
            onClick={onConfirm}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              confirmLabel
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type FilterChipVariant = "pill" | "card" | "icon-card";

interface FilterChipProps {
  variant: FilterChipVariant;
  selected: boolean;
  onToggle: () => void;
  label: string;
  icon?: React.ElementType;
  disabled?: boolean;
  "data-testid"?: string;
  "aria-label"?: string;
}

export function FilterChip({
  variant,
  selected,
  onToggle,
  label,
  icon: Icon,
  disabled,
  "data-testid": testId,
  "aria-label": ariaLabel,
}: FilterChipProps) {
  if (variant === "pill") {
    return (
      <button
        type="button"
        aria-pressed={selected}
        aria-label={ariaLabel}
        data-testid={testId}
        disabled={disabled}
        onClick={onToggle}
        className={cn(
          "inline-flex items-center gap-2 h-11 min-w-[44px] px-5 rounded-full border text-sm transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          "active:scale-95",
          selected
            ? "border-foreground bg-foreground text-background hover:bg-foreground/85"
            : "border-border bg-card text-foreground hover:border-foreground",
          disabled && "opacity-50 pointer-events-none"
        )}
      >
        {Icon && <Icon className="size-4 shrink-0" aria-hidden="true" />}
        {label}
      </button>
    );
  }

  if (variant === "card") {
    return (
      <button
        type="button"
        aria-pressed={selected}
        aria-label={ariaLabel}
        data-testid={testId}
        disabled={disabled}
        onClick={onToggle}
        className={cn(
          "rounded-2xl border-2 h-32 p-5 flex flex-col justify-between items-start text-left overflow-hidden transition-colors w-full",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          "active:scale-95",
          selected
            ? "border-foreground bg-foreground/5"
            : "border-border bg-card hover:border-foreground/40",
          disabled && "opacity-50 pointer-events-none"
        )}
      >
        {Icon && (
          <Icon
            className={cn(
              "size-8",
              selected ? "text-foreground" : "text-muted-foreground"
            )}
            aria-hidden="true"
          />
        )}
        <span className="text-base font-bold text-foreground">{label}</span>
      </button>
    );
  }

  // icon-card variant
  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={ariaLabel ?? label}
      data-testid={testId}
      disabled={disabled}
      onClick={onToggle}
      className={cn(
        "rounded-xl border h-24 p-3 flex flex-col items-center justify-center gap-2 transition-colors w-full",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        "active:scale-95",
        selected
          ? "border-foreground bg-foreground/5 font-semibold text-foreground"
          : "border-border text-muted-foreground hover:border-foreground/40",
        disabled && "opacity-50 pointer-events-none"
      )}
    >
      {Icon && <Icon className="size-6" aria-hidden="true" />}
      <span className="text-xs text-center">{label}</span>
    </button>
  );
}

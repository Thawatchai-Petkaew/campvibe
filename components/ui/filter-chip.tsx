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
  // CAM-552 — the pill's HEIGHT does not step: h-11 is 44px, the tap floor
  // itself. The compaction is horizontal (px-5 -> px-4 below md), which is what
  // actually decides how many chips fit a phone row; min-w-[44px] holds the
  // floor on the cross axis. Commentary stays OUT of cn(): the check:ds R9
  // detector and ds1-dropdown-grammar read the class string as the token
  // immediately following `cn(`.
  // CAM-581 — `truncate` added: this pill's label is host-authorable free text
  // in some callers (spot-management-section.tsx's zone filter, up to the
  // 50-char zoneCreateSchema max). Measured in a real browser at 150% text
  // scale inside a real flex-wrap row: without truncate, a max-length label
  // wraps to 2 lines and spills ~13px past the fixed h-11 rounded-full box.
  // `shrink-0` was tried first and measured WORSE here (unlike CategoryBar's
  // horizontal-scroll strip, this is a flex-wrap row inside a clipped modal —
  // shrink-0 lets the pill grow past the modal's own overflow-hidden edge and
  // get hard-clipped mid-character). truncate ellipsizes instead, 0px spill.
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
          "inline-flex items-center gap-2 h-11 min-w-[44px] px-4 md:px-5 rounded-full border type-label transition-colors truncate",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          "active:scale-95",
          selected
            ? "border-primary bg-primary text-primary-foreground hover:bg-primary/85"
            : "border-border bg-card text-foreground hover:border-foreground",
          disabled && "opacity-50 pointer-events-none"
        )}
      >
        {Icon && <Icon className="size-4 shrink-0" aria-hidden="true" />}
        {label}
      </button>
    );
  }

  // CAM-552 — a card chip sits far above the 44px floor, so its block height is
  // free to compact: 112px on a phone, 128px from md up.
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
          "rounded-2xl border-2 h-28 p-4 md:h-32 md:p-5 flex flex-col justify-between items-start text-left overflow-hidden transition-colors w-full",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          "active:scale-95",
          selected
            ? "border-primary bg-primary/5"
            : "border-border bg-card hover:border-foreground/40",
          disabled && "opacity-50 pointer-events-none"
        )}
      >
        {Icon && (
          <Icon
            className={cn(
              "size-8",
              selected ? "text-primary" : "text-muted-foreground"
            )}
            aria-hidden="true"
          />
        )}
        <span className="type-body font-bold text-foreground">{label}</span>
      </button>
    );
  }

  // icon-card variant — CAM-552: 80px on a phone, 96px from md up. Still well
  // clear of the 44px floor at the mobile step.
  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={ariaLabel ?? label}
      data-testid={testId}
      disabled={disabled}
      onClick={onToggle}
      className={cn(
        "rounded-xl border h-20 p-2.5 md:h-24 md:p-3 flex flex-col items-center justify-center gap-1.5 md:gap-2 transition-colors w-full",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        "active:scale-95",
        selected
          ? "border-primary bg-primary/5 font-semibold text-primary-ink"
          : "border-border text-muted-foreground hover:border-foreground/40",
        disabled && "opacity-50 pointer-events-none"
      )}
    >
      {Icon && <Icon className="size-6" aria-hidden="true" />}
      <span className="type-caption text-center">{label}</span>
    </button>
  );
}

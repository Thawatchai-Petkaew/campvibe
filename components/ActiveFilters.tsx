"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/contexts/LanguageContext";
import { FILTERABLE_GROUPS } from "@/lib/taxonomy-registry";

/**
 * ActiveFilters — CAM-530 (S3, foundation refactor, taxonomy-ui-foundation epic)
 *
 * Camper-facing summary of every active catalog filter as a removable,
 * localized chip. Before this story the component was DEAD (never imported
 * or mounted anywhere — a camper filtering the catalog had no visible
 * summary and no way to remove one filter without reopening the modal),
 * INCOMPLETE (missed the CAM-515/CAM-516 `annotatedFeatures`/`camperStyle`
 * groups), and UNLOCALIZED (rendered raw MasterData codes like
 * "Terrain: SEA" instead of the camper's language).
 *
 * The param<->group<->label mapping is driven ENTIRELY by
 * `lib/taxonomy-registry.ts`'s `FILTERABLE_GROUPS` (CAM-523) — a new
 * filterable MasterData group added to the registry appears here with NO
 * edit to this file (see `__tests__/cam-530-active-filters.test.ts`, the
 * registry-driven property test).
 *
 * `type` (Campground type) and `min`/`max` (price) stay hand-cased below —
 * the same exception the registry itself documents: Campground type writes
 * to a scalar enum column (not the `CampSite.options` m2m relation every
 * registry group uses), and price is not a MasterData group at all.
 */

type FilterTranslations = ReturnType<typeof useLanguage>["t"];

export interface ActiveFilterChip {
  /** URL param name this chip's value lives under. */
  key: string;
  /** The raw MasterData code / scalar value this chip removes. */
  value: string;
  /** Localized "<Group>: <Value>" (or "<Field>: <value>" for price) — never a raw code. */
  label: string;
}

/** Every URL param this component tracks (registry groups + type + min/max) — used by "clear all". */
const MANAGED_PARAM_KEYS: readonly string[] = [
  "type",
  "min",
  "max",
  ...FILTERABLE_GROUPS.map((g) => g.urlParam),
];

function filterLabel(t: FilterTranslations, code: string): string {
  return (t.filter as Record<string, string | undefined>)[code] ?? code;
}

/**
 * Derives every active-filter chip from the current URL params — type/min/max
 * first, then every `FILTERABLE_GROUPS` entry in registry declaration order.
 * Pure + framework-free (no hook/router dependency) so it is unit-tested
 * directly against a real `URLSearchParams` (this repo's convention:
 * `environment: 'node'`, no jsdom/@testing-library — see cam-410-chip-render
 * and cam-529-category-tabs).
 */
export function getActiveFilterChips(
  params: URLSearchParams,
  t: FilterTranslations
): ActiveFilterChip[] {
  const chips: ActiveFilterChip[] = [];

  const type = params.get("type");
  if (type && type !== "ALL") {
    chips.push({
      key: "type",
      value: type,
      label: `${t.filter["Campground type"]}: ${filterLabel(t, type)}`,
    });
  }

  const min = params.get("min");
  if (min) {
    chips.push({ key: "min", value: min, label: `${t.filter.minPrice}: ${min}` });
  }

  const max = params.get("max");
  if (max) {
    chips.push({ key: "max", value: max, label: `${t.filter.maxPrice}: ${max}` });
  }

  for (const group of FILTERABLE_GROUPS) {
    const raw = params.get(group.urlParam);
    if (!raw) continue;
    const groupLabel =
      (t.filter as Record<string, string | undefined>)[group.i18nGroupKey] ?? group.i18nGroupKey;
    for (const code of raw.split(",").filter(Boolean)) {
      chips.push({
        key: group.urlParam,
        value: code,
        label: `${groupLabel}: ${filterLabel(t, code)}`,
      });
    }
  }

  return chips;
}

/** Removes exactly ONE value from a (possibly CSV multi-value) param, leaving sibling values intact. */
export function removeActiveFilterValue(
  params: URLSearchParams,
  key: string,
  value: string
): URLSearchParams {
  const next = new URLSearchParams(params.toString());
  const current = next.get(key);
  if (current === null) return next;

  const remaining = current.split(",").filter((v) => v && v !== value);
  if (remaining.length > 0) {
    next.set(key, remaining.join(","));
  } else {
    next.delete(key);
  }
  return next;
}

/** Removes every param this component manages; preserves keyword/province/district/dates/guests/sort. */
export function clearAllActiveFilters(params: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams(params.toString());
  for (const key of MANAGED_PARAM_KEYS) next.delete(key);
  return next;
}

export function ActiveFilters() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { t } = useLanguage();

  const chips = getActiveFilterChips(searchParams, t);

  // Empty state (DESIGN.md 8 states): no active filter -> render nothing at
  // all, not an empty shell/stray spacing.
  if (chips.length === 0) return null;

  const handleRemove = (chip: ActiveFilterChip) => {
    const next = removeActiveFilterValue(searchParams, chip.key, chip.value);
    router.push(`/?${next.toString()}`);
  };

  const handleClearAll = () => {
    const next = clearAllActiveFilters(searchParams);
    router.push(`/?${next.toString()}`);
  };

  return (
    <div className="flex flex-wrap gap-2 items-center mt-2 px-1" data-testid="section--active-filters">
      {chips.map((chip) => (
        <Badge
          key={`${chip.key}-${chip.value}`}
          variant="secondary"
          className="pl-3 pr-1 py-1 gap-1 flex items-center"
          data-testid={`badge--active-filter-${chip.key}-${chip.value}`}
        >
          {chip.label}
          <button
            type="button"
            onClick={() => handleRemove(chip)}
            aria-label={t.activeFilters?.removeFilter.replace("{{label}}", chip.label)}
            className="w-7 h-7 min-w-[28px] flex items-center justify-center rounded-full hover:bg-muted-foreground/20 ml-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            data-testid={`btn--active-filter-remove-${chip.key}-${chip.value}`}
          >
            <X className="w-3 h-3" />
          </button>
        </Badge>
      ))}
      <button
        type="button"
        onClick={handleClearAll}
        aria-label={t.activeFilters?.clearAll}
        className="text-xs text-muted-foreground hover:text-primary font-medium ml-2 underline decoration-border underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded"
        data-testid="btn--active-filters-clear-all"
      >
        {t.activeFilters?.clearAll}
      </button>
    </div>
  );
}

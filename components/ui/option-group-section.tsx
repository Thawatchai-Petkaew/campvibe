/**
 * components/ui/option-group-section.tsx — CAM-528 (S1)
 *
 * The shared "heading + icon/label tile grid" primitive that
 * `CampgroundDetailClient.tsx` copy-pasted ~9x across Terrain, campSiteType,
 * Annotated features, Camper style, and the 3 metadata blocks (Stay
 * connected / Marking method / Driveway) — see `DESIGN.md` §3.1 (checked
 * first; no existing primitive covers this shape) and `.claude/rules/code.md`
 * §3 (reuse-before-create).
 *
 * Pure presentational — no hooks, no "use client" needed. The caller (which
 * already has `t`/i18n and `getFacilityIcon` in scope) supplies the icon
 * renderer and the label resolver, so this primitive stays decoupled from
 * both the translation shape and the icon map.
 *
 * Every className prop defaults to the exact literal the pre-refactor tile
 * block used (`flex flex-col items-start gap-3` / `grid grid-cols-2
 * md:grid-cols-4 gap-y-8 gap-x-4` / `font-medium text-foreground capitalize
 * text-base`) so migrating an existing section is a zero-visual-change
 * refactor; a caller with a genuinely different tile shape (e.g. the
 * horizontal Internal/External facility rows) overrides the 3 className
 * props explicitly.
 */
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface OptionGroupSectionProps {
  /** Already-localized section heading text. */
  heading: string;
  /** Heading element — h2 for a top-level section, h3 for a sub-group inside a shared wrapper. */
  headingTag?: "h2" | "h3";
  headingClassName?: string;
  /** MasterData codes (or a single scalar code wrapped in an array) to render as tiles. */
  codes: string[];
  /** Resolves a code to its localized label — caller owns the `t.filter[code] || code` fallback. */
  getLabel: (code: string) => string;
  /** Resolves a code to its icon node — caller owns the `getFacilityIcon` lookup. */
  getIcon: (code: string) => ReactNode;
  gridClassName?: string;
  itemClassName?: string;
  labelClassName?: string;
  /** Optional data-testid on the outer wrapper. */
  testId?: string;
}

const DEFAULT_HEADING_CLASSNAME = "text-2xl font-bold font-display text-foreground mb-6";
const DEFAULT_GRID_CLASSNAME = "grid grid-cols-2 md:grid-cols-4 gap-y-8 gap-x-4";
const DEFAULT_ITEM_CLASSNAME = "flex flex-col items-start gap-3";
const DEFAULT_LABEL_CLASSNAME = "font-medium text-foreground capitalize text-base";

/**
 * Renders nothing when `codes` is empty — every call site is expected to
 * gate its own outer wrapper (`{codes.length > 0 && (...)}`) the same way
 * every taxonomy section on the detail page already does, but this guard
 * keeps the primitive itself safe against an accidental unconditional mount.
 */
export function OptionGroupSection({
  heading,
  headingTag = "h2",
  headingClassName = DEFAULT_HEADING_CLASSNAME,
  codes,
  getLabel,
  getIcon,
  gridClassName = DEFAULT_GRID_CLASSNAME,
  itemClassName = DEFAULT_ITEM_CLASSNAME,
  labelClassName = DEFAULT_LABEL_CLASSNAME,
  testId,
}: OptionGroupSectionProps) {
  if (codes.length === 0) return null;

  const Heading = headingTag;

  return (
    <div data-testid={testId}>
      <Heading className={headingClassName}>{heading}</Heading>
      <div className={cn(gridClassName)}>
        {codes.map((code) => (
          <div key={code} className={cn(itemClassName)}>
            {getIcon(code)}
            <span className={cn(labelClassName)}>{getLabel(code)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

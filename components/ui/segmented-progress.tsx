import { cn } from "@/lib/utils";

/**
 * SegmentedProgress — CAM-350: a horizontal bar divided into N segments whose
 * widths are proportional to a per-segment `weight`, each rendered as either
 * satisfied (filled) or unsatisfied (translucent, bordered).
 *
 * A display primitive (like Badge/Skeleton) — non-interactive, so the "8
 * interaction states" apply to whatever surrounds it (a job-row link, a
 * retry button), not to this bar. Generic + reusable; its first consumer is
 * `components/ListingCompletenessCard.tsx`.
 *
 * The only inline style is the data-driven `flexBasis` per segment — a
 * proportion (like a chart bar width), not a color/px literal, so it does
 * not trip `check:palette`. All color/radius/spacing stay tokens. This file
 * lives in `components/ui/**` (excluded from `check:ds`).
 *
 * Full anatomy/tokens/motion/a11y spec:
 * docs/specs/m1-data-trust/m1-listing-truth-ราคา-ค่าธรรมเนียม-นโยบายยกเลิก-qu/
 * CAM-350-completeness-segmented-progress-card/design.md
 */

export interface SegmentedProgressSegment {
  key: string;
  weight: number;
  complete: boolean;
}

export interface SegmentedProgressProps {
  /** Ordered segments; width = weight / sum(weight). Rendered in array order. */
  segments: SegmentedProgressSegment[];
  /** Required accessible summary for the track's role="img" (e.g. "ความครบถ้วนของข้อมูลลาน 80%"). */
  "aria-label": string;
  /** Passthrough on the track (height override etc). */
  className?: string;
}

function SegmentedProgress({
  segments,
  "aria-label": ariaLabel,
  className,
}: SegmentedProgressProps) {
  const totalWeight = segments.reduce((sum, segment) => sum + segment.weight, 0) || 1;

  return (
    <div
      role="img"
      aria-label={ariaLabel}
      data-slot="segmented-progress"
      className={cn(
        "flex h-2.5 w-full items-stretch gap-0.5 overflow-hidden rounded-full motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200 motion-safe:ease-[cubic-bezier(0.23,1,0.32,1)]",
        className
      )}
    >
      {segments.map((segment) => (
        <div
          key={segment.key}
          aria-hidden="true"
          style={{ flexBasis: `${(segment.weight / totalWeight) * 100}%` }}
          className={cn(
            "min-w-2 border",
            segment.complete
              ? "bg-primary border-transparent"
              : "bg-muted border-border"
          )}
        />
      ))}
    </div>
  );
}

export { SegmentedProgress };

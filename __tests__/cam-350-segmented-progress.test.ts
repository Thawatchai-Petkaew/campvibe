/**
 * cam-350-segmented-progress.test.ts — source-inspection + logic-matrix
 * tests for the CAM-350 weight-segmented completeness progress card: the new
 * `SegmentedProgress` primitive (components/ui/segmented-progress.tsx) and
 * the `ListingCompletenessCard` consumer wiring (segment derivation, payoff
 * badges, the container-query under-bar strip).
 *
 * vitest runs in the `node` environment with no jsdom (vitest.config.ts), so
 * this follows the source-inspection pattern of
 * __tests__/cam-305-listing-completeness-card.test.ts, plus a logic-matrix
 * that re-runs the SAME algorithm design.md specifies (segment width =
 * weight / Σweight) against the real, imported LISTING_COMPLETENESS_WEIGHTS.
 *
 * AC -> test matrix: AC-1 (segment count/order/flexBasis, satisfied/missing
 * styling) · AC-2 (+{N}% payoff by key) · AC-4/EC-4/EC-6 (100%/0% branches)
 * · AC-8/EC-7 (container-query strip) · BR-1 (no literal weight) · BR-5
 * (never color-alone) · EC-5 (unknown key -> no segment, no badge).
 */

import * as fs from 'fs';
import * as path from 'path';
import { describe, it, expect } from 'vitest';

import {
  LISTING_COMPLETENESS_WEIGHTS,
  type ListingCompletenessMissingItem,
} from '@/lib/listing-completeness';

const primitiveSrc = fs.readFileSync(
  path.join(process.cwd(), 'components/ui/segmented-progress.tsx'),
  'utf-8'
);
const cardSrc = fs.readFileSync(
  path.join(process.cwd(), 'components/ListingCompletenessCard.tsx'),
  'utf-8'
);

// Mirrors the card's segment-derivation algorithm (asserted below via
// source-inspection) so the math is verified against the real weight table.
function buildSegments(missing: ListingCompletenessMissingItem[]) {
  const missingKeys = new Set(missing.map((item) => item.key));
  return LISTING_COMPLETENESS_WEIGHTS.map((criterion) => ({
    key: criterion.key,
    weight: criterion.weight,
    complete: !missingKeys.has(criterion.key),
  }));
}

// ===========================================================================
// SegmentedProgress primitive — props contract + anatomy + tokens
// ===========================================================================

describe('SegmentedProgress primitive', () => {
  it('props contract: ordered segments {key,weight,complete}, required aria-label, optional className', () => {
    expect(primitiveSrc).toContain('key: string;');
    expect(primitiveSrc).toContain('weight: number;');
    expect(primitiveSrc).toContain('complete: boolean;');
    expect(primitiveSrc).toContain('"aria-label": string;');
    expect(primitiveSrc).toContain('className?: string;');
  });

  it('is non-interactive: no onClick/tabIndex/button/link/focus-ring on the bar itself', () => {
    expect(primitiveSrc).not.toContain('onClick');
    expect(primitiveSrc).not.toContain('tabIndex');
    expect(primitiveSrc).not.toContain('<button');
    expect(primitiveSrc).not.toContain('focus-visible:ring');
  });

  it('track: role="img" + consumer aria-label + exact token classes (h-2.5, rounded-full, gap-0.5)', () => {
    expect(primitiveSrc).toContain('role="img"');
    expect(primitiveSrc).toContain('aria-label={ariaLabel}');
    expect(primitiveSrc).toContain('flex h-2.5 w-full items-stretch gap-0.5 overflow-hidden rounded-full');
  });

  it('renders segments in array order (map, no sort/reverse), each aria-hidden', () => {
    expect(primitiveSrc).toContain('segments.map((segment) => (');
    expect(primitiveSrc).not.toMatch(/segments\s*\.\s*(sort|reverse)\(/);
    expect(primitiveSrc).toContain('aria-hidden="true"');
  });

  it('flexBasis is the sole inline style, computed as (weight/totalWeight)*100 + "%"', () => {
    expect(primitiveSrc).toContain(
      'style={{ flexBasis: `${(segment.weight / totalWeight) * 100}%` }}'
    );
    const styleOccurrences = primitiveSrc.match(/style=\{\{/g) ?? [];
    expect(styleOccurrences.length).toBe(1);
  });

  it('[logic-matrix] flexBasis math matches the real weight table (Σweight = 100)', () => {
    const totalWeight = LISTING_COMPLETENESS_WEIGHTS.reduce((sum, c) => sum + c.weight, 0);
    expect(totalWeight).toBe(100);
    for (const criterion of LISTING_COMPLETENESS_WEIGHTS) {
      expect(`${(criterion.weight / totalWeight) * 100}%`).toBe(`${criterion.weight}%`);
    }
  });

  it('BR-5: satisfied = bg-primary/border-transparent, missing = bg-muted/border-border, shared min-w-2 floor', () => {
    expect(primitiveSrc).toContain('"bg-primary border-transparent"');
    expect(primitiveSrc).toContain('"bg-muted border-border"');
    expect(primitiveSrc).toContain('"min-w-2 border"');
  });

  it('BR-8: entrance gated motion-safe: (disabled under prefers-reduced-motion, EC-8); never animates flexBasis', () => {
    expect(primitiveSrc).toContain('motion-safe:animate-in');
    expect(primitiveSrc).toContain('motion-safe:fade-in');
    expect(primitiveSrc).not.toContain('animate-width');
  });
});

// ===========================================================================
// Card — segment derivation + payoff badge (single-source from the weights)
// ===========================================================================

describe('ListingCompletenessCard — segment + payoff derivation (AC-1/AC-2/BR-1)', () => {
  it('imports LISTING_COMPLETENESS_WEIGHTS and SegmentedProgress (reuse, no re-declared table)', () => {
    expect(cardSrc).toContain('LISTING_COMPLETENESS_WEIGHTS');
    expect(cardSrc).toContain(
      'import { SegmentedProgress } from "@/components/ui/segmented-progress";'
    );
  });

  it('builds segments by mapping the weight table (never missing[]), score pill uses the API score directly', () => {
    expect(cardSrc).toContain('LISTING_COMPLETENESS_WEIGHTS.map((criterion) => ({');
    expect(cardSrc).toContain('complete: !missingKeys.has(criterion.key),');
    expect(cardSrc).not.toMatch(/segments\s*\.\s*reduce/);
    expect(cardSrc).toContain('copy.scorePercent.replace("{N}", String(result.score))');
  });

  it('BR-1: no literal weight-percent string (25%/20%/15%/10%) anywhere — every number is computed', () => {
    for (const literal of ['25%', '20%', '15%', '10%']) {
      expect(cardSrc).not.toContain(literal);
    }
    expect(cardSrc).not.toMatch(/weight:\s*(25|20|15|10)\b/);
    expect(primitiveSrc).not.toMatch(/weight:\s*(25|20|15|10)\b/);
  });

  it('AC-2: payoff badge = WEIGHT_BY_KEY[item.key], rendered only when found', () => {
    expect(cardSrc).toContain(
      'LISTING_COMPLETENESS_WEIGHTS.map((criterion) => [criterion.key, criterion.weight])'
    );
    expect(cardSrc).toContain('const weight = WEIGHT_BY_KEY[item.key];');
    expect(cardSrc).toContain('{weight != null && (');
    expect(cardSrc).toContain('copy.payoff.replace("{N}", String(weight))');
  });

  it('[EC-5] an unrecognized key has no weight-table entry (payoff omitted, never a wrong number)', () => {
    const weightByKey: Record<string, number> = Object.fromEntries(
      LISTING_COMPLETENESS_WEIGHTS.map((c) => [c.key, c.weight])
    );
    expect(weightByKey['someUnknownField']).toBeUndefined();
  });
});

// ===========================================================================
// Logic-matrix — 0% / 80% (partial) / 100% worked examples
// ===========================================================================

describe('Segment logic-matrix — 0% / 80% / 100% worked examples', () => {
  it('[EC-6] score=0: all six criteria missing -> every segment unsatisfied', () => {
    const allMissing = LISTING_COMPLETENESS_WEIGHTS.map((c) => ({ key: c.key, label: c.label }));
    const segments = buildSegments(allMissing);
    expect(segments).toHaveLength(6);
    expect(segments.every((s) => s.complete === false)).toBe(true);
  });

  it('[partial 80%] only cancellationPolicy missing -> order preserved, satisfied weight sums to 80', () => {
    const segments = buildSegments([
      { key: 'cancellationPolicy', label: 'ยังไม่ระบุนโยบายยกเลิก' },
    ]);
    expect(segments.map((s) => s.key)).toEqual(LISTING_COMPLETENESS_WEIGHTS.map((c) => c.key));
    const byKey = Object.fromEntries(segments.map((s) => [s.key, s.complete]));
    expect(byKey.cancellationPolicy).toBe(false);
    expect(segments.filter((s) => s.key !== 'cancellationPolicy').every((s) => s.complete)).toBe(true);
    expect(segments.filter((s) => s.complete).reduce((sum, s) => sum + s.weight, 0)).toBe(80);
  });

  it('[AC-4/EC-4] score=100: missing empty -> all six segments satisfied', () => {
    const segments = buildSegments([]);
    expect(segments.every((s) => s.complete === true)).toBe(true);
    expect(segments.reduce((sum, s) => sum + s.weight, 0)).toBe(100);
  });
});

// ===========================================================================
// AC-8/EC-7 — container-query collapse rule (under-bar strip)
// ===========================================================================

describe('ListingCompletenessCard — AC-8/EC-7: under-bar strip is container-query gated', () => {
  it('CardContent opts into @container; the strip is hidden below @sm, flex at @sm and up', () => {
    expect(cardSrc).toContain('<CardContent aria-busy={showSkeleton} className="@container">');
    expect(cardSrc).toContain('hidden @sm:flex');
    expect(cardSrc).toContain('data-testid="strip--listing-completeness-segments"');
  });

  it('the strip is aria-hidden and excludes the bar/count-line/jobs-list (nothing actionable is lost)', () => {
    const stripStart = cardSrc.indexOf('data-testid="strip--listing-completeness-segments"');
    const before = cardSrc.slice(Math.max(0, stripStart - 200), stripStart);
    expect(before).toContain('aria-hidden="true"');

    const stripEnd = cardSrc.indexOf('</div>', stripStart);
    const stripBlock = cardSrc.slice(stripStart, stripEnd);
    expect(stripBlock).not.toContain('section--listing-completeness-missing');
    expect(stripBlock).not.toContain('text--listing-completeness-remaining');
    expect(stripBlock).not.toContain('SegmentedProgress');
  });

  it('each cell: TruncatedLabel for the i18n short name + Check/Minus + "ขาด {N}%" (non-color signal)', () => {
    expect(cardSrc).toContain('import { TruncatedLabel } from "@/components/ui/truncated-label";');
    expect(cardSrc).toContain('<TruncatedLabel as="span"');
    expect(cardSrc).toContain('{copy.segment[segment.key]}');
    expect(cardSrc).toContain('<Check className="size-3 text-primary" aria-hidden="true" />');
    expect(cardSrc).toContain('<Minus className="size-3 text-muted-foreground" aria-hidden="true" />');
    expect(cardSrc).toContain('copy.segmentMissing.replace("{N}", String(segment.weight))');
  });
});

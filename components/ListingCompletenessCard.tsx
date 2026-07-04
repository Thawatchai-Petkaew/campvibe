"use client";

/**
 * ListingCompletenessCard — CAM-305 (per-campsite host dashboard card),
 * revised body per CAM-350: weight-segmented progress bar + a remaining-jobs
 * list where each missing item shows its `+N%` payoff and deep-links to the
 * campsite edit surface.
 *
 * Read-only, client-fetch from the frozen CAM-304 contract
 * GET /api/campsites/[id]/completeness -> { score, missing[] }. Same
 * plumbing as CAM-305 — only the rendered body changed (CAM-350 scope).
 *
 * BR-1 (CAM-305, preserved): labels render verbatim from the API
 * `missing[].label` — this file holds NO hardcoded Thai label map and never
 * re-derives a label from `key`.
 * BR-1 (CAM-350): every segment width and `+N%` payoff derives from the
 * imported LISTING_COMPLETENESS_WEIGHTS — no literal weight in this file.
 * BR-2 (CAM-305, preserved): the fix link is derived from the machine `key`
 * only, via ANCHOR_BY_KEY below; an unrecognized key falls back to the edit
 * page with no hash (EC-5).
 * BR-5/BR-7 (CAM-305/CAM-350): client-fetch anti-flicker via
 * useMinimumLoading (loading-ui-standard §4); the skeleton mirrors the new
 * layout (score pill + bar + count line + job rows).
 * BR-6/BR-7 (CAM-305/CAM-350): a failed fetch renders one error state with a
 * retry that re-fetches only this card.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, Minus, ArrowUpRight, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ErrorBanner } from "@/components/ui/error-banner";
import { SegmentedProgress } from "@/components/ui/segmented-progress";
import { TruncatedLabel } from "@/components/ui/truncated-label";
import { useLanguage } from "@/contexts/LanguageContext";
import { useMinimumLoading } from "@/lib/hooks/use-minimum-loading";
import {
  LISTING_COMPLETENESS_WEIGHTS,
  type ListingCompletenessKey,
  type ListingCompletenessResult,
} from "@/lib/listing-completeness";

export interface ListingCompletenessCardProps {
  /** The campsite this card reports on. */
  campSiteId: string;
  /** Display name from the existing dashboard payload (already language-resolved by the caller). */
  campSiteName: string;
}

// BR-2 (CAM-305) — link map: the fix target is derived from the machine
// `key`, never the label. Anchors now resolve to CAM-341's real edit-form
// sections; an unrecognized key falls through to `edit` with no hash (EC-5)
// rather than being hidden or a dead link.
const ANCHOR_BY_KEY: Record<ListingCompletenessKey, string> = {
  photos: "photos",
  price: "price",
  cancellationPolicy: "cancellation-policy",
  extraFee: "extra-fee",
  zones: "zones",
  amenities: "amenities",
};

function fixLinkFor(campSiteId: string, key: string): string {
  const anchor = (ANCHOR_BY_KEY as Record<string, string | undefined>)[key];
  return anchor
    ? `/dashboard/campsites/${campSiteId}/edit#${anchor}`
    : `/dashboard/campsites/${campSiteId}/edit`;
}

// BR-1 (CAM-350) — single-source weight lookup for the payoff badge; a
// missing key not present here (upstream drift, EC-5) simply has no entry,
// so the badge is omitted rather than showing a wrong/derived number.
const WEIGHT_BY_KEY: Record<string, number> = Object.fromEntries(
  LISTING_COMPLETENESS_WEIGHTS.map((criterion) => [criterion.key, criterion.weight])
);

const TOTAL_WEIGHT = LISTING_COMPLETENESS_WEIGHTS.reduce(
  (sum, criterion) => sum + criterion.weight,
  0
);

export function ListingCompletenessCard({ campSiteId, campSiteName }: ListingCompletenessCardProps) {
  const { t } = useLanguage();
  const copy = t.listingCompleteness;

  const [result, setResult] = useState<ListingCompletenessResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  // Bumping this re-runs the fetch effect below — used by the retry button,
  // so a failure on one card never touches any other card's fetch/state.
  const [attempt, setAttempt] = useState(0);
  const showSkeleton = useMinimumLoading(isLoading);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setHasError(false);

    fetch(`/api/campsites/${campSiteId}/completeness`)
      .then((res) => {
        if (!res.ok) throw new Error(`completeness fetch failed: ${res.status}`);
        return res.json();
      })
      .then((body: unknown) => {
        if (cancelled) return;
        // Guard the contract shape so upstream drift falls to the error state
        // (BR-6) instead of crashing the render (G3 review nit, PR 341).
        const data = body as ListingCompletenessResult;
        if (typeof data?.score !== 'number' || !Array.isArray(data?.missing)) {
          throw new Error('completeness payload off-contract');
        }
        setResult(data);
        setIsLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setHasError(true);
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [campSiteId, attempt]);

  const handleRetry = () => setAttempt((n) => n + 1);

  const isComplete = result != null && result.score === 100 && result.missing.length === 0;

  // BR-1 (CAM-350) — the segment array is single-source: it always maps over
  // the imported weight table (never the API's missing[]), so an unknown
  // missing key can never draw an extra segment (EC-5).
  const missingKeys = new Set((result?.missing ?? []).map((item) => item.key));
  const segments = LISTING_COMPLETENESS_WEIGHTS.map((criterion) => ({
    key: criterion.key,
    weight: criterion.weight,
    complete: !missingKeys.has(criterion.key),
  }));

  return (
    <Card
      data-testid="card--listing-completeness"
      className="rounded-3xl shadow-sm border-border bg-card"
    >
      <CardHeader>
        <CardTitle className="text-base font-semibold text-foreground truncate">
          {campSiteName}
        </CardTitle>
      </CardHeader>
      <CardContent aria-busy={showSkeleton} className="@container">
        <div role="status" aria-live="polite" className="sr-only">
          {showSkeleton ? t.common.loading_sr : ""}
        </div>

        {showSkeleton ? (
          <div
            aria-hidden="true"
            data-testid="skeleton--listing-completeness"
            className="space-y-3"
          >
            <div className="flex items-center justify-between gap-2">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-5 w-14 shrink-0 rounded-full" />
            </div>
            <Skeleton className="h-2.5 w-full rounded-full" />
            <Skeleton className="h-4 w-1/3" />
            <div className="space-y-1">
              <Skeleton className="h-9 w-full rounded-xl" />
              <Skeleton className="h-9 w-full rounded-xl" />
            </div>
          </div>
        ) : hasError ? (
          <div className="space-y-3">
            <ErrorBanner
              message={copy.loadError}
              data-testid="banner--listing-completeness-error"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={handleRetry}
              data-testid="btn--listing-completeness-retry"
            >
              {copy.retry}
            </Button>
          </div>
        ) : result && isComplete ? (
          <div className="space-y-3">
            <SegmentedProgress
              segments={segments}
              aria-label={copy.barSummary.replace("{N}", String(result.score))}
            />
            <Badge variant="success" data-testid="badge--listing-completeness-complete">
              <CheckCircle2 aria-hidden="true" />
              {copy.complete}
            </Badge>
          </div>
        ) : result ? (
          <div className="space-y-3">
            <div className="flex items-center justify-end">
              <Badge
                variant="muted"
                className="tabular-nums"
                data-testid="badge--listing-completeness-score"
              >
                {copy.scorePercent.replace("{N}", String(result.score))}
              </Badge>
            </div>

            <SegmentedProgress
              segments={segments}
              aria-label={copy.barSummary.replace("{N}", String(result.score))}
            />

            <div
              aria-hidden="true"
              data-testid="strip--listing-completeness-segments"
              className="hidden @sm:flex items-start gap-0.5"
            >
              {segments.map((segment) => (
                <div
                  key={segment.key}
                  style={{ flexBasis: `${(segment.weight / TOTAL_WEIGHT) * 100}%` }}
                  className="flex min-w-0 flex-col items-center gap-0.5 px-1 text-center"
                >
                  {segment.complete ? (
                    <Check className="size-3 text-primary" aria-hidden="true" />
                  ) : (
                    <Minus className="size-3 text-muted-foreground" aria-hidden="true" />
                  )}
                  <TruncatedLabel as="span" className="w-full text-xs text-foreground">
                    {copy.segment[segment.key]}
                  </TruncatedLabel>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {segment.complete
                      ? `${segment.weight}%`
                      : copy.segmentMissing.replace("{N}", String(segment.weight))}
                  </span>
                </div>
              ))}
            </div>

            <p
              className="text-sm text-muted-foreground"
              data-testid="text--listing-completeness-remaining"
            >
              {copy.remainingJobs.replace("{N}", String(result.missing.length))}
            </p>

            <ul className="space-y-1" data-testid="section--listing-completeness-missing">
              {result.missing.map((item) => {
                const weight = WEIGHT_BY_KEY[item.key];
                return (
                  <li key={item.key}>
                    <Link
                      href={fixLinkFor(campSiteId, item.key)}
                      data-testid={`link--listing-completeness-${item.key}`}
                      className="group/link flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <span>{item.label}</span>
                      <span className="flex shrink-0 items-center gap-2">
                        {weight != null && (
                          <Badge variant="muted" className="tabular-nums">
                            {copy.payoff.replace("{N}", String(weight))}
                          </Badge>
                        )}
                        <ArrowUpRight
                          className="size-4 shrink-0 text-muted-foreground group-hover/link:text-foreground"
                          aria-hidden="true"
                        />
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export default ListingCompletenessCard;

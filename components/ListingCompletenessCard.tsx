"use client";

/**
 * ListingCompletenessCard — CAM-305: per-campsite host dashboard card showing
 * listing completeness score + itemized missing-field list, each item
 * deep-linking to the campsite edit surface.
 *
 * Read-only, client-fetch from the frozen CAM-304 contract
 * GET /api/campsites/[id]/completeness -> { score, missing[] }.
 *
 * BR-1: labels render verbatim from the API `missing[].label` — this file
 * holds NO hardcoded Thai label map and never re-derives a label from `key`.
 * BR-2: the fix link is derived from the machine `key` only, via ANCHOR_BY_KEY
 * below; an unrecognized key falls back to the edit page with no hash (EC-5).
 * BR-5: client-fetch anti-flicker via useMinimumLoading (loading-ui-standard §4).
 * BR-6: a failed fetch (network / 5xx / defensive 403 / 404) renders one
 * error state with a retry that re-fetches only this card.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ErrorBanner } from "@/components/ui/error-banner";
import { useLanguage } from "@/contexts/LanguageContext";
import { useMinimumLoading } from "@/lib/hooks/use-minimum-loading";
import type {
  ListingCompletenessKey,
  ListingCompletenessResult,
} from "@/lib/listing-completeness";

export interface ListingCompletenessCardProps {
  /** The campsite this card reports on. */
  campSiteId: string;
  /** Display name from the existing dashboard payload (already language-resolved by the caller). */
  campSiteName: string;
}

// BR-2 — link map: the fix target is derived from the machine `key`, never
// the label. Today there is a single edit surface with no per-field anchors
// (progressive enhancement); an unrecognized key falls through to `edit`
// with no hash (EC-5) rather than being hidden or a dead link.
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
      <CardContent aria-busy={showSkeleton}>
        <div role="status" aria-live="polite" className="sr-only">
          {showSkeleton ? t.common.loading_sr : ""}
        </div>

        {showSkeleton ? (
          <div
            aria-hidden="true"
            data-testid="skeleton--listing-completeness"
            className="space-y-3"
          >
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-4/5" />
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
        ) : isComplete ? (
          <Badge variant="success" data-testid="badge--listing-completeness-complete">
            <CheckCircle2 aria-hidden="true" />
            {copy.complete}
          </Badge>
        ) : result ? (
          <div className="space-y-3">
            <p
              className="text-sm font-medium text-foreground"
              data-testid="text--listing-completeness-score"
            >
              {copy.header.replace("{N}", String(result.score))}
            </p>
            <ul className="space-y-1" data-testid="section--listing-completeness-missing">
              {result.missing.map((item) => (
                <li key={item.key}>
                  <Link
                    href={fixLinkFor(campSiteId, item.key)}
                    data-testid={`link--listing-completeness-${item.key}`}
                    className="group/link flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span>{item.label}</span>
                    <ChevronRight
                      className="size-4 shrink-0 text-muted-foreground group-hover/link:text-foreground"
                      aria-hidden="true"
                    />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export default ListingCompletenessCard;

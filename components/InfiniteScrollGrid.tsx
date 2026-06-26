"use client";

/**
 * InfiniteScrollGrid — PERF-3 / CAM-196 Part B
 *
 * Client island that seeds from SSR-rendered initialItems (SEO / no-JS safe)
 * and fetches subsequent pages via IntersectionObserver + /api/campsites cursor API.
 *
 * Props contract (server → client hand-off):
 *   initialItems   — first page of serialised CampSiteCardData (already in HTML from SSR).
 *   initialCursor  — opaque cursor pointing after the last item on the first page, or null.
 *   sort           — active sort value forwarded to /api/campsites.
 *   activeFilters  — raw query-param object forwarded to /api/campsites.
 *   savedIds       — wishlist ids for the first page (server-hydrated).
 *   isLoggedIn     — controls heart/wishlist behaviour.
 *
 * States covered per AC:
 *   default      — grid of CampgroundCard items.
 *   loading      — skeleton row below existing cards (preserves layout, CLS = 0).
 *   end-of-list  — centred muted message, i18n key catalog.end_of_list.
 *   error        — stops fetching silently (no infinite-loop), no crash.
 *
 * Sort/filter reset: the parent re-mounts this component by changing its React key
 * (key={sort + JSON.stringify(filters)}), resetting all state automatically.
 *
 * A11y:
 *   - aria-live="polite" region announces loading / end-of-list (sr-only, Thai copy).
 *   - Sentinel div is aria-hidden + tabindex={-1} — keyboard users never land on it.
 *   - New cards are appended in DOM order; focus is never moved programmatically.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { CampgroundCard } from "@/components/CampgroundCard";
import { CampgroundSkeleton } from "@/components/CampgroundSkeleton";
import { LoginModal } from "@/components/LoginModal";
import { useLanguage } from "@/contexts/LanguageContext";
import type { CampSiteCardData } from "@/components/CampgroundGrid";

// Re-export so callers that imported CampSiteCardData from this module still work.
export type { CampSiteCardData };

// ---------------------------------------------------------------------------
// Cursor page API response shape
// ---------------------------------------------------------------------------

interface CursorPageResponse {
  items: CampSiteCardData[];
  nextCursor: string | null;
}

// ---------------------------------------------------------------------------
// Active filter params forwarded verbatim to /api/campsites
// ---------------------------------------------------------------------------

interface ActiveFilters {
  type?: string;
  keyword?: string;
  province?: string;
  district?: string;
  startDate?: string;
  endDate?: string;
  guests?: string;
  min?: string;
  max?: string;
  access?: string;
  facilities?: string;
  activities?: string;
  terrain?: string;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface InfiniteScrollGridProps {
  initialItems: CampSiteCardData[];
  initialCursor: string | null;
  sort: string;
  activeFilters: ActiveFilters;
  savedIds: string[];
  isLoggedIn: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function InfiniteScrollGrid({
  initialItems,
  initialCursor,
  sort,
  activeFilters,
  savedIds,
  isLoggedIn,
}: InfiniteScrollGridProps) {
  const { t } = useLanguage();

  // Core pagination state — seeded from SSR props.
  const [items, setItems] = useState<CampSiteCardData[]>(initialItems);
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(initialCursor === null);

  // LoginModal for guest heart-clicks.
  const [isLoginOpen, setIsLoginOpen] = useState(false);

  // Saved ids: server-hydrated set + client-side additions via CampgroundCard.
  const savedSet = new Set(savedIds);

  // Sentinel ref for IntersectionObserver.
  const sentinelRef = useRef<HTMLDivElement>(null);

  // ---------------------------------------------------------------------------
  // Fetch next page
  // ---------------------------------------------------------------------------

  const fetchNextPage = useCallback(async () => {
    if (loading || done || cursor === null) return;

    setLoading(true);

    try {
      // Build query string: sort + cursor + forwarded filter params.
      const params = new URLSearchParams();
      params.set("sort", sort);
      params.set("cursor", cursor);

      // Forward only defined filter values.
      const filterKeys = [
        "type", "keyword", "province", "district",
        "startDate", "endDate", "guests", "min", "max",
        "access", "facilities", "activities", "terrain",
      ] as const;

      for (const key of filterKeys) {
        const val = activeFilters[key];
        if (val !== undefined && val !== "") {
          params.set(key, val);
        }
      }

      const res = await fetch(`/api/campsites?${params.toString()}`);

      // On any non-ok response: stop fetching (do not infinite-loop on errors).
      if (!res.ok) {
        setDone(true);
        return;
      }

      const data: CursorPageResponse = await res.json();

      setItems((prev) => [...prev, ...data.items]);
      setCursor(data.nextCursor);
      setDone(data.nextCursor === null);
    } catch {
      // Network/parse error: stop fetching silently.
      setDone(true);
    } finally {
      setLoading(false);
    }
  }, [loading, done, cursor, sort, activeFilters]);

  // ---------------------------------------------------------------------------
  // IntersectionObserver — fires fetchNextPage when sentinel enters viewport.
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          fetchNextPage();
        }
      },
      {
        // Trigger slightly before the sentinel reaches the viewport edge
        // so the next page starts loading before the user hits the very bottom.
        rootMargin: "0px 0px 200px 0px",
        threshold: 0,
      }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [fetchNextPage]);

  // ---------------------------------------------------------------------------
  // Accessibility announce text (sr-only, aria-live="polite")
  // ---------------------------------------------------------------------------

  const announceText = loading
    ? t.catalog.loading_more
    : done && items.length > initialItems.length
      ? t.catalog.end_of_list
      : "";

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <>
      {/* Accessible live region — visually hidden, announces state changes. */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {announceText}
      </div>

      {/* Card grid */}
      <div
        className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-6 gap-y-10 mt-4"
        data-testid="grid--infinite-scroll"
      >
        {items.map((camp) => (
          <CampgroundCard
            key={camp.id}
            campground={camp as any /* serialised CampSite — createdAt is string from JSON, card handles both */}
            initialSaved={savedSet.has(camp.id)}
            isLoggedIn={isLoggedIn}
            onGuestHeartClick={() => setIsLoginOpen(true)}
            avgRating={camp.avgRating}
            reviewCount={camp.reviewCount}
          />
        ))}

        {/* Loading skeletons — rendered inside the grid to preserve layout (CLS = 0). */}
        {loading && Array.from({ length: 5 }).map((_, i) => (
          <CampgroundSkeleton key={`sk-${i}`} />
        ))}
      </div>

      {/* End-of-list message — shown when cursor is null after at least one extra fetch. */}
      {done && items.length > initialItems.length && (
        <p
          className="mt-10 text-center text-sm text-muted-foreground"
          data-testid="text--end-of-list"
        >
          {t.catalog.end_of_list}
        </p>
      )}

      {/*
        Sentinel div — the IntersectionObserver target.
        tabindex={-1}: keyboard users do not land on it.
        aria-hidden: screen readers skip it entirely.
      */}
      <div
        ref={sentinelRef}
        tabIndex={-1}
        aria-hidden="true"
        data-testid="sentinel--infinite-scroll"
        className="h-1"
      />

      {/* LoginModal for guest heart-clicks from any card. */}
      <LoginModal
        isOpen={isLoginOpen}
        onClose={() => setIsLoginOpen(false)}
        subtitle={t.wishlist.loginPromptGuest}
      />
    </>
  );
}

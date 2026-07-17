/**
 * cam-394-stream-reviews.test.ts — CAM-394: stream the campground detail page.
 *
 * Two layers (repo precedent for page/large-client components = source-inspection,
 * plus a real render of the pure skeleton for teeth):
 *
 *   Part A — REAL render (react-dom/server) of the pure <ReviewsListSkeleton>:
 *   proves the Suspense fallback announces via role=status + the sr-only Thai
 *   label, mirrors the list (≥3 card placeholders), and is token-only (bg-muted).
 *
 *   Part B — source-inspection of the streaming CONTRACT (the page + client are
 *   server/prisma/Suspense wiring that vitest's node env can't render end-to-end).
 *   Each assertion is a Prove-It: it fails if the stream is reverted to a blocking
 *   await (the whole point of the story) or an isolated-error guard is dropped.
 */
import { describe, it, expect } from "vitest";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "fs";
import { resolve } from "path";
import { ReviewsListSkeleton } from "../components/ui/reviews-list-skeleton";

const read = (p: string) => readFileSync(resolve(__dirname, "..", p), "utf-8");
const pageSrc = read("app/campgrounds/[slug]/page.tsx");
const clientSrc = read("components/CampgroundDetailClient.tsx");
const loadingSrc = read("app/campgrounds/[slug]/loading.tsx");

describe("CAM-394 ReviewsListSkeleton — real render", () => {
  const html = renderToStaticMarkup(React.createElement(ReviewsListSkeleton));

  it("[unit] a11y: role=status + aria-busy + sr-only Thai loading label", () => {
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain("กำลังโหลด…");
    expect(html).toContain('data-testid="skeleton--reviews-list"');
  });

  it("[unit] mirrors the list (>=3 card placeholders), decorative + token-only", () => {
    const cards = (html.match(/border-b border-border/g) || []).length;
    expect(cards).toBeGreaterThanOrEqual(3);
    expect(html).toContain('aria-hidden="true"'); // visual list hidden from SR
    expect(html).toContain("bg-muted"); // Skeleton token fill, no hardcoded palette
  });
});

describe("CAM-394 streaming contract — page.tsx", () => {
  it("[unit] the review LIST streams (passed UNAWAITED as reviewsPromise, not reviews)", () => {
    // Prove-It: FAILS if reverted to a blocking `reviews={reviews}` prop.
    expect(pageSrc).toContain("reviewsPromise={reviewsPromise}");
    expect(pageSrc).not.toContain("reviews={reviews}");
    // the stream wrapper shape (never awaited here) — asserted loosely so a
    // Prettier reflow of the .then() line can't fail a behaviorally-correct file.
    expect(pageSrc).toMatch(/\.then\(/);
    expect(pageSrc).toContain("ok: true as const");
    expect(pageSrc).toContain("rows.map(toReviewListItem)");
  });

  it("[unit] AC-6: the streamed promise never rejects (resolves ok:false → isolated error)", () => {
    expect(pageSrc).toContain(".catch(() => ({ ok: false as const }))");
  });

  it("[unit] the aggregate STAYS on the awaited fast path (header stars + count immediate)", () => {
    // Prove-It: FAILS if the aggregate is moved off the awaited path (header would blank).
    expect(pageSrc).toMatch(/await\s+prisma\.review\.aggregate/);
  });

  it("[boundary] a 0-review camp does NOT query the list (resolved empty promise)", () => {
    expect(pageSrc).toContain("reviewCount > 0");
    expect(pageSrc).toContain("Promise.resolve({ ok: true as const, reviews: [] })");
  });
});

describe("CAM-394 streaming contract — CampgroundDetailClient", () => {
  it("[unit] list renders behind <Suspense fallback={<ReviewsListSkeleton/>}> via use()", () => {
    expect(clientSrc).toContain("<Suspense fallback={<ReviewsListSkeleton />}>");
    expect(clientSrc).toContain("use(reviewsPromise)");
  });

  it("[unit] empty (AC-4) + isolated error (AC-6) states preserved", () => {
    expect(clientSrc).toContain('data-testid="empty--reviews"');
    expect(clientSrc).toContain('data-testid="error--reviews"');
    expect(clientSrc).toContain("!result.ok");
  });
});

describe("CAM-394 loading.tsx — anti-flicker + hero shape (CLS)", () => {
  it("[unit] applies skeleton-delay-show (no loader flash on fast nav)", () => {
    expect(loadingSrc).toContain("skeleton-delay-show");
  });

  it("[unit] hero skeleton mirrors the real 5-image hero (no layout shift)", () => {
    expect(loadingSrc).toContain("grid-cols-4 grid-rows-2");
    expect(loadingSrc).toContain("h-[480px]");
    expect(loadingSrc).toContain("col-span-2 row-span-2");
  });
});

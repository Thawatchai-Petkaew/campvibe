// @vitest-environment jsdom
/**
 * cam-698-chat-price-unit.test.ts — CAM-698 (epic CAM-695)
 *
 * Bug: the in-chat "เริ่มจอง" flow under-quoted every PER_PERSON camp.
 * `AiChatDetailCard.tsx`'s `handleStartBooking` hardcoded
 * `campSitePriceUnit: null` into its `resolveUnitPrice` call — even though
 * `get-camp-detail.ts` (CAM-656) has selected + returned the real
 * `CampSite.priceUnit` as `detail.price.unit` since that story shipped. A
 * hardcoded `null` normalizes to `PER_SITE` (ADR-014 §2), so
 * `BookingCampContext.priceUnit` was always `PER_SITE` regardless of the
 * camp's real unit, and `booking-view.ts`'s `buildSummaryView` (already
 * correct + pinned by __tests__/cam-640-booking-view.test.ts:218-222) never
 * multiplied the total by the guest count. After CAM-673 (~95% of camps are
 * PER_PERSON), this meant the chat's booking summary quoted ฿500 for a stay
 * the write path (`POST /api/bookings`, __tests__/cam-652-charge-the-chosen-
 * unit.test.ts) correctly charges ฿1,500 for 3 guests — the camper is shown
 * a price the booking never actually charges.
 *
 * Two proofs, both against REAL production code (never reimplemented):
 *   1. [render] the actual `AiChatDetailCard` component, mocked network
 *      only — proves the WIRING: the value handleStartBooking captures into
 *      BookingCampContext, and that the card's own price caption already
 *      states the real unit (lib/read-models/ai-camp-card.ts already
 *      selects CampSite.priceUnit via its `...campCardSelect` spread,
 *      CAM-653 — confirmed by direct inspection this story; no select/wire
 *      change was needed there, see the PR summary).
 *   2. [unit] the real `resolveUnitPrice` + `buildSummaryView` chained with
 *      the two argument shapes (today's hardcoded `null` vs the fix's
 *      `detail.price.unit`) — the before/after total, kept side by side as
 *      permanent documentation of the defect and its fix.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import * as React from "react";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { getTranslations } from "@/locales/translations";
import { resolveUnitPrice } from "@/lib/booking-pricing";
import { buildSummaryView, type BookingCampContext } from "@/components/ai-chat/booking-view";
import type { AiChatCardResponse } from "@/lib/api-client";
import type { GetCampDetailResult } from "@/lib/ai/tools/get-camp-detail";

interface MockLinkProps {
  href: string;
  children?: React.ReactNode;
  className?: string;
  "data-testid"?: string;
  "data-slot"?: string;
}

vi.mock("next/link", () => {
  const MockLink = React.forwardRef<HTMLAnchorElement, MockLinkProps>(({ href, children, ...rest }, ref) =>
    React.createElement("a", { href, ref, ...rest }, children)
  );
  MockLink.displayName = "MockNextLink";
  return { __esModule: true, default: MockLink };
});

const getCampDetailMock = vi.fn<(id: string) => Promise<GetCampDetailResult>>();

vi.mock("@/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-client")>();
  return {
    ...actual,
    aiChatAPI: { ...actual.aiChatAPI, getCampDetail: (id: string) => getCampDetailMock(id) },
  };
});

const { AiChatDetailCard } = await import("@/components/ai-chat/AiChatDetailCard");

const CAMP_ID = "b1c2d3e4-f5a6-4b7c-8d9e-000000000042";

function makeCard(overrides: Partial<AiChatCardResponse> = {}): AiChatCardResponse {
  return {
    id: CAMP_ID,
    nameTh: "แคมป์ทดสอบ",
    nameEn: "Test Camp",
    nameThSlug: "camp-thsedtsxb",
    nameEnSlug: "test-camp",
    priceLow: 500,
    priceUnit: "PER_PERSON",
    createdAt: "2026-01-01T00:00:00.000Z",
    avgRating: null,
    reviewCount: 0,
    location: { province: "เชียงใหม่" },
    ...overrides,
  };
}

function makeDetail(overrides: Partial<Extract<GetCampDetailResult, { ok: true }>["price"]> = {}): GetCampDetailResult {
  return {
    ok: true,
    id: CAMP_ID,
    nameTh: "แคมป์ทดสอบ",
    nameEn: "Test Camp",
    description: null,
    // CAM-700 — this story never touches per-pitch flows; whole-camp fixture.
    useSpotView: false,
    amenities: [],
    reviews: [],
    reviewSummary: { hasReviews: false, avgRating: null, count: 0 },
    price: { low: 500, high: null, currency: "THB", unit: "PER_PERSON", extraFeeAmount: null, extraFeeLabel: null, feeInfo: null, isFree: false, ...overrides },
    capacity: { maxGuestsPerDay: null, maxTentsPerDay: null },
    cancellationPolicy: null,
    isVerified: false,
    checkInTime: "14:00",
    checkOutTime: "12:00",
    minimumAge: null,
    location: { province: null, region: null },
    directions: null,
    distanceFromBangkokKm: null,
    availableWeekendDates: [],
    weekendAvailability: [],
    facets: [],
  };
}

/**
 * Renders `AiChatDetailCard` under a Thai `LanguageProvider`. Built as a
 * separately-typed props const (not an inline object literal in the
 * `createElement` call) so `children` satisfies `LanguageProvider`'s
 * required prop for both TS's `createElement` overload resolution AND
 * `eslint-plugin-react`'s `no-children-prop` rule (which only inspects an
 * inline object-literal argument, not an identifier reference).
 */
function renderInThai(card: AiChatCardResponse, onStartBooking: (camp: BookingCampContext) => void = vi.fn()) {
  const providerProps: React.ComponentProps<typeof LanguageProvider> = {
    initialLanguage: "th",
    children: React.createElement(AiChatDetailCard, {
      card,
      expanded: false,
      onClose: vi.fn(),
      onStartBooking,
    }),
  };
  return React.createElement(LanguageProvider, providerProps);
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("[render] AiChatDetailCard — handleStartBooking threads the real detail.price.unit (CAM-698 fix)", () => {
  it("[normal] a PER_PERSON camp: onStartBooking receives priceUnit='PER_PERSON' (not the hardcoded PER_SITE default), and buildSummaryView on that context totals ฿1,500 for 3 guests — before this fix it captured PER_SITE and totalled ฿500", async () => {
    getCampDetailMock.mockResolvedValue(makeDetail());
    const onStartBooking = vi.fn();

    render(renderInThai(makeCard(), onStartBooking));

    const startButton = (await screen.findByTestId("btn--ai-chat-booking-start")) as HTMLButtonElement;
    await waitFor(() => expect(startButton.disabled).toBe(false));
    fireEvent.click(startButton);

    expect(onStartBooking).toHaveBeenCalledTimes(1);
    const capturedContext = onStartBooking.mock.calls[0]![0] as BookingCampContext;
    expect(capturedContext.unitPrice).toBe(500);
    // The core defect: this used to be 'PER_SITE' (resolveUnitPrice's
    // normalizeUnit(null) fallback) regardless of the camp's real unit.
    expect(capturedContext.priceUnit).toBe("PER_PERSON");

    const view = buildSummaryView({
      // CAM-699 (2026-08-06): `nights` is now a required slot (buildSummaryView
      // reads `slots.nights!`, no longer a hardcoded 1) — added here as `1` to
      // match this case's own "1 night" total; the price-unit assertion this
      // test exists for is unchanged.
      slots: { checkIn: "2026-09-01", checkOut: "2026-09-02", nights: 1, guests: 3 },
      camp: capturedContext,
      t: getTranslations("th"),
      language: "th",
      today: "2026-08-20",
    });
    expect(view.totalValue).toBe("฿1,500"); // 500 * 3 guests * 1 night — was ฿500 before CAM-698
  });

  it("[normal] the card's own price caption states the real unit, not the /คืน default — proves lib/read-models/ai-camp-card.ts's select already carries priceUnit end to end (CAM-653), so no select/wire change was needed for this story", async () => {
    getCampDetailMock.mockResolvedValue({ ok: false, code: "not_found" });

    render(renderInThai(makeCard({ priceUnit: "PER_PERSON" })));

    const ctaPrice = await screen.findByTestId("text--ai-chat-detail-cta-price");
    const th = getTranslations("th");
    // The suffix is its own trailing <span> (the amount is a separate leading
    // span) — an EXACT match on that span's text is the discriminating check:
    // "/คน/คืน" (PER_PERSON) legitimately contains "/คืน" (PER_SITE) as a
    // substring, so a .toContain/.not.toContain pair on the raw text would be
    // meaningless here.
    const suffixText = ctaPrice.querySelector("span:last-child")?.textContent;
    expect(suffixText).toBe(th.common.priceUnitSuffix.PER_PERSON); // "/คน/คืน"
    expect(suffixText).not.toBe(th.common.priceUnitSuffix.PER_SITE); // never silently falls back to "/คืน" for a PER_PERSON camp
  });
});

describe("[unit] resolveUnitPrice + buildSummaryView — before/after documentation of the defect (real production functions, not reimplemented)", () => {
  const baseCamp: Omit<BookingCampContext, "unitPrice" | "priceUnit"> = {
    campId: CAMP_ID,
    slug: "test-camp",
    name: "แคมป์ทดสอบ",
    weekendAvailability: [],
    maxGuestsPerDay: null,
    useSpotView: false,
    priceIsFree: false,
  };
  // CAM-699 (2026-08-06): `nights` is now a required slot (buildSummaryView
  // no longer hardcodes 1) — added here as `1` to preserve this describe
  // block's own "1 night" before/after documentation; totals below are
  // UNCHANGED (the price-unit defect these two cases prove is orthogonal to
  // the night count).
  const slots = { checkIn: "2026-09-01", checkOut: "2026-09-02", nights: 1, guests: 3 };
  const t = getTranslations("th");

  it("[before] the pre-CAM-698 call site (campSitePriceUnit: null) normalizes to PER_SITE and never multiplies by guests -> ฿500", () => {
    const resolved = resolveUnitPrice({
      campSitePriceLow: 500,
      campSitePriceUnit: null, // the exact bug: AiChatDetailCard.tsx hardcoded this
      spotPricePerNight: null,
      spotPriceUnit: null,
    });
    expect(resolved.unit).toBe("PER_SITE");
    const view = buildSummaryView({
      slots,
      camp: { ...baseCamp, unitPrice: resolved.unitPrice, priceUnit: resolved.unit },
      t,
      language: "th",
      today: "2026-08-20",
    });
    expect(view.totalValue).toBe("฿500"); // the defect: 3 guests never multiplied
  });

  it("[after] the CAM-698 call site (campSitePriceUnit: detail.price.unit) preserves PER_PERSON and multiplies by guests -> ฿1,500", () => {
    const resolved = resolveUnitPrice({
      campSitePriceLow: 500,
      campSitePriceUnit: "PER_PERSON", // the fix: detail.price.unit, real and NOT NULL
      spotPricePerNight: null,
      spotPriceUnit: null,
    });
    expect(resolved.unit).toBe("PER_PERSON");
    const view = buildSummaryView({
      slots,
      camp: { ...baseCamp, unitPrice: resolved.unitPrice, priceUnit: resolved.unit },
      t,
      language: "th",
      today: "2026-08-20",
    });
    expect(view.totalValue).toBe("฿1,500"); // fixed: 500 * 3 guests * 1 night
  });
});

/**
 * cam-635-camp-page-prefill.test.ts — CAM-635
 *
 * app/campgrounds/[slug]/page.tsx now reads `searchParams` and calls the ONE
 * shared reader (`parseBookingPrefill`, lib/booking-prefill.ts, CAM-634) to
 * seed the booking widget from a chat handoff link. This suite proves the
 * PAGE-LEVEL wiring: which `prefill`/`fromChat` props reach
 * `CampgroundDetailClient`, and the reject-path log line — never the reader's
 * own parsing rules (already proven in `cam-634-booking-prefill.test.ts`).
 *
 * Mocks only the outer boundary (auth/prisma/catalog-cache/campsite-
 * visibility/next-navigation/child components) — the same strategy
 * `cam-588-stale-client-and-swallowed-errors.test.ts` and
 * `cam-269-verified-stay-gate.test.ts` use for this exact page. The real
 * `parseBookingPrefill` + `bangkokTodayISO` run unmocked.
 *
 * `today` is NOT injected here (unlike lib/booking-prefill.ts's own suite) —
 * page.tsx is the real caller that sources it from the system clock via
 * `bangkokTodayISO(new Date())` (BR-3), so every date fixture below is
 * computed relative to `new Date()` at test-run time, never a hardcoded
 * literal that eventually lands in the past.
 *
 * Coverage matrix per .claude/rules/qa.md:
 *   normal (AC-1 valid prefill reaches the client) · boundary (checkIn ===
 *   today accepted, EC of CAM-634 re-proven at this layer) · null/empty
 *   (EC-1 bare link -> no parse attempted, no log) · error/validation (AC-2,
 *   one test per named reject reason + the log line shape) · the
 *   `from=chat` attribution flag independent of prefill validity (EC-5)
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { addDays, format, subDays } from "date-fns";

const {
  mockNotFound,
  mockAuth,
  mockGetCampBySlug,
  mockCanViewCampSite,
  mockWishlistFindUnique,
  mockReviewAggregate,
} = vi.hoisted(() => ({
  mockNotFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
  mockAuth: vi.fn(),
  mockGetCampBySlug: vi.fn(),
  mockCanViewCampSite: vi.fn(),
  mockWishlistFindUnique: vi.fn(),
  mockReviewAggregate: vi.fn(),
}));

// CAM-635: the page is invoked directly (never actually rendered by React,
// same as cam-588's strategy for this page) — a mocked function component
// is never CALLED merely by appearing in a `React.createElement` tree, only
// its `.props` are stored on the returned element. So this suite reads the
// props straight off the returned JSX (`lastDetailProps` below) rather than
// spying on invocation.
function DetailClientStub() {
  return null;
}

vi.mock("next/navigation", () => ({ notFound: mockNotFound }));
vi.mock("@/lib/auth", () => ({ auth: (...args: unknown[]) => mockAuth(...args) }));
vi.mock("@/lib/catalog-cache", () => ({
  getCampBySlug: (...args: unknown[]) => mockGetCampBySlug(...args),
}));
vi.mock("@/lib/campsite-visibility", () => ({
  canViewCampSite: (...args: unknown[]) => mockCanViewCampSite(...args),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    wishlist: { findUnique: (...args: unknown[]) => mockWishlistFindUnique(...args) },
    review: {
      aggregate: (...args: unknown[]) => mockReviewAggregate(...args),
      findMany: vi.fn(),
    },
  },
}));
vi.mock("@/components/Navbar", () => ({ Navbar: () => null }));
vi.mock("@/components/CampgroundDetailClient", () => ({
  default: DetailClientStub,
}));
vi.mock("@/locales/translations", () => ({ getTranslations: () => ({}) }));
vi.mock("@/lib/serialize", () => ({ serializeDecimals: (v: unknown) => v }));
vi.mock("@/lib/review-summary", () => ({
  buildReviewSummary: vi.fn(() => ({ avgRating: null, count: 0 })),
  toReviewListItem: vi.fn((r: unknown) => r),
}));
vi.mock("@/lib/read-models/camp-card", () => ({
  getProvinceThaiNameMap: vi.fn(async () => new Map()),
  withProvinceThaiNames: vi.fn((rows: unknown[]) => rows),
}));

import CampgroundPage from "@/app/campgrounds/[slug]/page";

const SESSION = { user: { id: "user-1" } };
const CAMP = {
  id: "camp-1",
  operatorId: "op-1",
  isActive: true,
  isPublished: true,
  deletedAt: null,
};

function invoke(sp: Record<string, string | string[] | undefined> = {}) {
  return CampgroundPage({
    params: Promise.resolve({ slug: "camp-x" }),
    searchParams: Promise.resolve(sp),
  });
}

/** Every case here is relative to test-run time, not a hardcoded literal. */
const today = new Date();
const iso = (d: Date) => format(d, "yyyy-MM-dd");
const TODAY = iso(today);
const IN_5 = iso(addDays(today, 5));
const IN_6 = iso(addDays(today, 6));
const YESTERDAY = iso(subDays(today, 1));

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.mockResolvedValue(SESSION);
  mockGetCampBySlug.mockResolvedValue(CAMP);
  mockCanViewCampSite.mockReturnValue(true);
  mockWishlistFindUnique.mockResolvedValue(null);
  mockReviewAggregate.mockResolvedValue({ _avg: { rating: null }, _count: { rating: 0 } });
});

/**
 * Reads the props handed to <CampgroundDetailClient> straight off the JSX
 * tree page.tsx returns — `<main><Navbar/><CampgroundDetailClient .../></main>`
 * — since the mocked component is never actually invoked by React here.
 */
function detailProps(pageResult: unknown): { prefill: unknown; fromChat: unknown } {
  const main = pageResult as { props: { children: Array<{ type: unknown; props: unknown }> } };
  const detailElement = main.props.children.find((child) => child?.type === DetailClientStub);
  return detailElement!.props as { prefill: unknown; fromChat: unknown };
}

describe("CAM-635 AC-1 — a valid prefill reaches CampgroundDetailClient", () => {
  it("[unit, normal] checkIn/checkOut/guests parse through unchanged", async () => {
    const result = await invoke({ checkIn: IN_5, checkOut: IN_6, guests: "2", from: "chat" });

    const { prefill } = detailProps(result);
    expect(prefill).toEqual({ checkIn: IN_5, checkOut: IN_6, guests: 2, from: "chat" });
  });

  it("[unit, boundary] checkIn === today is accepted, never rejected as past", async () => {
    const result = await invoke({ checkIn: TODAY, checkOut: IN_5, guests: "1" });

    const { prefill } = detailProps(result);
    expect(prefill).toMatchObject({ checkIn: TODAY });
  });
});

describe("CAM-635 AC-2 — every named reject reason falls back to null (no toast/banner) + one log line", () => {
  const cases: Array<[string, Record<string, string>]> = [
    ["malformed", { checkOut: IN_5, guests: "2" }], // checkIn missing entirely
    ["past", { checkIn: YESTERDAY, checkOut: IN_5, guests: "1" }],
    ["inverted", { checkIn: IN_5, checkOut: TODAY, guests: "1" }],
    ["too_long", { checkIn: IN_5, checkOut: iso(addDays(today, 5 + 31)), guests: "1" }],
    ["guests_out_of_range", { checkIn: IN_5, checkOut: IN_6, guests: "0" }],
  ];

  it.each(cases)("[unit, error/validation] reason=%s -> prefill null, logged, no throw", async (reason, sp) => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const result = await invoke(sp);

    const { prefill } = detailProps(result);
    expect(prefill).toBeNull();

    const logged = warnSpy.mock.calls
      .map((c) => c[0])
      .find((line) => typeof line === "string" && line.includes("booking_prefill_rejected"));
    expect(logged).toBeDefined();
    const parsed = JSON.parse(logged as string);
    expect(parsed.event).toBe("booking_prefill_rejected");
    expect(parsed.slug).toBe("camp-x");
    expect(parsed.reason).toBe(reason);
    // No PII: only slug + reason + event/level fields.
    expect(Object.keys(parsed).sort()).toEqual(["event", "level", "reason", "slug"]);

    warnSpy.mockRestore();
  });
});

describe("CAM-635 EC-1 — an ordinary bare link never attempts a parse or a log", () => {
  it("[unit, null/empty] no checkIn/checkOut/guests at all -> prefill null, console.warn never called", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const result = await invoke({});

    const { prefill } = detailProps(result);
    expect(prefill).toBeNull();
    expect(warnSpy).not.toHaveBeenCalled();

    warnSpy.mockRestore();
  });
});

describe("CAM-635 EC-5 — fromChat is read independently of prefill validity", () => {
  it("[unit] from=chat present + a REJECTED prefill -> fromChat is still true", async () => {
    const result = await invoke({ checkIn: YESTERDAY, checkOut: IN_5, guests: "1", from: "chat" });

    const { prefill, fromChat } = detailProps(result);
    expect(prefill).toBeNull();
    expect(fromChat).toBe(true);
  });

  it("[unit] no from param -> fromChat is false even with a valid prefill", async () => {
    const result = await invoke({ checkIn: IN_5, checkOut: IN_6, guests: "2" });

    const { fromChat } = detailProps(result);
    expect(fromChat).toBe(false);
  });

  it("[unit] from has any other value -> fromChat is false", async () => {
    const result = await invoke({ checkIn: IN_5, checkOut: IN_6, guests: "2", from: "email" });

    const { fromChat } = detailProps(result);
    expect(fromChat).toBe(false);
  });
});

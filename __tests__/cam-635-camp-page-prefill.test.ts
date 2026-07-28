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
 * CLOCK DISCIPLINE (G3 fix — the class of bug CAM-634 itself exists to
 * prevent, see lib/booking-prefill.ts's own header comment):
 *
 * `page.tsx` is the real caller that sources `today` from the system clock
 * via `bangkokTodayISO(new Date())` (BR-3) — it is never injected, by
 * design. A PRIOR version of this file computed its own `TODAY` via
 * `new Date()` + date-fns `format` (the test PROCESS's local/UTC day). That
 * silently disagreed with page.tsx's Bangkok-civil-day whenever the process
 * ran between ~17:00-24:00 UTC (00:00-07:00 the NEXT day in Asia/Bangkok,
 * UTC+7) — exactly what happened on CI (ran 19:45 UTC = 02:45 Bangkok the
 * next day), so a link dated "today" by the test's own reckoning was
 * correctly rejected as `past` by the real Bangkok day.
 *
 * The fix is NOT a date picked further in the future (that only narrows the
 * window, it does not close it) — the clock is FROZEN for the whole suite
 * (`vi.useFakeTimers` + `vi.setSystemTime`), so page.tsx's internal
 * `new Date()` and this file's own reference point are the exact same
 * instant, and `TODAY` is derived via the SAME `bangkokTodayISO` function
 * page.tsx calls (never a second, independently-computed "today"). Every
 * other fixture (`IN_5`/`IN_6`/`YESTERDAY`) is pure Date.UTC calendar
 * arithmetic on that ISO string (`addISODays`, mirrors the Date.UTC idiom
 * `lib/booking-prefill.ts` itself uses for `nightsBetween`) — never
 * date-fns `addDays`/`format` on a live Date, which reads the process's
 * local timezone and would reintroduce the exact same class of drift.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { bangkokTodayISO } from "@/lib/ai/date-phrases";

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

// CAM-635 G3 fix: one fixed instant, clearly mid-morning Bangkok (11:00) so
// it is never itself near a Bangkok-midnight boundary. This is a literal
// Date object, NOT `new Date()` — computing TODAY/IN_5/etc from it below
// needs no fake-timers machinery at all; the freeze (beforeAll/afterAll)
// exists solely so page.tsx's OWN internal `new Date()` call, at test
// EXECUTION time, returns this identical instant.
const FROZEN_NOW = new Date("2026-01-15T04:00:00.000Z");

/** Pure Date.UTC calendar-date arithmetic on a YYYY-MM-DD string — TZ-independent,
 *  mirrors the same Date.UTC idiom lib/booking-prefill.ts uses for `nightsBetween`.
 *  Never a date-fns `addDays`/`format` round-trip through a live Date (that reads
 *  the process's local timezone and is exactly how the prior version drifted). */
function addISODays(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
}

// The SAME function page.tsx calls — never a second, independently-derived
// "today". Computed once at module load from the literal FROZEN_NOW above,
// so every `it.each` table built during test collection (before any hook
// runs) already has real, stable values.
const TODAY = bangkokTodayISO(FROZEN_NOW);
const IN_5 = addISODays(TODAY, 5);
const IN_6 = addISODays(TODAY, 6);
const YESTERDAY = addISODays(TODAY, -1);

beforeAll(() => {
  // toFake: ['Date'] only — surgical, doesn't touch setTimeout/setInterval
  // (no other code path in this suite's real call graph depends on timers).
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(FROZEN_NOW);
});

afterAll(() => {
  vi.useRealTimers();
});

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
    ["too_long", { checkIn: IN_5, checkOut: addISODays(TODAY, 5 + 31), guests: "1" }],
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

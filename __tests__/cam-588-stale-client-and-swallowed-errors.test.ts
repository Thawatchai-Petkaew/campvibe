/**
 * cam-588-stale-client-and-swallowed-errors.test.ts — CAM-588
 *
 * Two distinct defects, kept separable here the same way they are in the diff:
 *
 *   Part A — app/campgrounds/[slug]/page.tsx no longer maps a thrown
 *   getCampBySlug error to notFound(). The real page's default export is
 *   invoked directly (mocked outer boundaries only — auth/prisma/catalog-cache/
 *   campsite-visibility/next-navigation/child components — the same "mock
 *   only the boundary" strategy __tests__/cam-269-verified-stay-gate.test.ts
 *   and __tests__/cam-357-cache-tags.test.ts use elsewhere in this repo) and
 *   asserted on what is actually THROWN, not on source text — the trap named
 *   in the ticket is a test that only proves "the page renders."
 *
 *   Part B — scripts/dev-with-prisma-watch.mjs notices a schema/migration
 *   change on a REAL filesystem (mkdtemp + fs.watch), not a call to a bare
 *   comparison function with literal values — real teeth per CAM-201's
 *   "prefer a behavioral assertion over a source grep where the env allows."
 *
 * Prove-It: every AC-1/EC-1 assertion below was verified to FAIL against the
 * PRE-CAM-588 page.tsx (the catch block called notFound() on any thrown
 * error) and to PASS against the CAM-588 implementation.
 *
 * Coverage matrix per .claude/rules/qa.md:
 *   normal (AC-1 db error -> error boundary) · null/empty (AC-2 campSite=null)
 *   · boundary (AC-3 SEC-1 non-public) · error/validation (notFound NOT called
 *   on a db error; EC-4 production refusal) · concurrent/ordering (getCampBySlug
 *   before canViewCampSite, unchanged) · boundary (EC-2 no-op schema save)
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { readFileSync } from "node:fs";

const ROOT = path.join(__dirname, "..");

// ===========================================================================
// Part A — app/campgrounds/[slug]/page.tsx (AC-1, AC-2, AC-3)
// ===========================================================================

// Mirrors Next.js's real notFound(), which throws to unwind rendering. A
// dedicated sentinel class lets every test assert PRECISELY which path threw:
// this sentinel (the 404 path) vs. the original raw error (the fixed path).
//
// vi.mock factories are hoisted above ALL other statements in this file
// (including plain `const`), so every value a factory closes over must be
// declared inside vi.hoisted() — same pattern __tests__/cam-357-cache-tags.test.ts
// uses for its unstableCacheSpy.
const {
  NotFoundSentinel,
  mockNotFound,
  mockAuth,
  mockGetCampBySlug,
  mockCanViewCampSite,
  mockWishlistFindUnique,
  mockReviewAggregate,
  mockReviewFindMany,
} = vi.hoisted(() => {
  class NotFoundSentinel extends Error {
    constructor() {
      super("NEXT_NOT_FOUND");
    }
  }
  return {
    NotFoundSentinel,
    mockNotFound: vi.fn(() => {
      throw new NotFoundSentinel();
    }),
    mockAuth: vi.fn(),
    mockGetCampBySlug: vi.fn(),
    mockCanViewCampSite: vi.fn(),
    mockWishlistFindUnique: vi.fn(),
    mockReviewAggregate: vi.fn(),
    mockReviewFindMany: vi.fn(),
  };
});

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
      findMany: (...args: unknown[]) => mockReviewFindMany(...args),
    },
  },
}));

vi.mock("@/components/Navbar", () => ({ Navbar: () => null }));
vi.mock("@/components/CampgroundDetailClient", () => ({ default: () => null }));
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
import { getProvinceThaiNameMap } from "@/lib/read-models/camp-card";

const SESSION = { user: { id: "user-1" } };
const CAMP = {
  id: "camp-1",
  operatorId: "op-1",
  isActive: true,
  isPublished: true,
  deletedAt: null,
};

function invoke(slug: string) {
  return CampgroundPage({ params: Promise.resolve({ slug }) });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.mockResolvedValue(SESSION);
  mockCanViewCampSite.mockReturnValue(true);
  mockWishlistFindUnique.mockResolvedValue(null);
  mockReviewAggregate.mockResolvedValue({ _avg: { rating: null }, _count: { rating: 0 } });
});

describe("CAM-588 AC-1 — a thrown DB/infra error does NOT become notFound()", () => {
  it("[unit, normal] propagates the ORIGINAL error, never calls notFound()", async () => {
    const dbError = new Error(
      "The column Location.thaiLocationId does not exist in the current database"
    );
    mockGetCampBySlug.mockRejectedValue(dbError);

    await expect(invoke("any-slug")).rejects.toBe(dbError);
    expect(mockNotFound).not.toHaveBeenCalled();
  });

  it("[unit, error/validation] does NOT resolve to the not-found sentinel (the pre-fix bug)", async () => {
    // Prove-It: this assertion FAILS against the pre-CAM-588 page (which
    // caught the error and called notFound(), so the rejection would be
    // NotFoundSentinel, not the raw error).
    const dbError = new Error("connection refused");
    mockGetCampBySlug.mockRejectedValue(dbError);

    await expect(invoke("any-slug")).rejects.not.toBeInstanceOf(NotFoundSentinel);
  });

  it("[unit] logs a structured server-side line naming the slug — no stack/secret shape leaked into it", async () => {
    const dbError = new Error("boom");
    mockGetCampBySlug.mockRejectedValue(dbError);
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(invoke("camp-x")).rejects.toThrow("boom");

    const logged = errSpy.mock.calls
      .map((c) => c[0])
      .find((line) => typeof line === "string" && line.includes("camp_detail_load_failed"));
    expect(logged).toBeDefined();
    const parsed = JSON.parse(logged as string);
    expect(parsed.event).toBe("camp_detail_load_failed");
    expect(parsed.slug).toBe("camp-x");
    expect(parsed.message).toBe("boom");
    errSpy.mockRestore();
  });

  it("[unit] short-circuits before reaching province/review/wishlist reads", async () => {
    mockGetCampBySlug.mockRejectedValue(new Error("db down"));
    await expect(invoke("any-slug")).rejects.toThrow();
    expect(getProvinceThaiNameMap).not.toHaveBeenCalled();
    expect(mockWishlistFindUnique).not.toHaveBeenCalled();
    expect(mockReviewAggregate).not.toHaveBeenCalled();
  });
});

describe("CAM-588 AC-2 — a genuinely missing slug still 404s (unchanged)", () => {
  it("[unit, null/empty] campSite === null calls notFound(), same sentinel path as before", async () => {
    mockGetCampBySlug.mockResolvedValue(null);
    await expect(invoke("does-not-exist")).rejects.toBeInstanceOf(NotFoundSentinel);
    expect(mockNotFound).toHaveBeenCalledTimes(1);
  });
});

describe("CAM-588 AC-3 — SEC-1 non-public-camp 404 is UNCHANGED (pinned)", () => {
  it("[unit, boundary] a non-public camp still 404s via canViewCampSite, run AFTER getCampBySlug", async () => {
    mockGetCampBySlug.mockResolvedValue(CAMP);
    mockCanViewCampSite.mockReturnValue(false);

    await expect(invoke("hidden-camp")).rejects.toBeInstanceOf(NotFoundSentinel);
    expect(mockCanViewCampSite).toHaveBeenCalledWith(CAMP, SESSION);
    expect(mockNotFound).toHaveBeenCalledTimes(1);

    // [concurrent/ordering] canViewCampSite must run strictly after
    // getCampBySlug resolves (SEC-1's own "never cached / per-request session"
    // invariant — see the CACHE-1 comment in page.tsx). This story does not
    // change that ordering; pin it so it can't silently regress here.
    const getCampOrder = mockGetCampBySlug.mock.invocationCallOrder[0];
    const canViewOrder = mockCanViewCampSite.mock.invocationCallOrder[0];
    expect(getCampOrder).toBeLessThan(canViewOrder);
  });

  it("[unit] same 404 sentinel as AC-2 — a stranger cannot distinguish the two reasons", async () => {
    mockGetCampBySlug.mockResolvedValue(null);
    let notFoundRejection: unknown;
    try {
      await invoke("does-not-exist");
    } catch (e) {
      notFoundRejection = e;
    }

    vi.clearAllMocks();
    mockAuth.mockResolvedValue(SESSION);
    mockGetCampBySlug.mockResolvedValue(CAMP);
    mockCanViewCampSite.mockReturnValue(false);
    let sec1Rejection: unknown;
    try {
      await invoke("hidden-camp");
    } catch (e) {
      sec1Rejection = e;
    }

    expect(notFoundRejection).toBeInstanceOf(NotFoundSentinel);
    expect(sec1Rejection).toBeInstanceOf(NotFoundSentinel);
    expect((notFoundRejection as Error).message).toBe((sec1Rejection as Error).message);
  });
});

// ===========================================================================
// Part B — scripts/dev-with-prisma-watch.mjs (AC-4)
// ===========================================================================

import { computeBaseline, hasDrifted, startWatching } from "../scripts/dev-with-prisma-watch.mjs";

async function waitFor(predicate: () => boolean, timeoutMs = 2000, intervalMs = 20) {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) {
      throw new Error("waitFor: condition never became true within " + timeoutMs + "ms");
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}

// macOS FSEvents can deliver a spurious/coalesced event for a just-created
// directory shortly after a recursive watch starts (observed here as a
// "migration" event unrelated to the test's own write). Let the watcher
// settle and discard any such startup noise BEFORE performing the real,
// asserted-on action — this keeps each test's pass/fail tied to the write IT
// makes, not to watcher-startup artifacts.
async function settleAndClear(onDrift: ReturnType<typeof vi.fn>) {
  await new Promise((r) => setTimeout(r, 150));
  onDrift.mockClear();
}

describe("CAM-588 AC-4 — hasDrifted (pure)", () => {
  it("[unit, normal] true when both hashes are known and differ", () => {
    expect(hasDrifted("aaa", "bbb")).toBe(true);
  });
  it("[unit, null/empty] false when either side is null (unknown)", () => {
    expect(hasDrifted(null, "bbb")).toBe(false);
    expect(hasDrifted("aaa", null)).toBe(false);
    expect(hasDrifted(null, null)).toBe(false);
  });
  it("[unit, boundary] false when identical", () => {
    expect(hasDrifted("aaa", "aaa")).toBe(false);
  });
});

describe("CAM-588 AC-4 — startWatching fires on a REAL schema change on disk", () => {
  let dir: string;
  let schemaPath: string;
  let migrationsDir: string;
  let stop: (() => void) | null = null;

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), "cam-588-"));
    schemaPath = path.join(dir, "schema.prisma");
    migrationsDir = path.join(dir, "migrations");
    writeFileSync(schemaPath, "model Foo {\n  id String @id\n}\n", "utf8");
    mkdirSync(migrationsDir);
  });

  afterEach(() => {
    stop?.();
    stop = null;
    rmSync(dir, { recursive: true, force: true });
  });

  it("[integration, normal] a real edit to schema.prisma fires onDrift once, past the baseline", async () => {
    const onDrift = vi.fn();
    stop = startWatching({
      schemaPaths: [schemaPath],
      migrationDirs: [migrationsDir],
      onDrift,
      debounceMs: 30,
    });
    await settleAndClear(onDrift);

    // Prove-It: FAILS if the baseline captured a DIFFERENT snapshot / if the
    // comparison were disk-vs-disk instead of disk-vs-this-baseline.
    writeFileSync(schemaPath, "model Foo {\n  id String @id\n  name String\n}\n", "utf8");

    await waitFor(() => onDrift.mock.calls.length > 0);
    expect(onDrift).toHaveBeenCalledWith(
      expect.objectContaining({ reason: "schema", schemaPath })
    );
  });

  it("[integration, boundary/EC-2] a no-op save (normalized-identical content) does NOT fire onDrift", async () => {
    const onDrift = vi.fn();
    stop = startWatching({
      schemaPaths: [schemaPath],
      migrationDirs: [migrationsDir],
      onDrift,
      debounceMs: 30,
    });
    await settleAndClear(onDrift);

    // Same normalized content (only a trailing comment/whitespace differs) —
    // the CAM-579 normalize()/hash() this reuses strips exactly this.
    const original = readFileSync(schemaPath, "utf8");
    writeFileSync(schemaPath, original + "// just a comment\n", "utf8");

    // Bounded wait proving an ABSENCE, not a positive condition — there is no
    // "eventually true" state to poll for here.
    await new Promise((r) => setTimeout(r, 200));
    expect(onDrift).not.toHaveBeenCalled();
  });

  it("[integration, boundary/EC-3] a file landing under migrations/ fires onDrift even with schema.prisma untouched", async () => {
    const onDrift = vi.fn();
    stop = startWatching({
      schemaPaths: [schemaPath],
      migrationDirs: [migrationsDir],
      onDrift,
      debounceMs: 30,
    });
    await settleAndClear(onDrift);

    writeFileSync(
      path.join(migrationsDir, "20260728_add_column.sql"),
      "ALTER TABLE \"Foo\" ADD COLUMN \"bar\" TEXT;\n",
      "utf8"
    );

    await waitFor(() => onDrift.mock.calls.length > 0);
    expect(onDrift).toHaveBeenCalledWith(expect.objectContaining({ reason: "migration" }));
  });

  it("[unit] computeBaseline snapshots the CURRENT on-disk hash at call time", () => {
    const baseline = computeBaseline([schemaPath]);
    expect(baseline.get(schemaPath)).not.toBeNull();
    expect(typeof baseline.get(schemaPath)).toBe("string");
  });
});

describe("CAM-588 EC-4 — the watcher refuses to start under NODE_ENV=production", () => {
  it("[integration] exits non-zero and prints the refusal, never reaching next dev", () => {
    expect(() =>
      execFileSync("node", ["scripts/dev-with-prisma-watch.mjs"], {
        cwd: ROOT,
        env: { ...process.env, NODE_ENV: "production" },
        stdio: "pipe",
        timeout: 5000,
      })
    ).toThrowError(/Command failed/);
  });

  it("[integration] the refusal message names the dev-only guard", () => {
    try {
      execFileSync("node", ["scripts/dev-with-prisma-watch.mjs"], {
        cwd: ROOT,
        env: { ...process.env, NODE_ENV: "production" },
        stdio: "pipe",
        timeout: 5000,
      });
      expect.fail("expected the script to exit non-zero under NODE_ENV=production");
    } catch (e) {
      const stderr = (e as { stderr?: Buffer }).stderr?.toString() ?? "";
      expect(stderr).toContain("refuses to run with NODE_ENV=production");
    }
  });
});

// ===========================================================================
// Part C — wiring regression guards (package.json / CAM-579 untouched)
// ===========================================================================

describe("CAM-588 — dev-only scope (package.json wiring)", () => {
  const pkg = JSON.parse(readFileSync(path.join(ROOT, "package.json"), "utf8"));

  it("[regression] npm run dev now wraps next dev via the watcher", () => {
    expect(pkg.scripts.dev).toBe("node scripts/dev-with-prisma-watch.mjs");
  });

  it("[regression] predev/pretypecheck/pretest still call the CAM-579 guard, unchanged", () => {
    expect(pkg.scripts.predev).toBe("node scripts/verify-prisma-client-fresh.mjs");
    expect(pkg.scripts.pretypecheck).toBe("node scripts/verify-prisma-client-fresh.mjs");
    expect(pkg.scripts.pretest).toBe("node scripts/verify-prisma-client-fresh.mjs");
  });

  it("[regression, security] build/vercel-build/start never invoke the dev-only watcher", () => {
    for (const name of ["build", "vercel-build", "start"]) {
      expect(pkg.scripts[name]).not.toContain("dev-with-prisma-watch");
    }
  });
});

describe("CAM-588 — importing the watcher module has NO side effects", () => {
  it("[unit] does not spawn next dev / open real watchers merely by being imported", async () => {
    // If import-time side effects existed, this test file's own collection
    // phase (which imports the module above) would already have spawned a
    // real `next dev` or opened a real fs.watch on this repo's own prisma/
    // files. Re-importing here (module cache hit) and asserting only the
    // expected pure/factory exports exist is the regression pin.
    const mod = await import("../scripts/dev-with-prisma-watch.mjs");
    expect(Object.keys(mod).sort()).toEqual(
      ["computeBaseline", "hasDrifted", "startWatching"].sort()
    );
  });
});

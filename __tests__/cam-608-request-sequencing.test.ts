// @vitest-environment jsdom
/**
 * cam-608-request-sequencing.test.ts — CAM-608
 *
 * The availability route (`app/dashboard/campsites/[id]/availability/**`)
 * runs THREE independent async loads (page.tsx's loadData, the calendar's
 * loadMonth, the holds section's loadHolds) and none of them carried the
 * CAM-359 monotonic-requestId guard — so a slow response issued FIRST could
 * land LAST and silently overwrite fresher data (month-nav, spot toggle,
 * save can each re-issue a load while an earlier one is still in flight).
 *
 * Scope (per the ticket): reuse CAM-359's exact mechanism, not re-derive it
 * per surface — extracted here as `lib/hooks/use-request-sequence.ts`
 * (`.claude/rules/api.md`'s CAM-341/360 lesson: a fix re-derived per surface
 * is how the SAME bug class ships twice).
 *
 * Part 1 — behavioral Prove-It on the REAL hook (via `renderHook`, real
 * `useRef`/`useCallback`, not a source mirror): constructs the crossing
 * deliberately (a slow call issued first, a fast call issued second) and
 * asserts the slow response does NOT win — then documents the identical
 * race WITHOUT the guard actually losing the fresher data, proving the
 * scenario is a real race and not a tautology of the fixture.
 *
 * Part 2 — structural: every one of the three call sites imports the SAME
 * shared hook and applies its guard at the right points (no re-derived,
 * per-component `useRef(0)` counter reintroduced alongside it).
 *
 * Teeth proof (manual, not left as a toggle in the suite — same practice as
 * CAM-604's tech.md): with `isCurrent`'s check temporarily removed from
 * `useRequestSequence` (`ref.current === requestId` replaced with `true`),
 * the Part-1 "constructed crossing" test below went RED (the stale call won
 * with `["stale"]` instead of `["fresh"]`); restoring the real check turned
 * it GREEN again. Recorded in
 * docs/specs/platform-hardening/taxonomy-ui-foundation/CAM-608-availability-request-sequencing/design.md.
 */

import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import * as fs from "fs";
import * as path from "path";
import { useRequestSequence } from "@/lib/hooks/use-request-sequence";

const root = path.resolve(__dirname, "..");
const src = (rel: string) => fs.readFileSync(path.join(root, rel), "utf-8");

const pageSrc = src("app/dashboard/campsites/[id]/availability/page.tsx");
const calendarSrc = src("components/availability-calendar.tsx");
const holdsSrc = src("components/host-holds-section.tsx");

describe("CAM-608 — useRequestSequence: constructing the crossing deliberately", () => {
  it("[unit] a later-issued (fast) call is not overwritten by an earlier-issued (slow) call that resolves last", async () => {
    const { result } = renderHook(() => useRequestSequence());
    let committed: string[] | null = null;

    // A manually-resolvable promise lets the test control resolution ORDER
    // independently of issue order — exactly the race the guard closes.
    let resolveSlow!: (data: string[]) => void;
    const slowResponse = new Promise<string[]>((resolve) => {
      resolveSlow = resolve;
    });

    // Call #1 — issued FIRST (e.g. the mount effect / the month the host
    // navigated away from) but its response resolves LAST.
    const slowId = result.current.next();
    const slowCall = slowResponse.then((data) => {
      if (result.current.isCurrent(slowId)) committed = data;
    });

    // Call #2 — issued SECOND (e.g. a month-nav click / a post-mutation
    // refetch) and resolves immediately with the fresher data.
    const fastId = result.current.next();
    await Promise.resolve(["fresh"]).then((data) => {
      if (result.current.isCurrent(fastId)) committed = data;
    });
    expect(committed).toEqual(["fresh"]);

    // The stale call now finally resolves with the OLDER data — it must be
    // ignored, not overwrite the fresher committed state.
    await act(async () => {
      resolveSlow(["stale"]);
      await slowCall;
    });

    expect(committed).toEqual(["fresh"]);
  });

  it("[unit] Prove-It: the identical race WITHOUT any guard loses the fresher data (documents the real bug this hook prevents)", async () => {
    // No requestId check at all — the exact shape every one of the three
    // call sites had before this fix. Proves the race in the test above is
    // real, not a tautology of the fixture.
    let committed: string[] | null = null;
    let resolveSlow!: (data: string[]) => void;
    const slowResponse = new Promise<string[]>((resolve) => {
      resolveSlow = resolve;
    });

    const slowCall = slowResponse.then((data) => {
      committed = data; // no guard — last resolve always wins
    });
    await Promise.resolve(["fresh"]).then((data) => {
      committed = data;
    });
    expect(committed).toEqual(["fresh"]);

    resolveSlow(["stale"]);
    await slowCall;

    // Bug reproduced: the stale, earlier-issued call overwrote the fresher
    // one — this is the "data disappears and never comes back" race CAM-359
    // named.
    expect(committed).toEqual(["stale"]);
  });

  it("[unit] next() is monotonic across many issued calls, and isCurrent() is true only for the most recent one", () => {
    const { result } = renderHook(() => useRequestSequence());
    const ids = [result.current.next(), result.current.next(), result.current.next()];
    expect(ids).toEqual([1, 2, 3]);
    expect(result.current.isCurrent(1)).toBe(false);
    expect(result.current.isCurrent(2)).toBe(false);
    expect(result.current.isCurrent(3)).toBe(true);
  });
});

describe("CAM-608 — lib/hooks/use-request-sequence.ts exports the shared CAM-359 mechanism", () => {
  const hookSrc = src("lib/hooks/use-request-sequence.ts");

  it('has "use client" (a hook using useRef/useCallback is client-only)', () => {
    expect(hookSrc.trimStart().startsWith('"use client"')).toBe(true);
  });

  it("exports useRequestSequence as a named export returning { next, isCurrent }", () => {
    expect(hookSrc).toContain("export function useRequestSequence()");
    expect(hookSrc).toContain("return { next, isCurrent };");
  });

  it("next() increments a useRef counter and isCurrent() compares against it (the exact CAM-359 mechanism, not a re-derived one)", () => {
    expect(hookSrc).toContain("const ref = useRef(0)");
    expect(hookSrc).toContain("++ref.current");
    expect(hookSrc).toContain("ref.current === requestId");
  });
});

describe("CAM-608 — every concurrent async load on the availability route applies the SAME shared guard (no re-derived, per-surface mechanism)", () => {
  it("page.tsx's loadData uses useRequestSequence and guards its state commit", () => {
    expect(pageSrc).toContain('import { useRequestSequence } from "@/lib/hooks/use-request-sequence"');
    expect(pageSrc).toContain("const { next, isCurrent } = useRequestSequence();");
    expect(pageSrc).toContain("const requestId = next();");
    expect(pageSrc).toContain("if (!isCurrent(requestId)) return;");
  });

  it("availability-calendar.tsx's loadMonth uses useRequestSequence and guards its state commit", () => {
    expect(calendarSrc).toContain('import { useRequestSequence } from "@/lib/hooks/use-request-sequence"');
    expect(calendarSrc).toContain("const { next, isCurrent } = useRequestSequence();");
    expect(calendarSrc).toContain("const requestId = next();");
    expect(calendarSrc).toContain("if (!isCurrent(requestId)) return;");
  });

  it("host-holds-section.tsx's loadHolds uses useRequestSequence and guards its state commit", () => {
    expect(holdsSrc).toContain('import { useRequestSequence } from "@/lib/hooks/use-request-sequence"');
    expect(holdsSrc).toContain("const { next, isCurrent } = useRequestSequence();");
    expect(holdsSrc).toContain("const requestId = next();");
    expect(holdsSrc).toContain("if (!isCurrent(requestId)) return;");
  });

  it("no call site reintroduces a second, re-derived requestId mechanism (a private useRef(0) counter) alongside the shared hook", () => {
    for (const componentSrc of [pageSrc, calendarSrc, holdsSrc]) {
      expect(componentSrc).not.toContain("requestIdRef");
    }
  });

  it("CAM-604's hydration fix on the calendar (suppressHydrationWarning, scoped) is left intact", () => {
    expect(calendarSrc).toContain("suppressHydrationWarning");
    expect(calendarSrc).toContain("const today = useMemo(() => new Date(), []);");
  });
});

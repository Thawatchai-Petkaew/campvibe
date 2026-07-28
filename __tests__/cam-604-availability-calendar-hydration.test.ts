// @vitest-environment jsdom
/**
 * cam-604-availability-calendar-hydration.test.ts — CAM-604
 *
 * Scoped to jsdom via the top-of-file pragma ONLY for this file (repo
 * default vitest environment stays `node`, see vitest.config.ts) — same
 * pattern as __tests__/cam-496-filter-modal-hydration.test.ts.
 *
 * Prove-It (`.claude/rules/qa.md`): the real React 19 hydration warning was
 * read directly (not guessed) via a throwaway `renderToString` +
 * `hydrateRoot` repro before this fix landed — the exact console.error text
 * React emits (verbatim, react-dom 19.2.3):
 *
 *   "A tree hydrated but some attributes of the server rendered HTML didn't
 *    match the client properties. This won't be patched up. This can happen
 *    if a SSR-ed Client Component used:
 *    - A server/client branch `if (typeof window !== 'undefined')`.
 *    - Variable input such as `Date.now()` or `Math.random()` which changes
 *      each time it's called.
 *    - Date formatting in a user's locale which doesn't match the server.
 *    ..."
 *
 * Root cause named: components/availability-calendar.tsx computed `today`
 * via `useMemo(() => new Date(), [])` and seeded `month` via
 * `useState(() => startOfMonth(new Date()))` — both evaluate `new Date()`
 * once during the SERVER render and once again during the CLIENT's first
 * (hydrating) render. The two calls can disagree the instant a day/month
 * boundary falls between them (exactly the kind of gap CAM-603's sustained
 * CPU-pressure fault injection widens). The DIVERGENCE is exactly React's
 * own documented "Variable input such as Date.now()" hydration-mismatch
 * class — read here directly, not guessed.
 *
 * Fix (this story): NOT removed at the value level (today/month legitimately
 * must reflect "now" — this is the sanctioned "live clock" case React's own
 * docs use `suppressHydrationWarning` for, https://react.dev/reference/react-dom/client/hydrateRoot#handling-different-client-and-server-content).
 * `suppressHydrationWarning` is added, scoped to exactly the elements whose
 * rendered output reads `today`/`month` (the month-label `<span>`, the two
 * nav `<Button>`s' `disabled` attribute, and each day-cell's className/text)
 * — nothing broader.
 *
 * This test:
 *  AC-1 [documents the bug, unguarded] — an isolated, minimal component
 *       mirroring the EXACT pre-fix pattern (a className driven by a
 *       `useMemo(() => new Date(), [])`-style value, no suppression) DOES
 *       emit the hydration-mismatch console.error when the server and
 *       client render passes disagree on "today". This is the failing-first
 *       repro of the mechanism.
 *  AC-2 [the real fix, real file] — importing the ACTUAL
 *       `AvailabilityCalendar` from components/availability-calendar.tsx and
 *       hydrating it across the same day-boundary crossing emits ZERO
 *       hydration-mismatch console errors — the shipped fix.
 *  AC-3 [renders once] — after hydration, `getByTestId` finds exactly ONE
 *       calendar section in the container (no duplicate subtree left behind).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as React from "react";
import { renderToString } from "react-dom/server";
import { createRoot, hydrateRoot } from "react-dom/client";
import { act } from "react";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { AvailabilityCalendar } from "@/components/availability-calendar";

const HYDRATION_WARNING_PATTERN = /didn't match the client properties|Date\.now\(\)|Hydration failed/i;

function captureConsoleErrors() {
  const captured: string[] = [];
  const original = console.error;
  console.error = (...args: unknown[]) => {
    captured.push(args.map(String).join(" "));
  };
  return {
    captured,
    restore: () => {
      console.error = original;
    },
  };
}

/** Mirrors the EXACT pre-fix pattern: a className driven by a value read
 * from `new Date()` at render time, with no suppressHydrationWarning. */
function UnsafeTodayCell({ dayOfMonth }: { dayOfMonth: number }) {
  const today = React.useMemo(() => new Date(), []);
  const isToday = today.getDate() === dayOfMonth;
  return React.createElement(
    "div",
    { "data-testid": "cell", className: isToday ? "ring-1 ring-primary/40" : "bg-background" },
    "x"
  );
}

describe("CAM-604 AC-1 — unguarded `new Date()`-in-render reproduces the real hydration warning (failing-first)", () => {
  it("emits React's exact hydration-mismatch console.error when the server/client render passes disagree on 'today'", async () => {
    // Fake ONLY `Date` (not timers/setTimeout) — React's own internal
    // scheduling still runs on REAL timers so the warning actually fires.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 6, 28, 23, 59, 59, 900)); // server render: local July 28, 23:59:59.9
    const html = renderToString(React.createElement(UnsafeTodayCell, { dayOfMonth: 28 }));

    const container = document.createElement("div");
    container.innerHTML = html;
    document.body.appendChild(container);

    vi.setSystemTime(new Date(2026, 6, 29, 0, 0, 0, 100)); // client hydrate: local July 29, 00:00:00.1 (crossed midnight)

    const { captured, restore } = captureConsoleErrors();
    await act(async () => {
      hydrateRoot(container, React.createElement(UnsafeTodayCell, { dayOfMonth: 28 }));
    });
    restore();
    vi.useRealTimers();

    const joined = captured.join("\n");
    expect(joined).toMatch(HYDRATION_WARNING_PATTERN);
  });
});

describe("CAM-604 AC-2/AC-3 — the real AvailabilityCalendar, fixed, hydrates cleanly across a day boundary", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = vi.fn(
      async () =>
        new Response(JSON.stringify({ availability: [] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        })
    ) as unknown as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.useRealTimers();
  });

  it("[AC-2] no hydration-mismatch console error fires when server-render and client-hydrate straddle midnight", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 6, 28, 23, 59, 59, 900));
    const html = renderToString(
      React.createElement(
        LanguageProvider,
        null,
        React.createElement(AvailabilityCalendar, { campSiteId: "test-camp-1" })
      )
    );

    const container = document.createElement("div");
    container.innerHTML = html;
    document.body.appendChild(container);

    vi.setSystemTime(new Date(2026, 6, 29, 0, 0, 0, 100));

    const { captured, restore } = captureConsoleErrors();
    await act(async () => {
      hydrateRoot(
        container,
        React.createElement(
          LanguageProvider,
          null,
          React.createElement(AvailabilityCalendar, { campSiteId: "test-camp-1" })
        )
      );
    });
    restore();

    const joined = captured.join("\n");
    expect(joined).not.toMatch(HYDRATION_WARNING_PATTERN);
  });

  it("[AC-3] renders exactly one calendar section after hydration (no leftover duplicate subtree)", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 6, 28, 23, 59, 59, 900));
    const html = renderToString(
      React.createElement(
        LanguageProvider,
        null,
        React.createElement(AvailabilityCalendar, { campSiteId: "test-camp-1" })
      )
    );

    const container = document.createElement("div");
    container.innerHTML = html;
    document.body.appendChild(container);

    vi.setSystemTime(new Date(2026, 6, 29, 0, 0, 0, 100));

    await act(async () => {
      hydrateRoot(
        container,
        React.createElement(
          LanguageProvider,
          null,
          React.createElement(AvailabilityCalendar, { campSiteId: "test-camp-1" })
        )
      );
    });

    const sections = container.querySelectorAll('[data-testid="section--availability-calendar"]');
    expect(sections.length).toBe(1);
  });
});

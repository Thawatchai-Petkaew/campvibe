/**
 * cam-688-ssr-no-storage-read.test.ts — CAM-688
 *
 * tech.md rejected the ticket's own proposed fix (a lazy `useState`
 * initializer reading `localStorage`) because under App Router the provider
 * is SSR'd: the server has no `localStorage`, so a lazy initializer that
 * reads it would run fine on the client but throw (or silently diverge) on
 * the server, and the two renders would disagree — a real React 19
 * hydration mismatch. tech.md's own correction: no existing test guarded
 * this claim (`cam-604-availability-calendar-hydration.test.ts` opts into a
 * simulated DOM via its own top-of-file environment pragma, so its
 * `renderToString` and `hydrateRoot` passes share ONE simulated global/
 * localStorage and can never observe a real server/client divergence).
 *
 * This file deliberately carries NO environment pragma of its own — it
 * runs under the repo's default `environment: 'node'` (vitest.config.ts),
 * where `document`/`localStorage` do not exist as globals at all. If
 * LanguageProvider's SYNCHRONOUS render path (as opposed to its
 * `useEffect`, which react-dom/server never executes) touched either, this
 * throws a real `ReferenceError` — not a simulated one.
 *
 * NOTE for future edits: do not write the literal environment-pragma
 * comment token anywhere else in this file, even in prose -- Vitest's
 * per-file pragma scanner matches it wherever it appears in the source, not
 * only as a real top-of-file directive, and would silently flip this file
 * onto a simulated DOM, defeating the entire guard (verified live: this
 * file failed with `document`/`localStorage` reported as `"object"`, not
 * `"undefined"`, the one time that token was mentioned in this docblock).
 *
 * Prove-It (`.claude/rules/qa.md`): verified live that this test fails
 * (`ReferenceError: localStorage is not defined`) when LanguageProvider is
 * reverted to a lazy initializer reading `localStorage.getItem(...)` in
 * `useState(() => ...)` — the exact rejected shape — then passes again on
 * the shipped fix. This is the guard tech.md's Decisions block asked for.
 */
import { describe, it, expect } from "vitest";
import * as React from "react";
import { renderToString } from "react-dom/server";
import { LanguageProvider, useLanguage, type Language } from "@/contexts/LanguageContext";

function PriceProbe() {
  const { formatCurrency } = useLanguage();
  return React.createElement("span", { "data-testid": "price" }, formatCurrency(750));
}

// React.createElement's typed overloads don't reconcile a props object plus
// a separate rest-arg `children` against a component whose Props declares
// `children: ReactNode` as required (only JSX's compile-time transform does
// that folding, which a plain .test.ts file -- no JSX -- doesn't get). Build
// the full, correctly-typed props object via a typed local (never a `{
// children: ... }` object literal passed straight into createElement --
// that's react/no-children-prop) so every call site below stays fully typed
// with no `as any`.
function renderProvider(initialLanguage: Language | undefined, children: React.ReactNode) {
  const props: React.ComponentProps<typeof LanguageProvider> = { initialLanguage, children };
  return React.createElement(LanguageProvider, props);
}

describe("CAM-688 — this test's own environment has no browser storage (sanity)", () => {
  it("[environment] `document` and `localStorage` are undefined (node, not jsdom)", () => {
    expect(typeof document).toBe("undefined");
    expect(typeof localStorage).toBe("undefined");
  });
});

describe("CAM-688 — LanguageProvider never reads browser storage on its synchronous (server) render path", () => {
  it("[behavioral] renderToString succeeds with a server-resolved initialLanguage='th'", () => {
    expect(() =>
      renderToString(renderProvider("th", React.createElement("div", null, "x")))
    ).not.toThrow();
  });

  it("[behavioral] renderToString succeeds with initialLanguage omitted (mirrors the 9 existing test files that mount the provider bare)", () => {
    expect(() =>
      renderToString(renderProvider(undefined, React.createElement("div", null, "x")))
    ).not.toThrow();
  });

  it("[behavioral] AC-1 -- server-rendered markup shows baht (not a dollar flash) immediately, with initialLanguage='th' and no browser storage available at all", () => {
    const html = renderToString(renderProvider("th", React.createElement(PriceProbe)));
    expect(html).toContain("฿");
    expect(html).not.toContain("$");
  });

  it("[behavioral] AC-2 -- server-rendered markup defaults to dollars when initialLanguage is omitted (never-set preference)", () => {
    const html = renderToString(renderProvider(undefined, React.createElement(PriceProbe)));
    expect(html).toContain("$");
    expect(html).not.toContain("฿");
  });
});

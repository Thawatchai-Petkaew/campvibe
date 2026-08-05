// @vitest-environment jsdom
/**
 * CAM-674 — the hero-gallery "Show all photos" `<Button>` used to sit INSIDE
 * the image cell's own `<button>` (components/CampgroundDetailClient.tsx,
 * ~line 1115-1140, since bb6d5d4/CAM-194). HTML forbids `<button>` inside
 * `<button>`, so the browser's HTML parser silently re-parents the inner one
 * as a SIBLING when it parses the server-rendered string — the client tree
 * React expects (still nested, per the JSX) no longer matches what actually
 * got parsed, so React discards the server HTML and re-renders the whole
 * subtree on the client (a structural hydration failure, not a soft
 * attribute-mismatch warning — see the mechanism note below).
 *
 * Prove-It (`.claude/rules/qa.md`): both real react-dom 19 signals were read
 * directly (not guessed) via a throwaway `renderToString` + `hydrateRoot`
 * repro before writing this test:
 *   1. a `console.error` naming the exact violation: "In HTML, %s cannot be
 *      a descendant of <%s>. This will cause a hydration error."
 *   2. a SEPARATE uncaught `Error: Hydration failed because the server
 *      rendered HTML didn't match the client...` — react-dom schedules this
 *      recoverable-error report on its own internal scheduler, so (unlike
 *      CAM-604's softer attribute-mismatch case) it does NOT surface through
 *      the `act()` promise or a plain try/catch; a temporary
 *      `process.on("uncaughtException", ...)` listener is required to
 *      observe it without leaving an unhandled exception for Vitest to
 *      report (which would otherwise poison `npx vitest run`'s exit code
 *      even though the individual test "passes" — verified empirically).
 *
 * Scope note: this file proves the MECHANISM with a minimal, isolated mirror
 * of the before/after DOM shape — not the real, heavy `CampgroundDetailClient`
 * (dozens of hooks/providers: LanguageProvider, next-themes, next-auth
 * session, a streamed reviews Suspense boundary — well outside this story's
 * ~45-line file surface and not self-contained the way CAM-604's
 * `AvailabilityCalendar` was). The real page, in a real Chromium browser
 * (the only place the browser's HTML-parser re-parenting is actually
 * observable — a source-inspection test cannot see it), is proven by
 * e2e/regression/cam-674-hero-gallery-hydration.spec.ts.
 *
 * AC-1 [documents the bug, unguarded] — the exact pre-fix shape (a `<button>`
 *      wrapping another `<button>`) reproduces BOTH real react-dom signals
 *      above when hydrated across a fresh server-render → client-hydrate
 *      pass. Failing-first repro of the mechanism this story fixes.
 * AC-2 [the shipped fix, same structural shape as CampgroundDetailClient] —
 *      a `<div role="button" tabIndex={0}>` (image cell) with a SIBLING
 *      `<button>` ("Show all photos") hydrates with ZERO hydration-mismatch
 *      signals, and the resulting DOM has zero `button button` matches —
 *      the same assertion the ticket's `done_when` runs against the real
 *      page.
 */
import { describe, expect, it } from "vitest";
import * as React from "react";
import { renderToString } from "react-dom/server";
import { hydrateRoot } from "react-dom/client";
import { act } from "react";

const HYDRATION_SIGNAL_PATTERN = /cannot be a descendant of|hydration failed|hydration error/i;

/** Mirrors the EXACT pre-fix shape: an outer `<button>` (the image cell)
 * wrapping an inner `<button>` (the "Show all photos" control). */
function PreFixNestedButtons() {
  return React.createElement(
    "button",
    { type: "button", "aria-label": "View photo 5" },
    React.createElement("span", null, "image"),
    React.createElement(
      "button",
      { type: "button", onClick: (e: React.MouseEvent) => e.stopPropagation() },
      "Show all photos"
    )
  );
}

/** Mirrors the SHIPPED fix shape (this story): a `<div role="button">`
 * image cell with keyboard activation, and the "Show all photos" control as
 * a SIBLING, not a descendant. */
function FixedSiblingButtons() {
  return React.createElement(
    "div",
    { className: "relative" },
    React.createElement(
      "div",
      {
        role: "button",
        tabIndex: 0,
        "aria-label": "View photo 5",
        onClick: () => {},
        onKeyDown: () => {},
      },
      React.createElement("span", null, "image")
    ),
    React.createElement("button", { type: "button", onClick: () => {} }, "Show all photos")
  );
}

/** Hydrates `Component` (server-rendered then client-hydrated) and returns
 * every hydration-mismatch signal observed — console.error text AND the
 * separate uncaught structural-mismatch exception react-dom schedules on
 * its own internal scheduler (escapes both the `act()` promise and a plain
 * try/catch around it — see the file header note). */
async function hydrateAndCollectSignals(Component: React.ComponentType): Promise<string[]> {
  const html = renderToString(React.createElement(Component));
  const container = document.createElement("div");
  container.innerHTML = html;
  document.body.appendChild(container);

  const signals: string[] = [];
  const originalConsoleError = console.error;
  console.error = (...args: unknown[]) => {
    signals.push(args.map(String).join(" "));
  };
  const onUncaught = (err: unknown) => {
    signals.push(String(err));
  };
  process.on("uncaughtException", onUncaught);

  try {
    await act(async () => {
      hydrateRoot(container, React.createElement(Component));
    });
  } catch (err) {
    signals.push(String(err));
  }
  // React schedules the structural-mismatch report on its own internal
  // scheduler, outside the act() flush — give it one tick to land before
  // detaching the listener, or it would surface as an unhandled exception
  // AFTER this test returns (poisoning `npx vitest run`'s exit code even
  // though this test itself reports green — verified empirically).
  await new Promise((resolve) => setTimeout(resolve, 50));

  process.off("uncaughtException", onUncaught);
  console.error = originalConsoleError;
  container.remove();

  return signals;
}

describe("CAM-674 AC-1 — the pre-fix button-in-button shape reproduces a real hydration failure (failing-first)", () => {
  it("emits a hydration-mismatch signal when hydrated", async () => {
    const signals = await hydrateAndCollectSignals(PreFixNestedButtons);
    const joined = signals.join("\n");
    expect(joined).toMatch(HYDRATION_SIGNAL_PATTERN);
  });
});

describe("CAM-674 AC-2 — the shipped fix (div role=button + sibling button) hydrates clean", () => {
  it("emits zero hydration-mismatch signals", async () => {
    const signals = await hydrateAndCollectSignals(FixedSiblingButtons);
    expect(signals, `unexpected signal(s): ${signals.join("\n")}`).toEqual([]);
  });

  it("the hydrated DOM has zero <button> nested inside <button>", async () => {
    const html = renderToString(React.createElement(FixedSiblingButtons));
    const container = document.createElement("div");
    container.innerHTML = html;
    document.body.appendChild(container);

    await act(async () => {
      hydrateRoot(container, React.createElement(FixedSiblingButtons));
    });

    expect(container.querySelectorAll("button button").length).toBe(0);
    container.remove();
  });
});

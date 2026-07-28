/**
 * CAM-604 — the host availability screen must render exactly once: no
 * duplicate `btn--availability-add` and no hydration-mismatch console error
 * on a cold navigation.
 *
 * Scope note (see docs/specs/platform-hardening/taxonomy-ui-foundation/
 * CAM-604-availability-hydration-mismatch/tech.md for the full
 * investigation): this story's OWN in-surface fix
 * (components/availability-calendar.tsx — the `today`/`month` render-time
 * `new Date()` divergence) is proven by the deterministic Vitest Prove-It
 * (__tests__/cam-604-availability-calendar-hydration.test.ts, real
 * `renderToString`+`hydrateRoot`, no timing luck). This spec is the
 * NORMAL-CONDITIONS regression guard on the real route: it intentionally
 * does NOT apply CAM-603-style deliberate CPU-pressure fault injection,
 * because the SEPARATE, dominant defect found under that fault injection
 * (a duplicate DOM node inside a leftover React-Flight streaming container,
 * `<div id="S:1">`, caused by the app's CSP blocking Next.js's own inline
 * segment-relocation script) lives in shared middleware (`proxy.ts`) outside
 * this story's file surface and is reported, not fixed, here — a
 * fault-injected version of this assertion would flake in ordinary CI load
 * on a bug this PR cannot fix, which is the exact flaky-test trap
 * `.claude/rules/qa.md` warns against. Under NORMAL load this assertion is
 * stable and still has teeth: it fails if a future in-surface change
 * reintroduces a render-time divergence large enough to surface without
 * fault injection.
 */
import { test, expect } from "@playwright/test";
import { findCampBySlug } from "./helpers";

const SEED_SLUG = "khao-kho-mountain-camp-6";

const HYDRATION_WARNING_PATTERN = /hydration|didn't match the client/i;

test("availability page renders the Add button exactly once, with no hydration-mismatch console error, on a cold navigation", async ({
  page,
  request,
}) => {
  const camp = await findCampBySlug(request, SEED_SLUG);

  const consoleErrors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => consoleErrors.push(err.message));

  await page.goto(`/dashboard/campsites/${camp.id}/availability`, { waitUntil: "networkidle" });

  // AC-3 (route renders once) — the exact trap this ticket names: a test that
  // only asserts the page renders would pass on broken behaviour. Assert the
  // COUNT explicitly, not just visibility of one match.
  await expect(page.getByTestId("btn--availability-add")).toHaveCount(1);
  await expect(page.getByTestId("section--availability-calendar")).toHaveCount(1);

  const hydrationLines = consoleErrors.filter((line) => HYDRATION_WARNING_PATTERN.test(line));
  expect(hydrationLines, `unexpected hydration-mismatch console error(s): ${hydrationLines.join("\n")}`).toEqual([]);
});

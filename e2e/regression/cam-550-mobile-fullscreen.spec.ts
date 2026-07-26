/**
 * CAM-550 — the assistant is full screen on mobile with a header that stays
 * put; the launcher is fully visible and never cropped.
 *
 * Given the home page's floating assistant (public, no login required — this
 *      spec stays anonymous, same convention as
 *      e2e/regression/cam-540-dialog-select-dismiss.spec.ts)
 * When opened at a real phone viewport
 * Then no minimize/collapse control renders (only close); the SAME control
 *      DOES render at a real desktop viewport; the header stays fully inside
 *      the viewport while the conversation scrolls under it; the launcher's
 *      bounding box sits fully inside the viewport.
 *
 * AC coverage:
 *   AC-1 mobile has no expand/collapse toggle; desktop keeps it (both
 *        measured at their own real viewport — the honest instrument for a
 *        responsive-CSS claim; a source-inspection test alone can't prove
 *        which viewport a Tailwind breakpoint actually activates at)
 *   AC-2 the header's bounding box stays within [0, viewportHeight] through
 *        a real scroll of the message list (not merely "the box didn't move"
 *        — genuinely overflowing content is injected first so the scroll is
 *        real, per the ticket: "confirm which element actually scrolls")
 *   AC-3 the launcher's bounding box is fully inside the viewport at a phone
 *        width (x >= 0, y >= 0, right <= viewport width, bottom <= viewport
 *        height) — the "sometimes cropped at the viewport edge" defect
 *
 * Content-injection note: this repo's e2e-regression dev server
 * (playwright.config.ts's `regression` project, .env.e2e) has no
 * OPENROUTER_API_KEY, so a real chat turn always resolves to the
 * `assistant_disabled` (503) path (lib/ai/openrouter-client.ts) — one
 * exchange is not reliably enough DOM height to overflow the message list on
 * every viewport. Rather than depend on that (flaky, and orthogonal to what
 * this story fixes), AC-2 injects plain filler rows directly into the real
 * `log--ai-chat-messages` container via `page.evaluate` to force genuine
 * overflow, then performs a REAL scroll of the REAL Radix ScrollArea
 * viewport and reads real bounding boxes — the CSS/layout behavior under
 * test (does the header stay anchored while the list scrolls) does not
 * depend on what produced the overflowing content.
 */
import { test, expect } from "@playwright/test";

const PHONE_VIEWPORT = { width: 390, height: 664 }; // iPhone 13-class
const DESKTOP_VIEWPORT = { width: 1280, height: 900 };

test.describe("AC-1 — expand/collapse toggle: absent on mobile, present on desktop", () => {
  test("mobile: only the close control renders — no minimize/expand toggle", async ({ page }) => {
    await page.setViewportSize(PHONE_VIEWPORT);
    await page.goto("/", { waitUntil: "networkidle", timeout: 60_000 });

    await page.getByTestId("btn--ai-chat-launcher").click();
    const panel = page.locator('[data-testid="dialog--ai-chat-panel"]');
    await panel.waitFor({ state: "visible" });

    await expect(page.getByTestId("btn--ai-chat-expand-toggle")).toBeHidden();
    await expect(page.getByTestId("btn--ai-chat-close")).toBeVisible();
  });

  test("desktop: the same panel DOES render the minimize/expand toggle — proves the mobile absence is a viewport fork, not a deletion", async ({
    page,
  }) => {
    await page.setViewportSize(DESKTOP_VIEWPORT);
    await page.goto("/", { waitUntil: "networkidle", timeout: 60_000 });

    await page.getByTestId("btn--ai-chat-launcher").click();
    const panel = page.locator('[data-testid="dialog--ai-chat-panel"]');
    await panel.waitFor({ state: "visible" });

    await expect(page.getByTestId("btn--ai-chat-expand-toggle")).toBeVisible();
    await expect(page.getByTestId("btn--ai-chat-close")).toBeVisible();
  });
});

test.describe("AC-2 — the header stays fully inside the viewport while the conversation scrolls under it", () => {
  test.use({ viewport: PHONE_VIEWPORT });

  test("header bounding box is unchanged and within the viewport after scrolling the message list to the bottom and back to the top", async ({
    page,
  }) => {
    await page.goto("/", { waitUntil: "networkidle", timeout: 60_000 });
    await page.getByTestId("btn--ai-chat-launcher").click();
    const panel = page.locator('[data-testid="dialog--ai-chat-panel"]');
    await panel.waitFor({ state: "visible" });
    // Let the panel's own ~200ms entrance transition (zoom-in/fade-in)
    // settle before taking ANY bounding-box measurement — otherwise "before"
    // can be captured mid-animation and never match the settled position
    // read after the scroll (a real flake this test hit, not a defect).
    await page.waitForTimeout(400);

    // Force genuine overflow (see file header comment) — plain filler rows
    // inside the real message-list container.
    await page.evaluate(() => {
      const log = document.querySelector('[data-testid="log--ai-chat-messages"]');
      if (!log) throw new Error("log--ai-chat-messages not found");
      for (let i = 0; i < 40; i++) {
        const row = document.createElement("div");
        row.style.height = "80px";
        row.textContent = `filler row ${i}`;
        row.setAttribute("data-cam-550-filler", "true");
        log.appendChild(row);
      }
    });

    const viewport = page.locator("[data-radix-scroll-area-viewport]").first();
    const overflow = await viewport.evaluate((el) => el.scrollHeight - el.clientHeight);
    expect(overflow, "filler rows must actually overflow the scroll viewport").toBeGreaterThan(100);

    // Identity-cluster text (the header's own name label) is the element
    // under test — it lives OUTSIDE the ScrollArea, in the shrink-0 header
    // row (AiChatPanel.tsx).
    const headerName = page.locator('[data-testid="dialog--ai-chat-panel"] p.font-heading').first();
    await headerName.waitFor({ state: "visible" });
    const before = await headerName.boundingBox();
    expect(before).not.toBeNull();

    await viewport.evaluate((el) => {
      el.scrollTo({ top: el.scrollHeight });
    });
    await page.waitForTimeout(250);
    const afterScrollDown = await headerName.boundingBox();

    await viewport.evaluate((el) => {
      el.scrollTo({ top: 0 });
    });
    await page.waitForTimeout(250);
    const afterScrollUp = await headerName.boundingBox();

    for (const box of [before, afterScrollDown, afterScrollUp]) {
      expect(box).not.toBeNull();
      expect(box!.y).toBeGreaterThanOrEqual(0);
      expect(box!.y + box!.height).toBeLessThanOrEqual(PHONE_VIEWPORT.height);
    }
    // The header must not have moved AT ALL — it is not inside the scroll
    // container (this is the actual "which element scrolls" proof).
    expect(afterScrollDown).toEqual(before);
    expect(afterScrollUp).toEqual(before);
  });
});

test.describe("AC-3 — the launcher is fully visible, never cropped, at a phone viewport", () => {
  test.use({ viewport: PHONE_VIEWPORT });

  test("launcher bounding box sits entirely inside the viewport", async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle", timeout: 60_000 });
    const launcher = page.getByTestId("btn--ai-chat-launcher");
    await launcher.waitFor({ state: "visible" });
    const box = await launcher.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(PHONE_VIEWPORT.width);
    expect(box!.y + box!.height).toBeLessThanOrEqual(PHONE_VIEWPORT.height);
  });
});

/**
 * CAM-661 verification — proves the PAINTED result, not just the source.
 *
 * The shipped fix (__tests__/cam-661-overlay-blur.test.ts) only asserts the
 * class strings `bg-overlay/25` + `backdrop-blur-sm` are present in the
 * three overlay components' source. That is real evidence the token was
 * SWAPPED IN, but it is zero evidence of what actually gets PAINTED — a
 * source-inspection test would have passed happily on the pre-fix code too,
 * if the diff had merely renamed `bg-foreground/15` -> `bg-overlay/25`
 * without `--overlay` ever being declared correctly. This spec drives a
 * real Chromium instance against the real running app (real Tailwind v4
 * build, real `:root`/`.dark` cascade, real Radix runtime) and measures the
 * ACTUAL rendered/composited colour of the Dialog, Sheet, and AlertDialog
 * overlays, in both themes, via real user interaction (click).
 *
 * Methodology (no screenshot-decoding dependency needed):
 *  1. Open the real overlay with a real click; read its LIVE computed
 *     `background-color` + `backdrop-filter` via `getComputedStyle` on the
 *     actual mounted DOM node (data-slot) — this captures whatever Radix +
 *     Tailwind ACTUALLY resolved at runtime, not a hand-typed expectation.
 *  2. To turn that colour into a real "is it darker" measurement, paint it
 *     with the browser's OWN Canvas 2D `source-over` compositor (the exact
 *     model CSS background-color alpha-stacking uses) over a real `bg-card`
 *     surface (representative of what a modal actually sits on top of — a
 *     camp card, the navbar, a form panel — never a bare empty canvas).
 *     `getImageData` then returns the true rasterised sRGB pixel Chromium
 *     painted, from which WCAG relative luminance is computed. This works
 *     for ANY CSS colour function (oklab/oklch/lab — exactly what
 *     `getComputedStyle` returns for these Tailwind v4 tokens) with zero
 *     manual colour-space math and zero new npm dependency.
 *  3. CSS animation/transition durations are frozen to 0 (not a timed
 *     sleep) so what we read is the overlay's steady-state paint, not a
 *     mid-fade frame — deterministic, no flake.
 *
 * Historical-regression control (Prove-It, without touching any component
 * file — `components/ui/*` is another dispatch's owned surface): the OLD,
 * pre-fix class `bg-foreground/15` still resolves live today (`--foreground`
 * was never removed, only stopped being used for the scrim), so this spec
 * also composites THAT class the same way and asserts it reproduces the
 * exact reported bug shape — darkens in light theme, LIGHTENS in dark theme
 * ("ตอนนี้ดูแปลก ๆ กรณีที่ใส่เป็นสีขาวแทน ตอนที่เปิด Modal") — proving this
 * measurement technique has real teeth: fed the historically-broken colour,
 * it fails exactly the way the shipped bug did; fed the live, fixed colour,
 * it passes.
 *
 * Layer: Playwright e2e, `regression` project (real local Postgres + real
 * dev server + real authenticated session — see playwright.config.ts).
 * Run: `PW_REGRESSION=1 npx playwright test e2e/regression/cam-661-overlay-luminance.spec.ts --project=regression`
 */
import { test, expect, type Page } from "@playwright/test";

type RGB = [number, number, number];

/** WCAG 2.x relative luminance from an sRGB 0-255 triplet. */
function relativeLuminance([r, g, b]: RGB): number {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/**
 * Real browser-native colour compositing. Paints each CSS colour string
 * onto a <canvas> in source-over order (canvas 2D's default composite op —
 * the same Porter-Duff model the browser paints stacked backgrounds with),
 * then reads back the actual rasterised sRGB pixel. Accepts ANY CSS colour
 * function (oklab/oklch/lab/rgb) because `ctx.fillStyle` is the browser's
 * own colour parser — this is how we get a real composited colour without
 * hand-rolling oklab->srgb matrices or adding a PNG-decode dependency.
 */
async function compositePixel(page: Page, colorStrings: string[]): Promise<RGB> {
  const [r, g, b] = await page.evaluate((colors) => {
    const canvas = document.createElement("canvas");
    canvas.width = 2;
    canvas.height = 2;
    const ctx = canvas.getContext("2d")!;
    for (const c of colors) {
      ctx.fillStyle = c;
      ctx.fillRect(0, 0, 2, 2);
    }
    const d = ctx.getImageData(0, 0, 1, 1).data;
    return [d[0], d[1], d[2]];
  }, colorStrings);
  return [r, g, b];
}

/** Real computed `background-color` for a Tailwind class, read from a live (detached) probe node on the CURRENT page/theme — same cascade a real element sees. */
async function computedBg(page: Page, className: string): Promise<string> {
  return page.evaluate((cls) => {
    const el = document.createElement("div");
    el.className = cls;
    document.body.appendChild(el);
    const bg = getComputedStyle(el).backgroundColor;
    el.remove();
    return bg;
  }, className);
}

async function setTheme(page: Page, theme: "light" | "dark") {
  await page.addInitScript((t) => {
    window.localStorage.setItem("campvibe_theme", t);
  }, theme);
}

/** Force CSS animation/transition durations to 0 — a deterministic way to
 * land on the overlay's steady-state paint without a timed sleep (no-flake
 * rule: this removes the indeterminacy at its source instead of waiting on
 * a fixed clock). */
async function freezeAnimations(page: Page) {
  await page.addStyleTag({
    content:
      "*, *::before, *::after { animation-duration: 0s !important; animation-delay: 0s !important; transition-duration: 0s !important; }",
  });
}

async function assertThemeApplied(page: Page, theme: "light" | "dark") {
  const html = page.locator("html");
  await expect(html).toHaveClass(new RegExp(`(^|\\s)${theme}(\\s|$)`));
}

async function backdropFilterSupport(page: Page): Promise<boolean> {
  return page.evaluate(() => CSS.supports("backdrop-filter", "blur(1px)"));
}

const THEMES = ["light", "dark"] as const;

// ---------------------------------------------------------------------------
// 1. PRIMARY CLAIM — each of the 3 real overlays darkens real page content,
//    in both themes, measured from the actual live DOM node.
// ---------------------------------------------------------------------------

test.describe("CAM-661 — real overlay paint darkens real content (both themes)", () => {
  for (const theme of THEMES) {
    test(`[section] Dialog overlay (${theme}): darker than bg-card, blur applied`, async ({ page }) => {
      await setTheme(page, theme);
      await page.goto("/");
      await freezeAnimations(page);
      await assertThemeApplied(page, theme);

      const cardColor = await computedBg(page, "bg-card");
      const lumBefore = relativeLuminance(await compositePixel(page, [cardColor]));

      // Real user interaction: open the real SearchModal <Dialog>. No
      // data-testid exists yet on this Navbar trigger (frontend surface,
      // out of this dispatch's scope) — the button that opens it is the
      // only <button> directly under <nav> holding the round search-icon
      // chip (`div.bg-primary`), verified unique via a direct-browser probe.
      const trigger = page.locator("nav").locator("button:has(div.bg-primary)").first();
      await trigger.click();

      const overlay = page.locator('[data-slot="dialog-overlay"]');
      await expect(overlay).toBeVisible();

      const overlayColor = await overlay.evaluate((el) => getComputedStyle(el).backgroundColor);
      const overlayBlur = await overlay.evaluate((el) => getComputedStyle(el).backdropFilter);
      const supported = await backdropFilterSupport(page);

      const lumAfter = relativeLuminance(await compositePixel(page, [cardColor, overlayColor]));

      console.log(
        `[CAM-661][Dialog][${theme}] card=${cardColor} lumBefore=${lumBefore.toFixed(6)} overlay=${overlayColor} lumAfter=${lumAfter.toFixed(6)} backdropFilter=${overlayBlur} supportsBackdropFilter=${supported}`
      );

      expect(lumAfter, `Dialog overlay must be darker than bg-card in ${theme} theme`).toBeLessThan(lumBefore);
      if (supported) {
        expect(overlayBlur, "backdrop-filter must actually apply (non-'none') where the browser supports it").not.toBe("none");
      }
    });

    test(`[section] Sheet overlay (${theme}): darker than bg-card, blur applied`, async ({ page }) => {
      await setTheme(page, theme);
      await page.setViewportSize({ width: 375, height: 800 }); // mobile — the Sheet trigger is `md:hidden`
      await page.goto("/dashboard");
      await freezeAnimations(page);
      await assertThemeApplied(page, theme);

      const cardColor = await computedBg(page, "bg-card");
      const lumBefore = relativeLuminance(await compositePixel(page, [cardColor]));

      // Real user interaction: open the real mobile nav <Sheet>. No
      // data-testid on this trigger either (same frontend-surface gap
      // noted above) — it is the single button inside the `md:hidden`
      // mobile header, verified unique via a direct-browser probe.
      const trigger = page.locator("div.md\\:hidden button").first();
      await trigger.click();

      const overlay = page.locator('[data-slot="sheet-overlay"]');
      await expect(overlay).toBeVisible();

      const overlayColor = await overlay.evaluate((el) => getComputedStyle(el).backgroundColor);
      const overlayBlur = await overlay.evaluate((el) => getComputedStyle(el).backdropFilter);
      const supported = await backdropFilterSupport(page);

      const lumAfter = relativeLuminance(await compositePixel(page, [cardColor, overlayColor]));

      console.log(
        `[CAM-661][Sheet][${theme}] card=${cardColor} lumBefore=${lumBefore.toFixed(6)} overlay=${overlayColor} lumAfter=${lumAfter.toFixed(6)} backdropFilter=${overlayBlur} supportsBackdropFilter=${supported}`
      );

      expect(lumAfter, `Sheet overlay must be darker than bg-card in ${theme} theme`).toBeLessThan(lumBefore);
      if (supported) {
        expect(overlayBlur, "backdrop-filter must actually apply (non-'none') where the browser supports it").not.toBe("none");
      }
    });

    test(`[section] AlertDialog overlay (${theme}): darker than bg-card, blur applied`, async ({ page }) => {
      await setTheme(page, theme);
      await page.goto("/dashboard/campsites");
      await freezeAnimations(page);
      await assertThemeApplied(page, theme);

      const cardColor = await computedBg(page, "bg-card");
      const lumBefore = relativeLuminance(await compositePixel(page, [cardColor]));

      // Real user interaction: open the real delete-confirm <AlertDialog>
      // on the seeded host's first camp site row. Accessible name exists
      // (aria-label) — never confirms the destructive action, only opens
      // it to measure the overlay, then dismisses via Escape.
      const trigger = page.getByRole("button", { name: /delete camp site|ลบแคมป์ไซต์/i }).first();
      await expect(trigger).toBeVisible();
      await trigger.click();

      const overlay = page.locator('[data-slot="alert-dialog-overlay"]');
      await expect(overlay).toBeVisible();

      const overlayColor = await overlay.evaluate((el) => getComputedStyle(el).backgroundColor);
      const overlayBlur = await overlay.evaluate((el) => getComputedStyle(el).backdropFilter);
      const supported = await backdropFilterSupport(page);

      const lumAfter = relativeLuminance(await compositePixel(page, [cardColor, overlayColor]));

      console.log(
        `[CAM-661][AlertDialog][${theme}] card=${cardColor} lumBefore=${lumBefore.toFixed(6)} overlay=${overlayColor} lumAfter=${lumAfter.toFixed(6)} backdropFilter=${overlayBlur} supportsBackdropFilter=${supported}`
      );

      expect(lumAfter, `AlertDialog overlay must be darker than bg-card in ${theme} theme`).toBeLessThan(lumBefore);
      if (supported) {
        expect(overlayBlur, "backdrop-filter must actually apply (non-'none') where the browser supports it").not.toBe("none");
      }

      // Never confirm the destructive action — dismiss only.
      await page.keyboard.press("Escape");
      await expect(overlay).toBeHidden();
    });
  }
});

// ---------------------------------------------------------------------------
// 2. CROSS-COMPONENT CONSISTENCY — "all three overlays paint the same":
//    identical live computed colour + blur, within one theme, one session.
// ---------------------------------------------------------------------------

test.describe("CAM-661 — all three overlays paint identically", () => {
  for (const theme of THEMES) {
    test(`[section] Dialog/Sheet/AlertDialog compute the same colour+blur (${theme})`, async ({ page }) => {
      await setTheme(page, theme);

      // Dialog
      await page.goto("/");
      await freezeAnimations(page);
      await assertThemeApplied(page, theme);
      await page.locator("nav").locator("button:has(div.bg-primary)").first().click();
      const dialogOverlay = page.locator('[data-slot="dialog-overlay"]');
      await expect(dialogOverlay).toBeVisible();
      const dialogColor = await dialogOverlay.evaluate((el) => getComputedStyle(el).backgroundColor);
      const dialogBlur = await dialogOverlay.evaluate((el) => getComputedStyle(el).backdropFilter);
      await page.keyboard.press("Escape");

      // Sheet (mobile)
      await page.setViewportSize({ width: 375, height: 800 });
      await page.goto("/dashboard");
      await freezeAnimations(page);
      await page.locator("div.md\\:hidden button").first().click();
      const sheetOverlay = page.locator('[data-slot="sheet-overlay"]');
      await expect(sheetOverlay).toBeVisible();
      const sheetColor = await sheetOverlay.evaluate((el) => getComputedStyle(el).backgroundColor);
      const sheetBlur = await sheetOverlay.evaluate((el) => getComputedStyle(el).backdropFilter);
      await page.keyboard.press("Escape");

      // AlertDialog (back to desktop)
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.goto("/dashboard/campsites");
      await freezeAnimations(page);
      const delTrigger = page.getByRole("button", { name: /delete camp site|ลบแคมป์ไซต์/i }).first();
      await expect(delTrigger).toBeVisible();
      await delTrigger.click();
      const alertOverlay = page.locator('[data-slot="alert-dialog-overlay"]');
      await expect(alertOverlay).toBeVisible();
      const alertColor = await alertOverlay.evaluate((el) => getComputedStyle(el).backgroundColor);
      const alertBlur = await alertOverlay.evaluate((el) => getComputedStyle(el).backdropFilter);
      await page.keyboard.press("Escape");

      console.log(
        `[CAM-661][cross-component][${theme}] dialog=${dialogColor}/${dialogBlur} sheet=${sheetColor}/${sheetBlur} alert=${alertColor}/${alertBlur}`
      );

      expect(sheetColor).toBe(dialogColor);
      expect(alertColor).toBe(dialogColor);
      expect(sheetBlur).toBe(dialogBlur);
      expect(alertBlur).toBe(dialogBlur);
    });
  }
});

// ---------------------------------------------------------------------------
// 3. THEME-INVARIANCE — the exact CAM-661 fix claim: the overlay's own
//    colour must be IDENTICAL between light and dark (no `.dark` twin, per
//    the `--overlay` token declared once in globals.css). This is the
//    assertion that would have failed on the pre-fix `bg-foreground/15`
//    (which DOES change with `--foreground` between themes).
// ---------------------------------------------------------------------------

test("[section] Dialog overlay colour is theme-invariant (same in light and dark)", async ({ page }) => {
  await setTheme(page, "light");
  await page.goto("/");
  await freezeAnimations(page);
  await assertThemeApplied(page, "light");
  await page.locator("nav").locator("button:has(div.bg-primary)").first().click();
  const lightOverlay = page.locator('[data-slot="dialog-overlay"]');
  await expect(lightOverlay).toBeVisible();
  const lightColor = await lightOverlay.evaluate((el) => getComputedStyle(el).backgroundColor);
  const lightBlur = await lightOverlay.evaluate((el) => getComputedStyle(el).backdropFilter);

  await setTheme(page, "dark");
  await page.goto("/");
  await freezeAnimations(page);
  await assertThemeApplied(page, "dark");
  await page.locator("nav").locator("button:has(div.bg-primary)").first().click();
  const darkOverlay = page.locator('[data-slot="dialog-overlay"]');
  await expect(darkOverlay).toBeVisible();
  const darkColor = await darkOverlay.evaluate((el) => getComputedStyle(el).backgroundColor);
  const darkBlur = await darkOverlay.evaluate((el) => getComputedStyle(el).backdropFilter);

  console.log(`[CAM-661][theme-invariance] light=${lightColor}/${lightBlur} dark=${darkColor}/${darkBlur}`);

  expect(darkColor, "the overlay colour must not track --foreground (the pre-fix bug) between themes").toBe(lightColor);
  expect(darkBlur).toBe(lightBlur);
});

// ---------------------------------------------------------------------------
// 4. PROVE-IT / HISTORICAL-REGRESSION CONTROL — without touching any
//    component file (out of this dispatch's surface): the pre-fix class
//    `bg-foreground/15` still resolves live today (`--foreground` was never
//    removed, only stopped being used for the scrim). Compositing THAT
//    class the same way must reproduce the exact reported bug shape —
//    darkens in light theme, LIGHTENS in dark theme — proving this
//    measurement technique has real teeth: fed the historically-broken
//    colour it goes red the way the shipped bug did; fed the live, fixed
//    colour (`bg-overlay/25`) it is green in both themes.
// ---------------------------------------------------------------------------

test.describe("CAM-661 — Prove-It: the historical bg-foreground/15 bug shape, reproduced live", () => {
  for (const theme of THEMES) {
    test(`[section] old bg-foreground/15 vs fixed bg-overlay/25 over bg-card (${theme})`, async ({ page }) => {
      await setTheme(page, theme);
      await page.goto("/");
      await freezeAnimations(page);
      await assertThemeApplied(page, theme);

      const cardColor = await computedBg(page, "bg-card");
      const oldBuggyColor = await computedBg(page, "bg-foreground/15");
      const fixedColor = await computedBg(page, "bg-overlay/25");

      const lumCard = relativeLuminance(await compositePixel(page, [cardColor]));
      const lumOldBuggy = relativeLuminance(await compositePixel(page, [cardColor, oldBuggyColor]));
      const lumFixed = relativeLuminance(await compositePixel(page, [cardColor, fixedColor]));

      console.log(
        `[CAM-661][prove-it][${theme}] lumCard=${lumCard.toFixed(6)} lumOldBuggy=${lumOldBuggy.toFixed(6)} lumFixed=${lumFixed.toFixed(6)}`
      );

      // The live, shipped fix always darkens.
      expect(lumFixed, `fixed bg-overlay/25 must darken bg-card in ${theme} theme`).toBeLessThan(lumCard);

      if (theme === "dark") {
        // The historically-shipped bug: bg-foreground/15 LIGHTENS in dark
        // theme instead of darkening ("white film"). This is the exact
        // defect CAM-661 fixed — reproduced live, without editing any
        // component file, proving this measurement catches it.
        expect(lumOldBuggy, "pre-fix bg-foreground/15 lightens bg-card in dark theme (the reported bug)").toBeGreaterThan(lumCard);
      } else {
        expect(lumOldBuggy, "pre-fix bg-foreground/15 still darkens correctly in light theme").toBeLessThan(lumCard);
      }
    });
  }
});

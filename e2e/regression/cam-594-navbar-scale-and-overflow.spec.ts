/**
 * CAM-594 (+ CAM-593, merged) — the mobile header on the scale, and the row
 * that overflowed once the text got bigger.
 *
 * WHY THIS SPEC EXISTS AT TWO TEXT SCALES. The 150% overflow survived
 * everything we already had: CAM-565's static M4 rule, the default-zoom e2e
 * specs, and a round of manual verification all passed while a larger-text
 * user got a sideways-scrolling page. Default-zoom-only evidence is exactly
 * what let it live. So every geometric assertion below runs at BOTH the
 * default size and 150% (`html { font-size: 24px }`, 24/16 = 1.5 — the same
 * contract cam-558-touch-targets and cam-560-category-label-overlap use).
 *
 * Runs under the `regression` project, so it is authenticated as the seeded
 * host: the WORST case for this row (heart + bell + account all rendered).
 * That is the only case that ever overflowed — logged out never did.
 *
 * MEASURED ON THIS BRANCH (dev server, chromium), before -> after:
 *   100%  320px  title 80->64  pill 54->44  block 79->61   overflow  0 ->  0
 *   100%  390px  title 80->64  pill 54->44  block 79->61   overflow  0 ->  0
 *   150%  320px  title 120->150 (wraps)  pill 128->66      overflow 132 -> 0
 *   150%  390px  title 120->150 (wraps)  pill  98->66      overflow  62 -> 0
 *   desktop 1280px, both scales: byte-identical (nav 81/121, strip top
 *   80/120, offset gap -1, strip visible 94/95 and 140/141).
 */
import { test, expect, type Page } from "@playwright/test";

const PHONE_WIDTHS = [320, 390] as const;
const TOUCH_FLOOR = 44;

// CAM-565's standing contract for "an increased text scale".
const TEXT_SCALES = [
  { name: "default", rootPx: 16, titleRow: 64, pill: 44, minTap: 44 },
  { name: "150%", rootPx: 24, titleRow: 96, pill: 66, minTap: 66 },
] as const;

async function openHome(page: Page, width: number, rootPx: number) {
  await page.setViewportSize({ width, height: 844 });
  await page.goto("/", { waitUntil: "networkidle", timeout: 60_000 });
  if (rootPx !== 16) {
    await page.addStyleTag({ content: `html { font-size: ${rootPx}px !important; }` });
  }
  // Prove the worst case actually rendered (logged-in icon row) — a silent
  // auth failure would make every measurement below meaningless.
  await expect(page.getByTestId("btn--wishlist-nav")).toBeVisible();
}

for (const scale of TEXT_SCALES) {
  for (const width of PHONE_WIDTHS) {
    test(`AC-2 — Home never scrolls sideways at ${width}px, ${scale.name} text scale (logged in)`, async ({
      page,
    }) => {
      await openHome(page, width, scale.rootPx);

      const m = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));

      expect(
        m.scrollWidth,
        `scrollWidth=${m.scrollWidth} vs clientWidth=${m.clientWidth} at ${width}px, ${scale.name}` +
          " (before this fix, 150% measured a near-constant 452px at BOTH widths)",
      ).toBeLessThanOrEqual(m.clientWidth);
    });

    test(`AC-4 — every header tap target clears 44px at ${width}px, ${scale.name} text scale`, async ({
      page,
    }) => {
      await openHome(page, width, scale.rootPx);

      const controls = await page.evaluate(() => {
        const row = document.querySelector('[data-testid="section--navbar-title-row"]')!;
        const boxes = [...row.querySelectorAll('a[href], button, [role="button"]')]
          .filter((el) => (el as HTMLElement).offsetParent !== null)
          .map((el) => {
            const r = el.getBoundingClientRect();
            return {
              label: (el.getAttribute("aria-label") || el.tagName).trim().slice(0, 24),
              width: r.width,
              height: r.height,
            };
          });
        const pill = document.querySelector('[data-testid="section--navbar-search-mobile"] > div')!;
        const pr = pill.getBoundingClientRect();
        return [...boxes, { label: "mobile search pill", width: pr.width, height: pr.height }];
      });

      expect(controls.length, "no header controls found — selector or auth is wrong").toBeGreaterThan(3);
      for (const c of controls) {
        expect(c.width, `"${c.label}" width at ${width}px/${scale.name}`).toBeGreaterThanOrEqual(TOUCH_FLOOR);
        expect(c.height, `"${c.label}" height at ${width}px/${scale.name}`).toBeGreaterThanOrEqual(TOUCH_FLOOR);
      }
    });

    test(`AC-1 — the title row and search pill sit on the scale at ${width}px, ${scale.name} text scale`, async ({
      page,
    }) => {
      await openHome(page, width, scale.rootPx);

      const geom = await page.evaluate(() => {
        const row = document.querySelector('[data-testid="section--navbar-title-row"]')!;
        const pill = document.querySelector('[data-testid="section--navbar-search-mobile"] > div')!;
        return {
          rowHeight: row.getBoundingClientRect().height,
          pillHeight: pill.getBoundingClientRect().height,
        };
      });

      // The pill is pinned EXACTLY: `h-11` is both the touch floor and the
      // §2.0 `md` control height, so any drift off it is a defect in either
      // direction (54px was the pre-fix accident of `py-3` + tallest child).
      expect(geom.pillHeight, `search pill height at ${width}px/${scale.name}`).toBeCloseTo(scale.pill, 0);

      // The row is a MIN height: at 150% the row legitimately grows past it,
      // because the icon cluster wraps to a second line (BR-3/EC-1). Asserting
      // the floor keeps the mobile step honest without pinning the wrap.
      expect(geom.rowHeight, `title row height at ${width}px/${scale.name}`).toBeGreaterThanOrEqual(
        scale.titleRow,
      );
      // ...and it must not have silently kept the 80px desktop value at the
      // default text size, which is the whole of CAM-593.
      if (scale.rootPx === 16) {
        expect(geom.rowHeight, "title row must take the 64px mobile step, not the 80px desktop value").toBe(
          64,
        );
      }
    });

    test(`AC-3/EC-3 — the category strip is never a stuck sliver at ${width}px, ${scale.name} text scale`, async ({
      page,
    }) => {
      await openHome(page, width, scale.rootPx);

      // CAM-549's defect shape: the strip stuck BEHIND the taller mobile
      // header, leaving a ~14px sliver the owner read as a stray line. Below
      // `md` the strip must be plain static content, fully visible at the top
      // of the page and scrolling away normally.
      const atTop = await page.evaluate(() => {
        const strip = document.querySelector('[data-testid="section--category-bar-wrapper"]')!;
        const bar = document.querySelector('[data-testid="section--navbar-search-mobile"]')!;
        const s = strip.getBoundingClientRect();
        return {
          position: getComputedStyle(strip).position,
          height: s.height,
          top: s.top,
          stickyChromeBottom: bar.getBoundingClientRect().bottom,
        };
      });

      expect(atTop.position, "the category strip must not be sticky below md (CAM-549)").toBe("static");
      expect(atTop.height, "category strip height").toBeGreaterThan(0);
      // Fully clear of the sticky search bar at scroll 0 — no occluded sliver.
      expect(
        atTop.top,
        `strip top=${atTop.top} vs sticky chrome bottom=${atTop.stickyChromeBottom}`,
      ).toBeGreaterThanOrEqual(atTop.stickyChromeBottom - 1);

      // And it genuinely scrolls with the page rather than pinning itself.
      const beforeScroll = atTop.top;
      await page.evaluate(() => window.scrollTo(0, 300));
      await page.waitForTimeout(200);
      const afterScroll = await page.evaluate(
        () => document.querySelector('[data-testid="section--category-bar-wrapper"]')!.getBoundingClientRect().top,
      );
      expect(afterScroll, "strip did not move with the page — it is pinned").toBeLessThan(beforeScroll - 250);
    });
  }
}

for (const scale of TEXT_SCALES) {
  test(`AC-5 — desktop keeps the 80px nav and the flush CategoryBar offset, ${scale.name} text scale`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/", { waitUntil: "networkidle", timeout: 60_000 });
    if (scale.rootPx !== 16) {
      await page.addStyleTag({ content: `html { font-size: ${scale.rootPx}px !important; }` });
    }
    await page.evaluate(() => window.scrollTo(0, 900));
    await page.waitForTimeout(250);

    const desk = await page.evaluate(() => {
      const nav = document.querySelector("nav")!;
      const strip = document.querySelector('[data-testid="section--category-bar-wrapper"]')!;
      const n = nav.getBoundingClientRect();
      const s = strip.getBoundingClientRect();
      return {
        navPosition: getComputedStyle(nav).position,
        stripPosition: getComputedStyle(strip).position,
        navBottom: n.bottom,
        stripTop: s.top,
        stripHeight: s.height,
        visible: Math.min(s.bottom, window.innerHeight) - Math.max(s.top, n.bottom),
      };
    });

    expect(desk.navPosition).toBe("sticky");
    expect(desk.stripPosition).toBe("sticky");
    // The trap: the strip's `top-20` offset assumes an 80px nav. This story
    // changes the row height ONLY below md, so the two must still meet flush.
    // Measured -1px both before and after (the nav's own 1px bottom border).
    expect(
      desk.stripTop - desk.navBottom,
      `stripTop=${desk.stripTop} navBottom=${desk.navBottom} — the sticky offset no longer follows the header height`,
    ).toBeGreaterThanOrEqual(-2);
    expect(desk.stripTop - desk.navBottom, "a gap opened between the nav and the strip").toBeLessThanOrEqual(1);
    // Essentially all of the strip is visible when stuck (only that 1px border
    // overlaps), at both text scales.
    expect(desk.visible, `strip visible height when stuck at ${scale.name}`).toBeGreaterThanOrEqual(
      desk.stripHeight - 2,
    );
  });
}

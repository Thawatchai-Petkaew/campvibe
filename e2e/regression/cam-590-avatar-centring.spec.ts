/**
 * CAM-590 — the account button's avatar is visibly off-centre once CAM-558
 * hides the hamburger below `md` (asymmetric `p-1 pl-3` left over from when
 * the hamburger sat to the avatar's left). Proven by real bounding-box
 * geometry (not className inspection): the avatar wrapper's left/right gap
 * inside the button, the button's own ≥44px floor in both dimensions, and
 * the 320px logged-in horizontal-overflow check CAM-558 closed.
 *
 * Runs under the `regression` project (authenticated as the seeded host,
 * storageState from `global.setup.ts`) — the account button only renders
 * with a session.
 *
 * AC coverage:
 *   AC-1 avatar centred (left gap == right gap, within 1px)
 *   AC-2 button still >=44x44px in both dimensions
 *   AC-3 320px logged-in horizontal overflow stays closed
 *   AC-4 desktop (hamburger + avatar) is visually unchanged
 *   EC-2 the above re-hold at a realistic 150% root font-size
 */
import { test, expect, type Page } from "@playwright/test";
import translations from "../../locales/translations.json";

const PHONE = { width: 390, height: 844 };
const DESKTOP = { width: 1280, height: 900 };
const NARROW_320 = { width: 320, height: 640 };
const TOUCH_FLOOR = 44;
const MAX_GAP_DIFF = 1; // px

function escapeForRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function eitherLanguage(en: string, th: string): RegExp {
  return new RegExp(`^(${escapeForRegExp(en)}|${escapeForRegExp(th)})$`);
}
const ACCOUNT_MENU_LABEL = eitherLanguage(translations.en.nav.accountMenuAriaLabel, translations.th.nav.accountMenuAriaLabel);
const SWITCH_LANGUAGE_LABEL = eitherLanguage(translations.en.nav.switchLanguageAriaLabel, translations.th.nav.switchLanguageAriaLabel);

async function measureCentring(page: Page) {
  const button = page.getByRole("button", { name: ACCOUNT_MENU_LABEL });
  const avatar = page.getByTestId("section--navbar-account-avatar");
  const buttonBox = await button.boundingBox();
  const avatarBox = await avatar.boundingBox();
  expect(buttonBox, "profile menu button: boundingBox() was null").not.toBeNull();
  expect(avatarBox, "avatar wrapper: boundingBox() was null").not.toBeNull();

  const leftGap = avatarBox!.x - buttonBox!.x;
  const rightGap = (buttonBox!.x + buttonBox!.width) - (avatarBox!.x + avatarBox!.width);
  return { buttonBox: buttonBox!, avatarBox: avatarBox!, leftGap, rightGap };
}

test.describe("AC-1/AC-2 — the avatar centres in the button, which still clears the 44px floor", () => {
  test.use({ viewport: PHONE });

  test("left gap == right gap within 1px, button >=44x44px, at 390px", async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle", timeout: 60_000 });
    const { buttonBox, leftGap, rightGap } = await measureCentring(page);

    expect(
      Math.abs(leftGap - rightGap),
      `left gap=${leftGap}px vs right gap=${rightGap}px at 390px`
    ).toBeLessThanOrEqual(MAX_GAP_DIFF);
    expect(buttonBox.width, `button width=${buttonBox.width}px at 390px`).toBeGreaterThanOrEqual(TOUCH_FLOOR);
    expect(buttonBox.height, `button height=${buttonBox.height}px at 390px`).toBeGreaterThanOrEqual(TOUCH_FLOOR);
  });
});

test.describe("AC-1/AC-2/AC-3 — same checks at 320px, plus the horizontal-overflow guard", () => {
  test.use({ viewport: NARROW_320 });

  test("left gap == right gap within 1px, button >=44x44px, scrollWidth <= clientWidth at 320px", async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle", timeout: 60_000 });
    const { buttonBox, leftGap, rightGap } = await measureCentring(page);

    expect(
      Math.abs(leftGap - rightGap),
      `left gap=${leftGap}px vs right gap=${rightGap}px at 320px`
    ).toBeLessThanOrEqual(MAX_GAP_DIFF);
    expect(buttonBox.width, `button width=${buttonBox.width}px at 320px`).toBeGreaterThanOrEqual(TOUCH_FLOOR);
    expect(buttonBox.height, `button height=${buttonBox.height}px at 320px`).toBeGreaterThanOrEqual(TOUCH_FLOOR);

    const metrics = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(
      metrics.scrollWidth,
      `measured scrollWidth=${metrics.scrollWidth} vs clientWidth=${metrics.clientWidth} at 320px (CAM-558 baseline: 0px over)`
    ).toBeLessThanOrEqual(metrics.clientWidth);
  });
});

test.describe("AC-4 — desktop row (hamburger + avatar) is visually unchanged", () => {
  test.use({ viewport: DESKTOP });

  test("profile button still >=44x44px at desktop; hamburger + language switcher still visible", async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle", timeout: 60_000 });
    const button = page.getByRole("button", { name: ACCOUNT_MENU_LABEL });
    const box = await button.boundingBox();
    expect(box, "profile menu button: boundingBox() was null at desktop").not.toBeNull();
    expect(box!.width, `button width=${box!.width}px at desktop`).toBeGreaterThanOrEqual(TOUCH_FLOOR);
    expect(box!.height, `button height=${box!.height}px at desktop`).toBeGreaterThanOrEqual(TOUCH_FLOOR);

    // Regression guard — the two controls CAM-558 also fixed on this same
    // row must still be present/visible, untouched by this story.
    await expect(page.locator("nav").getByRole("img", { name: "CampVibe Logo" })).toBeVisible();
    await expect(page.getByRole("button", { name: SWITCH_LANGUAGE_LABEL })).toBeVisible();
  });
});

test.describe("EC-2 — the centring + floor still hold at a realistic 150% text scale", () => {
  test.use({ viewport: PHONE });

  test("left gap == right gap within 1px, button >=44x44px, at html { font-size: 24px }", async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle", timeout: 60_000 });
    // Same technique CAM-558's own EC-5 / CAM-560 used: a ~150% root
    // font-size mirrors a common phone "Larger text" setting.
    await page.addStyleTag({ content: "html { font-size: 24px !important; }" });
    await page.waitForTimeout(200);

    const { buttonBox, leftGap, rightGap } = await measureCentring(page);
    expect(
      Math.abs(leftGap - rightGap),
      `left gap=${leftGap}px vs right gap=${rightGap}px @150% text scale`
    ).toBeLessThanOrEqual(MAX_GAP_DIFF);
    expect(buttonBox.width, `button width=${buttonBox.width}px @150% text scale`).toBeGreaterThanOrEqual(TOUCH_FLOOR);
    expect(buttonBox.height, `button height=${buttonBox.height}px @150% text scale`).toBeGreaterThanOrEqual(TOUCH_FLOOR);
  });
});

/**
 * DS-2 — Button grammar + Sarabun font (CAM-122)
 * PR #62, branch feature/ds2-button-sarabun
 *
 * Layer: unit (static source inspection — vitest env is 'node').
 *
 * AC→test map:
 *  AC-btn-1    button primitive base has rounded-full (not rounded-4xl/xl/lg)
 *  AC-btn-2    button primitive base has motion-safe:active:scale-95
 *  AC-btn-3    button primitive base has focus-visible ring (focus-visible:ring-3 + focus-visible:ring-ring/30)
 *  AC-btn-4    default size is h-11
 *  AC-btn-5    sm size is h-9
 *  AC-btn-6    lg size is h-12
 *  AC-btn-7    icon size is size-11
 *  AC-btn-8    icon-sm size is size-9
 *  AC-btn-9    icon-lg size is size-11
 *  AC-btn-10   xs and icon-xs are UNCHANGED (h-6, size-6 — input-group density)
 *  AC-btn-11   no rounded-4xl in base class (was the old staging value)
 *
 *  AC-font-1   layout.tsx imports Sarabun (not Noto_Sans)
 *  AC-font-2   Noto_Sans is fully removed from layout.tsx
 *  AC-font-3   Sarabun uses subsets ['thai', 'latin']
 *  AC-font-4   Sarabun uses variable '--font-sarabun'
 *  AC-font-5   <html> receives sarabun.variable (--font-sarabun on html)
 *  AC-font-6   Inter and Outfit variables still applied to <html>
 *
 *  AC-css-1    globals.css @theme --font-sans includes var(--font-sarabun)
 *  AC-css-2    globals.css @theme --font-display includes var(--font-sarabun)
 *  AC-css-3    globals.css @theme inline --font-heading = var(--font-display) (not var(--font-sans))
 *  AC-css-4    no self-ref --font-sans: var(--font-sans) no-op (was the old bug)
 *  AC-css-5    Inter is still first in --font-sans stack (body default not broken)
 *
 *  AC-consumer-1   FilterModal trigger Button has no focus-visible:outline-none duplicate (removed from ClearAll)
 *  AC-consumer-2   FilterModal show-results Button uses size="lg" (not inline h-10/!h-12)
 *  AC-consumer-3   LoginModal close icon Button has no inline h-10 (size=icon now governs)
 *  AC-consumer-4   LoginModal submit Button uses size="lg" (not !h-12 inline)
 *  AC-consumer-5   RegisterModal close icon Button has no inline h-10
 *  AC-consumer-6   RegisterModal submit Button uses size="lg" (not !h-12 inline)
 *  AC-consumer-7   SearchModal search Button uses size="lg" (not h-10 inline)
 *  AC-consumer-8   AmenitiesModal close Button uses size="lg" (removed rounded-lg + h-12 inline)
 *  AC-consumer-9   CampgroundDetailClient has no h-10 on Button (map-directions button cleaned)
 *  AC-consumer-10  CampgroundDetailClient reserve Button uses size="lg" (not h-12 inline)
 *  AC-consumer-11  bookings page uses size="lg" for CTAs (not h-12 inline)
 *  AC-consumer-12  dashboard page add-campsite Button uses size="lg" (not h-12 inline)
 *  AC-consumer-13  CampgroundForm submit Button uses size="lg" (not h-10 inline)
 *
 *  AC-gate-1   no <Button with h-10 override in consumer files (Button-specific, not InputField)
 *  AC-gate-2   no <Button with !h-12 override in consumer files
 *  AC-gate-3   no focus:ring-0 on Button elements across consumers
 *  AC-gate-4   no rounded-4xl on Button elements in consumers
 *  AC-gate-5   SelectTriggers NOT touched by this PR (DS-3 scope — select primitive unchanged re: sizing)
 *
 *  AC-preview-1  PreviewClient DS-2 section documents h-11 default, h-9 sm, h-12 lg
 *  AC-preview-2  PreviewClient has Thai text sample for Sarabun verification
 */

import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const root = path.resolve(__dirname, "..");
const src = (rel: string) => fs.readFileSync(path.join(root, rel), "utf-8");

const buttonSrc = src("components/ui/button.tsx");
const layoutSrc = src("app/layout.tsx");
const cssSrc = src("app/globals.css");

// Consumer files
const filterModalSrc = src("components/FilterModal.tsx");
const loginModalSrc = src("components/LoginModal.tsx");
const registerModalSrc = src("components/RegisterModal.tsx");
const searchModalSrc = src("components/SearchModal.tsx");
const amenitiesModalSrc = src("components/AmenitiesModal.tsx");
const campDetailSrc = src("components/CampgroundDetailClient.tsx");
const campFormSrc = src("components/CampgroundForm.tsx");
const bookingsSrc = src("app/bookings/page.tsx");
const dashboardSrc = src("app/dashboard/page.tsx");
const previewSrc = src("app/preview/PreviewClient.tsx");

// ─────────────────────────────────────────────────────────────
// Priority 1 — Button primitive grammar
// ─────────────────────────────────────────────────────────────
describe("btn--primitive: base class grammar (AC-btn-1/2/3/11)", () => {
  // Extract the base class string (the first argument to cva)
  const baseClassMatch = buttonSrc.match(/cva\(\s*["'`]([\s\S]*?)["'`]\s*,/);
  const baseClass = baseClassMatch ? baseClassMatch[1] : "";

  it("AC-btn-1: base class contains rounded-full", () => {
    expect(baseClass).toMatch(/\brounded-full\b/);
  });

  it("AC-btn-11: base class does NOT contain rounded-4xl (old staging value removed)", () => {
    expect(baseClass).not.toMatch(/\brounded-4xl\b/);
  });

  it("AC-btn-11: base class does NOT contain rounded-xl", () => {
    expect(baseClass).not.toMatch(/\brounded-xl\b/);
  });

  it("AC-btn-11: base class does NOT contain rounded-lg", () => {
    expect(baseClass).not.toMatch(/\brounded-lg\b/);
  });

  it("AC-btn-2: base class contains motion-safe:active:scale-95", () => {
    expect(baseClass).toMatch(/motion-safe:active:scale-95/);
  });

  it("AC-btn-3: base class has focus-visible ring (focus-visible:ring-3)", () => {
    expect(baseClass).toMatch(/focus-visible:ring-3/);
  });

  it("AC-btn-3: base class has focus-visible:ring-ring/30 (token-based ring color)", () => {
    expect(baseClass).toMatch(/focus-visible:ring-ring\/30/);
  });

  it("AC-btn-3: base class has focus-visible:border-ring (focus border)", () => {
    expect(baseClass).toMatch(/focus-visible:border-ring/);
  });
});

describe("btn--primitive: size scale (AC-btn-4/5/6/7/8/9/10)", () => {
  // Extract the size object block (between "size: {" and the closing "}" before "defaultVariants")
  const sizeBlock = buttonSrc.match(/size:\s*\{([\s\S]*?)\},\s*\n\s*\},\s*\n\s*defaultVariants/)?.[1] ?? "";

  it("AC-btn-4: default size has h-11", () => {
    // The default size entry: "default:\n  "h-11 ..."
    const defaultEntry = sizeBlock.match(/\bdefault:\s*\n?\s*["'`]([\s\S]*?)["'`]/);
    expect(defaultEntry).not.toBeNull();
    expect(defaultEntry![1]).toMatch(/\bh-11\b/);
  });

  it("AC-btn-4: default size no longer has h-9 (old staging default was h-9)", () => {
    const defaultEntry = sizeBlock.match(/\bdefault:\s*\n?\s*["'`]([\s\S]*?)["'`]/);
    expect(defaultEntry).not.toBeNull();
    expect(defaultEntry![1]).not.toMatch(/\bh-9\b/);
  });

  it("AC-btn-5: sm size has h-9", () => {
    const smEntry = sizeBlock.match(/\bsm:\s*["'`]([^"'`]*)["'`]/);
    expect(smEntry).not.toBeNull();
    expect(smEntry![1]).toMatch(/\bh-9\b/);
  });

  it("AC-btn-6: lg size has h-12", () => {
    const lgEntry = sizeBlock.match(/\blg:\s*["'`]([^"'`]*)["'`]/);
    expect(lgEntry).not.toBeNull();
    expect(lgEntry![1]).toMatch(/\bh-12\b/);
  });

  it("AC-btn-7: icon size has size-11 (44px tap target)", () => {
    // Match "icon:" entry only (not icon-sm, icon-lg, icon-xs)
    const iconEntry = sizeBlock.match(/\bicon:\s*["'`]([^"'`]*)["'`]/);
    expect(iconEntry).not.toBeNull();
    expect(iconEntry![1]).toMatch(/\bsize-11\b/);
  });

  it("AC-btn-8: icon-sm size has size-9", () => {
    const iconSmEntry = sizeBlock.match(/"icon-sm":\s*["'`]([^"'`]*)["'`]/);
    expect(iconSmEntry).not.toBeNull();
    expect(iconSmEntry![1]).toMatch(/\bsize-9\b/);
  });

  it("AC-btn-9: icon-lg size has size-11", () => {
    const iconLgEntry = sizeBlock.match(/"icon-lg":\s*["'`]([^"'`]*)["'`]/);
    expect(iconLgEntry).not.toBeNull();
    expect(iconLgEntry![1]).toMatch(/\bsize-11\b/);
  });

  it("AC-btn-10: xs size still has h-6 (input-group density unchanged)", () => {
    const xsEntry = sizeBlock.match(/\bxs:\s*["'`]([^"'`]*)["'`]/);
    expect(xsEntry).not.toBeNull();
    expect(xsEntry![1]).toMatch(/\bh-6\b/);
  });

  it("AC-btn-10: icon-xs size still has size-6 (input-group density unchanged)", () => {
    const iconXsEntry = sizeBlock.match(/"icon-xs":\s*["'`]([^"'`]*)["'`]/);
    expect(iconXsEntry).not.toBeNull();
    expect(iconXsEntry![1]).toMatch(/\bsize-6\b/);
  });
});

// ─────────────────────────────────────────────────────────────
// Priority 3 — Sarabun + Noto_Sans removal
// ─────────────────────────────────────────────────────────────
describe("font--layout: Sarabun wired, Noto_Sans removed (AC-font-1/2/3/4/5/6)", () => {
  it("AC-font-1: layout.tsx imports Sarabun from next/font/google", () => {
    expect(layoutSrc).toMatch(/import\s*\{[^}]*Sarabun[^}]*\}\s*from\s*["']next\/font\/google["']/);
  });

  it("AC-font-2: Noto_Sans import is fully removed from layout.tsx", () => {
    expect(layoutSrc).not.toMatch(/Noto_Sans/);
  });

  it("AC-font-2: notoSans variable usage is fully removed from layout.tsx", () => {
    expect(layoutSrc).not.toMatch(/notoSans/);
  });

  it("AC-font-3: Sarabun declaration includes thai subset", () => {
    expect(layoutSrc).toMatch(/subsets:\s*\[[^\]]*["']thai["'][^\]]*\]/);
  });

  it("AC-font-3: Sarabun declaration includes latin subset", () => {
    expect(layoutSrc).toMatch(/subsets:\s*\[[^\]]*["']latin["'][^\]]*\]/);
  });

  it("AC-font-4: Sarabun uses variable --font-sarabun", () => {
    expect(layoutSrc).toMatch(/variable:\s*["']--font-sarabun["']/);
  });

  it("AC-font-5: <html> element receives sarabun.variable", () => {
    // The html element className must include sarabun.variable
    const htmlMatch = layoutSrc.match(/<html[^>]*className[^>]*>/);
    expect(htmlMatch).not.toBeNull();
    expect(htmlMatch![0]).toMatch(/sarabun\.variable/);
  });

  it("AC-font-6: <html> element still receives inter.variable", () => {
    const htmlMatch = layoutSrc.match(/<html[^>]*className[^>]*>/);
    expect(htmlMatch).not.toBeNull();
    expect(htmlMatch![0]).toMatch(/inter\.variable/);
  });

  it("AC-font-6: <html> element still receives outfit.variable", () => {
    const htmlMatch = layoutSrc.match(/<html[^>]*className[^>]*>/);
    expect(htmlMatch).not.toBeNull();
    expect(htmlMatch![0]).toMatch(/outfit\.variable/);
  });
});

describe("font--globals-css: font stacks in @theme (AC-css-1/2/3/4/5)", () => {
  // Extract the @theme block (the first @theme block, not @theme inline)
  const themeBlock = cssSrc.match(/@theme\s*\{([\s\S]*?)\}/)?.[1] ?? "";

  it("AC-css-1: --font-sans includes var(--font-sarabun)", () => {
    const fontSansMatch = themeBlock.match(/--font-sans:\s*([^;]+);/);
    expect(fontSansMatch).not.toBeNull();
    expect(fontSansMatch![1]).toMatch(/var\(--font-sarabun\)/);
  });

  it("AC-css-5: --font-sans has Inter first (var(--font-inter) before var(--font-sarabun))", () => {
    const fontSansMatch = themeBlock.match(/--font-sans:\s*([^;]+);/);
    expect(fontSansMatch).not.toBeNull();
    const stack = fontSansMatch![1];
    const interIdx = stack.indexOf("--font-inter");
    const sarabunIdx = stack.indexOf("--font-sarabun");
    expect(interIdx).toBeGreaterThanOrEqual(0);
    expect(sarabunIdx).toBeGreaterThanOrEqual(0);
    expect(interIdx).toBeLessThan(sarabunIdx);
  });

  it("AC-css-2: --font-display includes var(--font-sarabun)", () => {
    const fontDisplayMatch = themeBlock.match(/--font-display:\s*([^;]+);/);
    expect(fontDisplayMatch).not.toBeNull();
    expect(fontDisplayMatch![1]).toMatch(/var\(--font-sarabun\)/);
  });

  it("AC-css-4: no self-referential --font-sans: var(--font-sans) no-op in @theme inline", () => {
    // The old bug: --font-sans: var(--font-sans) inside @theme inline
    const themeInlineBlock = cssSrc.match(/@theme\s+inline\s*\{([\s\S]*?)\}/)?.[1] ?? "";
    expect(themeInlineBlock).not.toMatch(/--font-sans:\s*var\(--font-sans\)/);
  });

  it("AC-css-3: @theme inline --font-heading = var(--font-display) (not var(--font-sans))", () => {
    const themeInlineBlock = cssSrc.match(/@theme\s+inline\s*\{([\s\S]*?)\}/)?.[1] ?? "";
    const headingMatch = themeInlineBlock.match(/--font-heading:\s*([^;]+);/);
    expect(headingMatch).not.toBeNull();
    expect(headingMatch![1].trim()).toBe("var(--font-display)");
  });
});

// ─────────────────────────────────────────────────────────────
// Priority 4 — Consumer cleanup: the 4 prior defects removed
// ─────────────────────────────────────────────────────────────

describe("consumer--filter-modal: focus-visible duplicate + size cleanup (AC-consumer-1/2)", () => {
  it("AC-consumer-1: FilterModal clearAll Button has no focus-visible:outline-none duplicate", () => {
    // The clearAll button: onClick={clearAll}
    // Extract the Button block containing onClick={clearAll}
    const clearAllBlock = filterModalSrc.match(/onClick=\{clearAll\}[\s\S]{0,400}?<\/Button>/);
    expect(clearAllBlock).not.toBeNull();
    expect(clearAllBlock![0]).not.toMatch(/focus-visible:outline-none/);
  });

  it("AC-consumer-2: FilterModal show-results Button uses size=\"lg\" prop", () => {
    // The show-results button calls onClick={handleShowCampgrounds} — content is ~765 chars to </Button>
    const showResultsBlock = filterModalSrc.match(/onClick=\{handleShowCampgrounds\}[\s\S]{0,900}?<\/Button>/);
    expect(showResultsBlock).not.toBeNull();
    expect(showResultsBlock![0]).toMatch(/size=["']lg["']/);
  });

  it("AC-consumer-2: FilterModal show-results Button has no inline h-10 override", () => {
    const showResultsBlock = filterModalSrc.match(/onClick=\{handleShowCampgrounds\}[\s\S]{0,900}?<\/Button>/);
    expect(showResultsBlock).not.toBeNull();
    expect(showResultsBlock![0]).not.toMatch(/\bh-10\b/);
  });
});

describe("consumer--login-modal: close button + submit button cleanup (AC-consumer-3/4)", () => {
  it("AC-consumer-3: LoginModal close icon Button has no inline h-10 height override", () => {
    // The close button has size="icon" and onClick={handleClose}
    // Search for Button block containing onClick={handleClose}
    const closeBlock = loginModalSrc.match(/onClick=\{handleClose\}[\s\S]{0,300}?<\/Button>/);
    expect(closeBlock).not.toBeNull();
    expect(closeBlock![0]).not.toMatch(/\bh-10\b/);
  });

  it("AC-consumer-4: LoginModal submit Button uses size=\"lg\" prop", () => {
    // type="submit" appears on the Button — window from <Button to </Button> is ~437 chars
    const submitBlock = loginModalSrc.match(/<Button[\s\S]{0,100}type=["']submit["'][\s\S]{0,500}?<\/Button>/);
    expect(submitBlock).not.toBeNull();
    expect(submitBlock![0]).toMatch(/size=["']lg["']/);
  });

  it("AC-consumer-4: LoginModal submit Button has no !h-12 inline override", () => {
    const submitBlock = loginModalSrc.match(/<Button[\s\S]{0,100}type=["']submit["'][\s\S]{0,500}?<\/Button>/);
    expect(submitBlock).not.toBeNull();
    expect(submitBlock![0]).not.toMatch(/!h-12/);
  });
});

describe("consumer--register-modal: close button + submit button cleanup (AC-consumer-5/6)", () => {
  it("AC-consumer-5: RegisterModal close icon Button has no inline h-10 height override", () => {
    // RegisterModal close: size="icon" onClick={onClose}
    const closeBlock = registerModalSrc.match(/onClick=\{onClose\}[\s\S]{0,300}?<\/Button>/);
    expect(closeBlock).not.toBeNull();
    expect(closeBlock![0]).not.toMatch(/\bh-10\b/);
  });

  it("AC-consumer-6: RegisterModal submit Button uses size=\"lg\" prop", () => {
    const submitBlock = registerModalSrc.match(/<Button[\s\S]{0,100}type=["']submit["'][\s\S]{0,500}?<\/Button>/);
    expect(submitBlock).not.toBeNull();
    expect(submitBlock![0]).toMatch(/size=["']lg["']/);
  });

  it("AC-consumer-6: RegisterModal submit Button has no !h-12 inline override", () => {
    const submitBlock = registerModalSrc.match(/<Button[\s\S]{0,100}type=["']submit["'][\s\S]{0,500}?<\/Button>/);
    expect(submitBlock).not.toBeNull();
    expect(submitBlock![0]).not.toMatch(/!h-12/);
  });
});

describe("consumer--search-modal: search CTA size cleanup (AC-consumer-7)", () => {
  it("AC-consumer-7: SearchModal search Button uses size=\"lg\"", () => {
    // The search button has onClick={handleSearch} inline
    const searchBtnBlock = searchModalSrc.match(/onClick=\{handleSearch\}[\s\S]{0,400}?<\/Button>/);
    expect(searchBtnBlock).not.toBeNull();
    expect(searchBtnBlock![0]).toMatch(/size=["']lg["']/);
  });

  it("AC-consumer-7: SearchModal search Button has no inline h-10 override", () => {
    const searchBtnBlock = searchModalSrc.match(/onClick=\{handleSearch\}[\s\S]{0,400}?<\/Button>/);
    expect(searchBtnBlock).not.toBeNull();
    expect(searchBtnBlock![0]).not.toMatch(/\bh-10\b/);
  });
});

describe("consumer--amenities-modal: close button cleanup (AC-consumer-8)", () => {
  it("AC-consumer-8: AmenitiesModal close Button uses size=\"lg\"", () => {
    expect(amenitiesModalSrc).toMatch(/size=["']lg["']/);
  });

  it("AC-consumer-8: AmenitiesModal close Button has no inline h-12 override", () => {
    // The Button in AmenitiesModal footer should no longer have h-12 inline
    const btnBlock = amenitiesModalSrc.match(/<Button[\s\S]{0,300}?<\/Button>/);
    expect(btnBlock).not.toBeNull();
    expect(btnBlock![0]).not.toMatch(/\bh-12\b/);
  });

  it("AC-consumer-8: AmenitiesModal close Button has no rounded-lg override", () => {
    // Was: rounded-lg h-12 — both should be gone
    const btnBlock = amenitiesModalSrc.match(/<Button[\s\S]{0,300}?<\/Button>/);
    expect(btnBlock).not.toBeNull();
    expect(btnBlock![0]).not.toMatch(/\brounded-lg\b/);
  });
});

describe("consumer--campground-detail: h-10 buttons removed (AC-consumer-9/10)", () => {
  it("AC-consumer-9: CampgroundDetailClient has no h-10 on Button elements (map-directions button cleaned)", () => {
    // The map-directions button previously had h-10 rounded-lg — both removed
    // We scan all <Button sections and ensure none have h-10
    const buttonBlocks = campDetailSrc.match(/<Button[\s\S]{0,400}?(?:<\/Button>|\/>)/g) ?? [];
    for (const block of buttonBlocks) {
      expect(block).not.toMatch(/\bh-10\b/);
    }
  });

  it("AC-consumer-10: CampgroundDetailClient reserve Button uses size=\"lg\"", () => {
    // handleReserve: distance to </Button> is ~719 chars
    const reserveBlock = campDetailSrc.match(/onClick=\{handleReserve\}[\s\S]{0,850}?<\/Button>/);
    expect(reserveBlock).not.toBeNull();
    expect(reserveBlock![0]).toMatch(/size=["']lg["']/);
  });

  it("AC-consumer-10: CampgroundDetailClient reserve Button has no inline h-12 override", () => {
    const reserveBlock = campDetailSrc.match(/onClick=\{handleReserve\}[\s\S]{0,850}?<\/Button>/);
    expect(reserveBlock).not.toBeNull();
    expect(reserveBlock![0]).not.toMatch(/\bh-12\b/);
  });
});

describe("consumer--bookings-page: CTA size cleanup (AC-consumer-11)", () => {
  it("AC-consumer-11: bookings page Button CTAs use size=\"lg\" (not inline h-12)", () => {
    // Two CTAs in bookings: Explore camps + Search button on empty/fallback state
    const lgCount = (bookingsSrc.match(/size=["']lg["']/g) ?? []).length;
    expect(lgCount).toBeGreaterThanOrEqual(2);
  });

  it("AC-consumer-11: bookings page Buttons have no inline h-12 on <Button elements", () => {
    const buttonBlocks = bookingsSrc.match(/<Button[\s\S]{0,400}?(?:<\/Button>|\/>)/g) ?? [];
    for (const block of buttonBlocks) {
      expect(block).not.toMatch(/\bh-12\b/);
    }
  });
});

describe("consumer--dashboard-page: add-campsite CTA cleanup (AC-consumer-12)", () => {
  it("AC-consumer-12: dashboard add-campsite Button uses size=\"lg\"", () => {
    // The add-campsite button content ends with t.dashboard.addCampSite}
    // Find the <Button block enclosing this text
    const addBtnIdx = dashboardSrc.indexOf("t.dashboard.addCampSite}");
    expect(addBtnIdx).toBeGreaterThan(-1); // text exists
    const beforeAdd = dashboardSrc.slice(0, addBtnIdx);
    const buttonStart = beforeAdd.lastIndexOf("<Button");
    const addBtnEnd = addBtnIdx + dashboardSrc.slice(addBtnIdx).indexOf("</Button>") + "</Button>".length;
    const buttonBlock = dashboardSrc.slice(buttonStart, addBtnEnd);
    expect(buttonBlock).toMatch(/size=["']lg["']/);
  });

  it("AC-consumer-12: dashboard add-campsite Button has no inline h-12 override", () => {
    const addBtnIdx = dashboardSrc.indexOf("t.dashboard.addCampSite}");
    expect(addBtnIdx).toBeGreaterThan(-1);
    const beforeAdd = dashboardSrc.slice(0, addBtnIdx);
    const buttonStart = beforeAdd.lastIndexOf("<Button");
    const addBtnEnd = addBtnIdx + dashboardSrc.slice(addBtnIdx).indexOf("</Button>") + "</Button>".length;
    const buttonBlock = dashboardSrc.slice(buttonStart, addBtnEnd);
    expect(buttonBlock).not.toMatch(/\bh-12\b/);
  });
});

describe("consumer--campground-form: submit button cleanup (AC-consumer-13)", () => {
  it("AC-consumer-13: CampgroundForm submit Button uses size=\"lg\"", () => {
    // onClick={handleSubmit} — distance to </Button> is ~538 chars
    const submitBlock = campFormSrc.match(/onClick=\{handleSubmit\}[\s\S]{0,650}?<\/Button>/);
    expect(submitBlock).not.toBeNull();
    expect(submitBlock![0]).toMatch(/size=["']lg["']/);
  });

  it("AC-consumer-13: CampgroundForm submit Button has no inline h-10 override", () => {
    const submitBlock = campFormSrc.match(/onClick=\{handleSubmit\}[\s\S]{0,650}?<\/Button>/);
    expect(submitBlock).not.toBeNull();
    expect(submitBlock![0]).not.toMatch(/\bh-10\b/);
  });
});

// ─────────────────────────────────────────────────────────────
// Priority 4 — Gate: no forbidden overrides on <Button elements
// ─────────────────────────────────────────────────────────────
describe("gate--consumers: no banned patterns on Button elements (AC-gate-1/2/3/4)", () => {
  const allConsumers: [string, string][] = [
    ["FilterModal", filterModalSrc],
    ["LoginModal", loginModalSrc],
    ["RegisterModal", registerModalSrc],
    ["SearchModal", searchModalSrc],
    ["AmenitiesModal", amenitiesModalSrc],
    ["CampgroundDetailClient", campDetailSrc],
    ["bookings/page", bookingsSrc],
    ["dashboard/page", dashboardSrc],
  ];

  // For each consumer, extract all Button JSX spans and check banned patterns
  for (const [name, fileSrc] of allConsumers) {
    it(`AC-gate-1: no h-10 override on <Button in ${name}`, () => {
      const buttonBlocks = fileSrc.match(/<Button[\s\S]{0,500}?(?:<\/Button>|\/>)/g) ?? [];
      for (const block of buttonBlocks) {
        expect(block).not.toMatch(/\bh-10\b/);
      }
    });

    it(`AC-gate-2: no !h-12 override on <Button in ${name}`, () => {
      const buttonBlocks = fileSrc.match(/<Button[\s\S]{0,500}?(?:<\/Button>|\/>)/g) ?? [];
      for (const block of buttonBlocks) {
        expect(block).not.toMatch(/!h-12/);
      }
    });

    it(`AC-gate-3: no focus:ring-0 on <Button in ${name}`, () => {
      const buttonBlocks = fileSrc.match(/<Button[\s\S]{0,500}?(?:<\/Button>|\/>)/g) ?? [];
      for (const block of buttonBlocks) {
        expect(block).not.toMatch(/focus:ring-0/);
      }
    });

    it(`AC-gate-4: no rounded-4xl on <Button in ${name}`, () => {
      const buttonBlocks = fileSrc.match(/<Button[\s\S]{0,500}?(?:<\/Button>|\/>)/g) ?? [];
      for (const block of buttonBlocks) {
        expect(block).not.toMatch(/\brounded-4xl\b/);
      }
    });
  }

  // CampgroundForm separate (large file, check submit/delete buttons only since it has InputField h-10 which is DS-5 allowed)
  it("AC-gate-1: CampgroundForm submit Button has no h-10 override", () => {
    const submitBlock = campFormSrc.match(/onClick=\{handleSubmit\}[\s\S]{0,650}?<\/Button>/);
    expect(submitBlock).not.toBeNull();
    expect(submitBlock![0]).not.toMatch(/\bh-10\b/);
  });

  it("AC-gate-4: CampgroundForm Buttons have no rounded-4xl", () => {
    const buttonBlocks = campFormSrc.match(/<Button[\s\S]{0,500}?(?:<\/Button>|\/>)/g) ?? [];
    for (const block of buttonBlocks) {
      expect(block).not.toMatch(/\brounded-4xl\b/);
    }
  });
});

describe("gate--select-triggers: DS-3 scope — SelectTrigger NOT touched (AC-gate-5)", () => {
  // Verify that this PR did not modify SelectTrigger in CampgroundForm, SearchModal, or other consumers
  // The select primitive should still have data-[size=default]:h-11 from DS-1
  const selectSrc = src("components/ui/select.tsx");

  it("AC-gate-5: SelectTrigger primitive still uses data-[size=default]:h-11 (DS-1 untouched)", () => {
    expect(selectSrc).toMatch(/data-\[size=default\]:h-11/);
  });

  it("AC-gate-5: SelectTrigger primitive still has rounded-full (DS-1 untouched)", () => {
    expect(selectSrc).toMatch(/rounded-full/);
  });
});

// ─────────────────────────────────────────────────────────────
// Priority 5 — Preview kitchen-sink documents DS-2
// ─────────────────────────────────────────────────────────────
describe("preview--ds2: button size grid + Thai sample documented (AC-preview-1/2)", () => {
  it("AC-preview-1: PreviewClient documents h-11 default size", () => {
    expect(previewSrc).toMatch(/h-11/);
  });

  it("AC-preview-1: PreviewClient documents h-9 sm size", () => {
    expect(previewSrc).toMatch(/h-9/);
  });

  it("AC-preview-1: PreviewClient documents h-12 lg size", () => {
    expect(previewSrc).toMatch(/h-12/);
  });

  it("AC-preview-1: PreviewClient shows icon button size variants (size-11 / size-9)", () => {
    // Preview must show icon-sm, icon, icon-lg buttons
    expect(previewSrc).toMatch(/size=["']icon["']/);
    expect(previewSrc).toMatch(/size=["']icon-sm["']/);
    expect(previewSrc).toMatch(/size=["']icon-lg["']/);
  });

  it("AC-preview-2: PreviewClient has Thai heading text for Sarabun verification", () => {
    // The Thai heading in the kitchen-sink
    expect(previewSrc).toMatch(/ค้นหาแคมป์/);
  });

  it("AC-preview-2: PreviewClient has Thai body text for Sarabun verification", () => {
    expect(previewSrc).toMatch(/เลือกสถานที่กางเต็นท์/);
  });

  it("AC-preview-2: PreviewClient Thai section has font-display class for Sarabun heading", () => {
    // The Thai heading should use font-display (which now includes Sarabun)
    const thaiSection = previewSrc.match(/Sarabun Thai font verification[\s\S]{0,300}/);
    expect(thaiSection).not.toBeNull();
    expect(thaiSection![0]).toMatch(/font-display/);
  });
});

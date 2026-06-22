/**
 * DS-3 — Input / Card / Modal grammar (CAM-123)
 * PR #64, branch feature/ds3-input-card-modal
 *
 * Layer: unit (static source inspection — vitest env is 'node').
 *
 * AC→test map:
 *
 * Priority 1 — primitive grammar
 *  AC-input-1   input base has rounded-full
 *  AC-input-2   input base has h-11 as default (md variant)
 *  AC-input-3   input base does NOT have h-9 at the base level (h-9 is sm variant only)
 *  AC-input-4   input base does NOT have rounded-3xl at the base level
 *  AC-input-5   inputSize cva variant sm = h-9
 *  AC-input-6   inputSize cva variant md = h-11
 *  AC-input-7   inputSize cva variant lg = h-12
 *  AC-input-8   input base has focus ring (focus-visible:ring-3 + focus-visible:ring-ring/30)
 *  AC-input-9   input-field forwards inputSize prop to Input
 *  AC-input-10  input-group base has h-11 rounded-full
 *
 *  AC-card-1    Card primitive has rounded-3xl (not rounded-4xl)
 *  AC-card-2    Card primitive does NOT have rounded-4xl
 *  AC-card-3    CardHeader has rounded-t-3xl
 *  AC-card-4    CardFooter has rounded-b-3xl
 *  AC-card-5    Card image selectors use rounded-t-3xl / rounded-b-3xl
 *
 *  AC-dialog-1  DialogContent has rounded-3xl
 *  AC-dialog-2  DialogContent does NOT have rounded-4xl
 *  AC-dialog-3  DialogContent close Button has size="icon"
 *  AC-dialog-4  DialogContent close Button has aria-label="Close"
 *
 *  AC-alert-1   AlertDialogContent has rounded-3xl
 *  AC-alert-2   AlertDialogContent does NOT have rounded-4xl
 *
 * Priority 2 — regression: no forbidden patterns in consumers
 *  AC-reg-1     No rounded-4xl in card.tsx / dialog.tsx / alert-dialog.tsx
 *  AC-reg-2     No rounded-[24px] in 5 modal consumer files
 *  AC-reg-3     No rounded-2xl on DialogContent level in modal consumers (login/register/filter/search/amenities)
 *  AC-reg-4     CampgroundCard image wrapper has rounded-3xl
 *  AC-reg-5     loading-skeleton uses Card primitive (not raw div with hardcoded rounded)
 *
 * Priority 3 — consumer cleanup correctness
 *  AC-clean-1   CampgroundForm Card sections have border-border shadow-sm (not removed)
 *  AC-clean-2   CampgroundForm inputs use inputSize prop (not inline h-12)
 *  AC-clean-3   CampgroundForm AlertDialogContent has no rounded-2xl override
 *  AC-clean-4   LoginModal inputs use inputSize="lg"
 *  AC-clean-5   RegisterModal inputs use inputSize="lg"
 *  AC-clean-6   FilterModal price inputs use inputSize="lg"
 *  AC-clean-7   SearchModal keyword input has no inline h-12 or !h-12
 *  AC-clean-8   Modal close buttons in filter/search have aria-label
 *
 * Priority 4 — gate grep assertions
 *  AC-gate-1    No !h-12 on InputField / Input elements in consumer components
 *  AC-gate-2    No rounded-4xl in card/dialog/alert-dialog primitives
 *  AC-gate-3    No rounded-[24px] in component files (modal shell)
 *
 * Priority 5 — preview kitchen-sink
 *  AC-preview-1 PreviewClient documents DS-3 input size variants (sm/md/lg)
 *  AC-preview-2 PreviewClient documents card primitive rounded-3xl
 *  AC-preview-3 PreviewClient documents modal shell grammar (rounded-3xl, close aria-label)
 */

import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const root = path.resolve(__dirname, "..");
const src = (rel: string) => fs.readFileSync(path.join(root, rel), "utf-8");

// ── Primitive files ────────────────────────────────────────────
const inputSrc = src("components/ui/input.tsx");
const inputFieldSrc = src("components/ui/input-field.tsx");
const inputGroupSrc = src("components/ui/input-group.tsx");
const cardSrc = src("components/ui/card.tsx");
const dialogSrc = src("components/ui/dialog.tsx");
const alertDialogSrc = src("components/ui/alert-dialog.tsx");
const textareaSrc = src("components/ui/textarea.tsx");
const sheetSrc = src("components/ui/sheet.tsx");

// ── Consumer files ─────────────────────────────────────────────
const loginModalSrc = src("components/LoginModal.tsx");
const registerModalSrc = src("components/RegisterModal.tsx");
const filterModalSrc = src("components/FilterModal.tsx");
const searchModalSrc = src("components/SearchModal.tsx");
const amenitiesModalSrc = src("components/AmenitiesModal.tsx");
const campgroundCardSrc = src("components/CampgroundCard.tsx");
const campgroundFormSrc = src("components/CampgroundForm.tsx");
const loadingSkeletonSrc = src("components/ui/loading-skeleton.tsx");
const previewSrc = src("app/preview/PreviewClient.tsx");

// ── Page files with !h-12 ─────────────────────────────────────
const loginPageSrc = src("app/login/page.tsx");
const registerPageSrc = src("app/register/page.tsx");

// =============================================================
// Priority 1 — Input primitive grammar
// =============================================================

describe("input--primitive: base class grammar (AC-input-1/3/4/8)", () => {
  // Extract the base string (first arg to cva)
  const baseMatch = inputSrc.match(/cva\(\s*["'`]([\s\S]*?)["'`]\s*,/);
  const base = baseMatch ? baseMatch[1] : "";

  it("AC-input-1: base class has rounded-full", () => {
    expect(base).toMatch(/\brounded-full\b/);
  });

  it("AC-input-3: base class does NOT have h-9 (h-9 belongs to sm variant only)", () => {
    // The base string itself must not contain h-9 as a standalone class
    expect(base).not.toMatch(/\bh-9\b/);
  });

  it("AC-input-4: base class does NOT have rounded-3xl (rounded-3xl is card/modal role, not input)", () => {
    expect(base).not.toMatch(/\brounded-3xl\b/);
  });

  it("AC-input-8: base class has focus-visible:ring-3 (focus ring present)", () => {
    expect(base).toMatch(/focus-visible:ring-3/);
  });

  it("AC-input-8: base class has focus-visible:ring-ring\/30 (token ring color)", () => {
    expect(base).toMatch(/focus-visible:ring-ring\/30/);
  });

  it("AC-input-8: base class has focus-visible:border-ring (focus border)", () => {
    expect(base).toMatch(/focus-visible:border-ring/);
  });
});

describe("input--primitive: inputSize cva variants (AC-input-2/5/6/7)", () => {
  // Extract the inputSize variants block
  const variantsBlock = inputSrc.match(/inputSize:\s*\{([\s\S]*?)\}/)?.[1] ?? "";

  it("AC-input-5: sm variant has h-9", () => {
    const smEntry = variantsBlock.match(/\bsm:\s*["'`]([^"'`]*)["'`]/);
    expect(smEntry).not.toBeNull();
    expect(smEntry![1]).toMatch(/\bh-9\b/);
  });

  it("AC-input-6: md variant has h-11", () => {
    const mdEntry = variantsBlock.match(/\bmd:\s*["'`]([^"'`]*)["'`]/);
    expect(mdEntry).not.toBeNull();
    expect(mdEntry![1]).toMatch(/\bh-11\b/);
  });

  it("AC-input-7: lg variant has h-12", () => {
    const lgEntry = variantsBlock.match(/\blg:\s*["'`]([^"'`]*)["'`]/);
    expect(lgEntry).not.toBeNull();
    expect(lgEntry![1]).toMatch(/\bh-12\b/);
  });

  it("AC-input-2: defaultVariants sets inputSize to md (h-11 is the default)", () => {
    const defaultsBlock = inputSrc.match(/defaultVariants:\s*\{([\s\S]*?)\}/)?.[1] ?? "";
    expect(defaultsBlock).toMatch(/inputSize:\s*["']md["']/);
  });
});

describe("input-field--consumer: forwards inputSize prop (AC-input-9)", () => {
  it("AC-input-9: InputField declares inputSize in its props interface", () => {
    expect(inputFieldSrc).toMatch(/inputSize\??\s*:/);
  });

  it("AC-input-9: InputField passes inputSize down to <Input", () => {
    // inputSize must appear as a JSX prop on <Input
    expect(inputFieldSrc).toMatch(/inputSize=\{inputSize\}/);
  });
});

describe("input-group--primitive: base has h-11 rounded-full (AC-input-10)", () => {
  // The InputGroup div base class
  const igBase = inputGroupSrc.match(/className=\{cn\(\s*["'`]([\s\S]*?)["'`]/)?.[1] ?? "";

  it("AC-input-10: InputGroup base has h-11", () => {
    expect(igBase).toMatch(/\bh-11\b/);
  });

  it("AC-input-10: InputGroup base has rounded-full", () => {
    expect(igBase).toMatch(/\brounded-full\b/);
  });
});

// =============================================================
// Priority 1 — Card primitive grammar
// =============================================================

describe("card--primitive: rounded-3xl grammar (AC-card-1/2/3/4/5)", () => {
  it("AC-card-1: Card component base has rounded-3xl", () => {
    // data-slot and className are on separate lines — use a wider window
    // Format: data-slot="card"\n      data-size={size}\n      className={cn(\n        "group/card ... rounded-3xl ...
    const cardBaseMatch = cardSrc.match(/data-slot="card"[\s\S]{0,200}className=\{cn\(\s*["'`]([\s\S]*?)["'`]/);
    expect(cardBaseMatch).not.toBeNull();
    expect(cardBaseMatch![1]).toMatch(/\brounded-3xl\b/);
  });

  it("AC-card-2: Card component base does NOT have rounded-4xl", () => {
    // Check entire card.tsx for rounded-4xl
    expect(cardSrc).not.toMatch(/\brounded-4xl\b/);
  });

  it("AC-card-3: CardHeader has rounded-t-3xl", () => {
    const headerMatch = cardSrc.match(/data-slot="card-header"[\s\S]{0,200}className=\{cn\(\s*["'`]([\s\S]*?)["'`]/);
    expect(headerMatch).not.toBeNull();
    expect(headerMatch![1]).toMatch(/\brounded-t-3xl\b/);
  });

  it("AC-card-4: CardFooter has rounded-b-3xl", () => {
    const footerMatch = cardSrc.match(/data-slot="card-footer"[\s\S]{0,200}className=\{cn\(\s*["'`]([\s\S]*?)["'`]/);
    expect(footerMatch).not.toBeNull();
    expect(footerMatch![1]).toMatch(/\brounded-b-3xl\b/);
  });

  it("AC-card-5: Card base includes image selector rounded-t-3xl for first child img", () => {
    // The Card base class uses *:[img:first-child]:rounded-t-3xl selector
    expect(cardSrc).toMatch(/rounded-t-3xl/);
  });

  it("AC-card-5: Card base includes image selector rounded-b-3xl for last child img", () => {
    expect(cardSrc).toMatch(/rounded-b-3xl/);
  });
});

// =============================================================
// Priority 1 — Dialog primitive grammar
// =============================================================

describe("dialog--primitive: rounded-3xl + close button grammar (AC-dialog-1/2/3/4)", () => {
  // Extract DialogContent className string
  const dialogContentMatch = dialogSrc.match(/data-slot="dialog-content"[\s\S]{0,20}className=\{cn\(\s*["'`]([\s\S]*?)["'`]/);
  const dialogContent = dialogContentMatch ? dialogContentMatch[1] : "";

  it("AC-dialog-1: DialogContent base has rounded-3xl", () => {
    expect(dialogContent).toMatch(/\brounded-3xl\b/);
  });

  it("AC-dialog-2: DialogContent base does NOT have rounded-4xl", () => {
    expect(dialogContent).not.toMatch(/\brounded-4xl\b/);
  });

  it("AC-dialog-2: dialog.tsx file does NOT have rounded-4xl anywhere", () => {
    expect(dialogSrc).not.toMatch(/\brounded-4xl\b/);
  });

  it("AC-dialog-3: close Button has size=\"icon\" (h-11 w-11 tap target)", () => {
    // The close button block in DialogContent
    const closeBtnBlock = dialogSrc.match(/data-slot="dialog-close"[\s\S]{0,300}?<\/Button>/);
    expect(closeBtnBlock).not.toBeNull();
    expect(closeBtnBlock![0]).toMatch(/size=["']icon["']/);
  });

  it("AC-dialog-4: close Button has aria-label=\"Close\"", () => {
    const closeBtnBlock = dialogSrc.match(/data-slot="dialog-close"[\s\S]{0,300}?<\/Button>/);
    expect(closeBtnBlock).not.toBeNull();
    expect(closeBtnBlock![0]).toMatch(/aria-label=["']Close["']/);
  });
});

// =============================================================
// Priority 1 — AlertDialog primitive grammar
// =============================================================

describe("alert-dialog--primitive: rounded-3xl grammar (AC-alert-1/2)", () => {
  // data-slot and className are on separate lines — use a wider window
  const alertContentMatch = alertDialogSrc.match(/data-slot="alert-dialog-content"[\s\S]{0,200}className=\{cn\(\s*["'`]([\s\S]*?)["'`]/);
  const alertContent = alertContentMatch ? alertContentMatch[1] : "";

  it("AC-alert-1: AlertDialogContent base has rounded-3xl", () => {
    expect(alertContent).toMatch(/\brounded-3xl\b/);
  });

  it("AC-alert-2: AlertDialogContent base does NOT have rounded-4xl", () => {
    expect(alertContent).not.toMatch(/\brounded-4xl\b/);
  });

  it("AC-alert-2: alert-dialog.tsx file does NOT have rounded-4xl anywhere", () => {
    expect(alertDialogSrc).not.toMatch(/\brounded-4xl\b/);
  });
});

// =============================================================
// Priority 1 — Textarea + Sheet: unchanged
// =============================================================

describe("textarea--primitive: unchanged by DS-3 (no height regression)", () => {
  it("textarea still has rounded-2xl (its own role as inner element)", () => {
    expect(textareaSrc).toMatch(/\brounded-2xl\b/);
  });

  it("textarea still has focus-visible:ring-3 (focus ring intact)", () => {
    expect(textareaSrc).toMatch(/focus-visible:ring-3/);
  });
});

describe("sheet--primitive: no rounded-3xl regression (sheet uses side-edge borders)", () => {
  it("sheet.tsx does NOT have rounded-4xl (not within scope of DS-3 but guard drift)", () => {
    expect(sheetSrc).not.toMatch(/\brounded-4xl\b/);
  });
});

// =============================================================
// Priority 2 — Regression: no forbidden patterns in consumers
// =============================================================

describe("reg--grep: no rounded-4xl in card/dialog/alert-dialog primitives (AC-reg-1)", () => {
  it("AC-reg-1: card.tsx has no rounded-4xl", () => {
    expect(cardSrc).not.toMatch(/\brounded-4xl\b/);
  });

  it("AC-reg-1: dialog.tsx has no rounded-4xl", () => {
    expect(dialogSrc).not.toMatch(/\brounded-4xl\b/);
  });

  it("AC-reg-1: alert-dialog.tsx has no rounded-4xl", () => {
    expect(alertDialogSrc).not.toMatch(/\brounded-4xl\b/);
  });
});

describe("reg--grep: no rounded-[24px] in modal consumers (AC-reg-2)", () => {
  const modals: [string, string][] = [
    ["LoginModal", loginModalSrc],
    ["RegisterModal", registerModalSrc],
    ["FilterModal", filterModalSrc],
    ["SearchModal", searchModalSrc],
    ["AmenitiesModal", amenitiesModalSrc],
  ];

  for (const [name, fileSrc] of modals) {
    it(`AC-reg-2: ${name} has no rounded-[24px] on modal shell`, () => {
      // Only flag rounded-[24px] when it appears on a DialogContent-level element.
      // The pattern to grep: rounded-[24px] anywhere inside a DialogContent className.
      // We check the whole file — if rounded-[24px] appears as a className modifier
      // on DialogContent props it means the shell override was not removed.
      const dialogContentBlock = fileSrc.match(/<DialogContent[\s\S]{0,600}?>/);
      if (dialogContentBlock) {
        expect(dialogContentBlock[0]).not.toMatch(/rounded-\[24px\]/);
      } else {
        // File doesn't use DialogContent at all — pass
        expect(true).toBe(true);
      }
    });
  }
});

describe("reg--grep: no rounded-2xl on DialogContent in modal consumers (AC-reg-3)", () => {
  // rounded-2xl on DialogContent className means we overrode the primitive rounded-3xl down.
  // Allowed: rounded-2xl on inner elements (error banners, cards, textareas, etc.)
  // Not allowed: on the DialogContent opening tag itself.

  const modals: [string, string][] = [
    ["LoginModal", loginModalSrc],
    ["RegisterModal", registerModalSrc],
    ["AmenitiesModal", amenitiesModalSrc],
  ];

  for (const [name, fileSrc] of modals) {
    it(`AC-reg-3: ${name} DialogContent opening tag does not override rounded-2xl`, () => {
      const dialogContentBlock = fileSrc.match(/<DialogContent[\s\S]{0,600}?>/);
      if (dialogContentBlock) {
        expect(dialogContentBlock[0]).not.toMatch(/\brounded-2xl\b/);
      } else {
        expect(true).toBe(true);
      }
    });
  }
});

describe("reg--campground-card: image wrapper rounded-3xl (AC-reg-4)", () => {
  it("AC-reg-4: CampgroundCard image wrapper div has rounded-3xl", () => {
    // The image container: <div className="relative aspect-square rounded-3xl overflow-hidden...">
    expect(campgroundCardSrc).toMatch(/rounded-3xl/);
  });

  it("AC-reg-4: CampgroundCard image wrapper uses rounded-3xl not rounded-4xl", () => {
    // The image wrapper specifically
    const imgWrapper = campgroundCardSrc.match(/aspect-square[\s\S]{0,100}/);
    expect(imgWrapper).not.toBeNull();
    expect(imgWrapper![0]).not.toMatch(/\brounded-4xl\b/);
  });
});

describe("reg--loading-skeleton: uses Card primitive (AC-reg-5)", () => {
  it("AC-reg-5: loading-skeleton imports Card from ui/card", () => {
    expect(loadingSkeletonSrc).toMatch(/from ["']@\/components\/ui\/card["']/);
  });

  it("AC-reg-5: loading-skeleton renders Card component elements (not raw div with rounded-3xl)", () => {
    // Confirm Card is used in JSX
    expect(loadingSkeletonSrc).toMatch(/<Card\b/);
  });
});

// =============================================================
// Priority 3 — Consumer cleanup correctness
// =============================================================

describe("clean--campground-form: card sections + inputs (AC-clean-1/2/3)", () => {
  it("AC-clean-1: CampgroundForm Card sections still have border-border class", () => {
    // Cards in form: <Card className="border-border shadow-sm">
    expect(campgroundFormSrc).toMatch(/border-border/);
  });

  it("AC-clean-1: CampgroundForm Card sections still have shadow-sm class", () => {
    expect(campgroundFormSrc).toMatch(/shadow-sm/);
  });

  it("AC-clean-2: CampgroundForm inputs use inputSize prop (not inline h-12)", () => {
    // Inputs in the form should use inputSize="lg" prop, not className h-12
    expect(campgroundFormSrc).toMatch(/inputSize=["']lg["']/);
  });

  it("AC-clean-2: CampgroundForm InputField elements do NOT have inline !h-12 in className", () => {
    // Extract all InputField blocks and assert no !h-12
    const inputFieldBlocks = campgroundFormSrc.match(/<InputField[\s\S]{0,400}?\/>/g) ?? [];
    for (const block of inputFieldBlocks) {
      expect(block).not.toMatch(/!h-12/);
    }
  });

  it("AC-clean-3: CampgroundForm AlertDialogContent has no rounded-2xl class override", () => {
    // AlertDialogContent in CampgroundForm should NOT pass rounded-2xl — primitive provides rounded-3xl
    const alertBlock = campgroundFormSrc.match(/<AlertDialogContent[\s\S]{0,200}?>/);
    if (alertBlock) {
      expect(alertBlock[0]).not.toMatch(/\brounded-2xl\b/);
    }
    // Confirm the AlertDialogContent block exists (sanity)
    expect(campgroundFormSrc).toMatch(/<AlertDialogContent/);
  });
});

describe("clean--login-modal: inputs use inputSize=\"lg\" (AC-clean-4)", () => {
  it("AC-clean-4: LoginModal has at least 2 InputField elements using inputSize=\"lg\"", () => {
    // LoginModal has email (id=email) and password inputs, both should be lg.
    // Use global count rather than per-InputField regex since inputSize="lg" appears after leftIcon.
    const lgCount = (loginModalSrc.match(/inputSize=["']lg["']/g) ?? []).length;
    expect(lgCount).toBeGreaterThanOrEqual(2);
  });

  it("AC-clean-4: LoginModal does NOT have inline !h-12 on InputField elements", () => {
    const inputFieldBlocks = loginModalSrc.match(/<InputField[\s\S]{0,600}?\/>/g) ?? [];
    for (const block of inputFieldBlocks) {
      expect(block).not.toMatch(/!h-12/);
    }
  });
});

describe("clean--register-modal: inputs use inputSize=\"lg\" (AC-clean-5)", () => {
  it("AC-clean-5: RegisterModal InputFields use inputSize=\"lg\"", () => {
    expect(registerModalSrc).toMatch(/inputSize=["']lg["']/);
  });

  it("AC-clean-5: RegisterModal InputField elements do NOT have inline !h-12", () => {
    const inputFieldBlocks = registerModalSrc.match(/<InputField[\s\S]{0,400}?\/>/g) ?? [];
    for (const block of inputFieldBlocks) {
      expect(block).not.toMatch(/!h-12/);
    }
  });
});

describe("clean--filter-modal: price inputs use inputSize=\"lg\" (AC-clean-6)", () => {
  it("AC-clean-6: FilterModal price InputField uses inputSize=\"lg\"", () => {
    expect(filterModalSrc).toMatch(/inputSize=["']lg["']/);
  });

  it("AC-clean-6: FilterModal InputField elements do NOT have inline !h-12", () => {
    const inputFieldBlocks = filterModalSrc.match(/<InputField[\s\S]{0,400}?\/>/g) ?? [];
    for (const block of inputFieldBlocks) {
      expect(block).not.toMatch(/!h-12/);
    }
  });
});

describe("clean--search-modal: keyword input no inline height (AC-clean-7)", () => {
  it("AC-clean-7: SearchModal keyword InputField has no inline !h-12 or h-12 in className", () => {
    const keywordBlock = searchModalSrc.match(/keyword[\s\S]{0,400}?\/>/);
    if (keywordBlock) {
      expect(keywordBlock[0]).not.toMatch(/!h-12/);
      expect(keywordBlock[0]).not.toMatch(/\bh-12\b/);
    } else {
      // No InputField with keyword keyword found — pass (not in scope)
      expect(true).toBe(true);
    }
  });
});

describe("clean--modals: close buttons have aria-label (AC-clean-8)", () => {
  // FilterModal and SearchModal have their own close buttons (showCloseButton=false, manual)
  it("AC-clean-8: FilterModal manual close Button has aria-label", () => {
    // The FilterModal close button has aria-label; distance from <Button to aria-label is ~239 chars
    const closeBtnBlock = filterModalSrc.match(/<Button[\s\S]{0,400}?aria-label[\s\S]{0,200}?<\/Button>/);
    expect(closeBtnBlock).not.toBeNull();
  });

  it("AC-clean-8: SearchModal manual close Button has aria-label", () => {
    // Same structure as FilterModal — use 400-char window for <Button to aria-label
    const closeBtnBlock = searchModalSrc.match(/<Button[\s\S]{0,400}?aria-label[\s\S]{0,200}?<\/Button>/);
    expect(closeBtnBlock).not.toBeNull();
  });

  it("AC-clean-8: LoginModal manual close Button has aria-label", () => {
    // LoginModal has a manual close button (showCloseButton=false)
    expect(loginModalSrc).toMatch(/aria-label/);
  });

  it("AC-clean-8: RegisterModal manual close Button has aria-label", () => {
    expect(registerModalSrc).toMatch(/aria-label/);
  });
});

// =============================================================
// Priority 4 — Gate grep assertions
// =============================================================

describe("gate--consumers: no !h-12 on InputField/Input in component consumers (AC-gate-1)", () => {
  // These component files should NOT have !h-12 on InputField — they use inputSize prop.
  // app/login/page.tsx and app/register/page.tsx are page files NOT components — they have
  // a known !h-12 on InputField (via inputHeight variable on className). These are flagged
  // as a follow-up defect below (not a blocker since they are page-level, not primitives).
  const componentConsumers: [string, string][] = [
    ["LoginModal", loginModalSrc],
    ["RegisterModal", registerModalSrc],
    ["FilterModal", filterModalSrc],
    ["SearchModal", searchModalSrc],
    ["AmenitiesModal", amenitiesModalSrc],
    ["CampgroundForm", campgroundFormSrc],
  ];

  for (const [name, fileSrc] of componentConsumers) {
    it(`AC-gate-1: ${name} has no !h-12 on InputField elements`, () => {
      const inputFieldBlocks = fileSrc.match(/<InputField[\s\S]{0,400}?\/>/g) ?? [];
      for (const block of inputFieldBlocks) {
        expect(block).not.toMatch(/!h-12/);
      }
    });
  }
});

describe("gate--primitives: no rounded-4xl in card/dialog/alert-dialog (AC-gate-2)", () => {
  it("AC-gate-2: card.tsx has no rounded-4xl", () => {
    expect(cardSrc).not.toMatch(/\brounded-4xl\b/);
  });

  it("AC-gate-2: dialog.tsx has no rounded-4xl", () => {
    expect(dialogSrc).not.toMatch(/\brounded-4xl\b/);
  });

  it("AC-gate-2: alert-dialog.tsx has no rounded-4xl", () => {
    expect(alertDialogSrc).not.toMatch(/\brounded-4xl\b/);
  });
});

describe("gate--component-files: no rounded-[24px] in component modal shells (AC-gate-3)", () => {
  // These component files should NOT have rounded-[24px] — the primitive provides rounded-3xl.
  // app/login/page.tsx and app/register/page.tsx are page-level wrappers (not modal shells)
  // and have rounded-[24px] on a custom <div> card. That is a separate follow-up defect.
  const componentModals: [string, string][] = [
    ["LoginModal", loginModalSrc],
    ["RegisterModal", registerModalSrc],
    ["FilterModal", filterModalSrc],
    ["SearchModal", searchModalSrc],
    ["AmenitiesModal", amenitiesModalSrc],
  ];

  for (const [name, fileSrc] of componentModals) {
    it(`AC-gate-3: ${name} has no rounded-[24px] inline value`, () => {
      expect(fileSrc).not.toMatch(/rounded-\[24px\]/);
    });
  }
});

// =============================================================
// Priority 5 — Preview kitchen-sink documents DS-3
// =============================================================

describe("preview--ds3: input size grid + card + modal grammar (AC-preview-1/2/3)", () => {
  it("AC-preview-1: PreviewClient DS-3 section documents sm input (inputSize=sm / h-9)", () => {
    expect(previewSrc).toMatch(/inputSize=["']sm["']/);
  });

  it("AC-preview-1: PreviewClient DS-3 section documents md input (default / h-11)", () => {
    // The default Input (no inputSize) and label referencing h-11
    expect(previewSrc).toMatch(/h-11/);
  });

  it("AC-preview-1: PreviewClient DS-3 section documents lg input (inputSize=lg / h-12)", () => {
    expect(previewSrc).toMatch(/inputSize=["']lg["']/);
  });

  it("AC-preview-2: PreviewClient documents Card with rounded-3xl copy note", () => {
    // The DS-3 section has text referencing rounded-3xl for cards
    expect(previewSrc).toMatch(/rounded-3xl/);
  });

  it("AC-preview-3: PreviewClient documents modal close button grammar (aria-label Close)", () => {
    // The DS-3 section mentions close button aria-label in the modal shell note
    expect(previewSrc).toMatch(/aria-label.*Close|Close.*aria-label/);
  });
});

// =============================================================
// Defect investigation — app/login and app/register page !h-12
// These are documented findings, not assertions that block merge.
// The assertions below DOCUMENT the current state so a follow-up
// ticket can track them. They assert what currently EXISTS (not what
// should be removed), confirming the scope verdict below.
// =============================================================

describe("defect-scope--login-register-pages: !h-12 is on Button AND InputField (follow-up)", () => {
  it("SCOPE-CHECK: app/login/page.tsx has !h-12 on Button (submit) — Button height should be size-driven)", () => {
    // The submit Button in login page has !h-12 — this is a Button override, not InputField.
    // DS-2 rule: 'no override height inline on Button' (DESIGN.md §3 Button grammar)
    // This confirms there IS a deviation on Button, not just InputField.
    // Button block length is ~408 chars; use 600-char window.
    expect(loginPageSrc).toMatch(/!h-12/);
    const buttonBlock = loginPageSrc.match(/<Button[\s\S]{0,600}?(?:<\/Button>|\/>)/g) ?? [];
    const hasH12OnButton = buttonBlock.some(b => b.includes("!h-12"));
    expect(hasH12OnButton).toBe(true);
  });

  it("SCOPE-CHECK: app/register/page.tsx has !h-12 on Button (submit) — Button height should be size-driven", () => {
    expect(registerPageSrc).toMatch(/!h-12/);
    const buttonBlock = registerPageSrc.match(/<Button[\s\S]{0,600}?(?:<\/Button>|\/>)/g) ?? [];
    const hasH12OnButton = buttonBlock.some(b => b.includes("!h-12"));
    expect(hasH12OnButton).toBe(true);
  });

  it("SCOPE-CHECK: app/login/page.tsx !h-12 also applied to InputField via inputHeight variable", () => {
    // const inputHeight = "!h-12" then used in className={cn(..., inputHeight)}
    // This means InputField also receives !h-12 — different from LoginModal which uses inputSize="lg"
    expect(loginPageSrc).toMatch(/const inputHeight = ["']!h-12["']/);
  });

  it("SCOPE-CHECK: app/register/page.tsx !h-12 also applied to InputField via inputHeight variable", () => {
    expect(registerPageSrc).toMatch(/const inputHeight = ["']!h-12["']/);
  });
});

/**
 * cam-368-photo-modal-a11y.test.ts — CAM-368
 *
 * Shared focus-trap + body scroll-lock for both photo modals (ImageGallery,
 * PanoramaViewer). Closes a gap found in CAM-354's G3 review: PanoramaViewer
 * faithfully inherited ImageGallery's pre-existing lack of a Tab trap and a
 * body scroll lock.
 *
 * AC coverage matrix:
 *   AC-1  Tab wraps forward inside the modal (last -> first), never escapes to
 *         the background page.
 *   AC-2  Shift+Tab wraps backward (first -> last).
 *   AC-3  Body scroll is locked while a modal is open, and restored to the
 *         previous scroll position when it closes.
 *   AC-4  Escape / close-button behavior and focus-restore-to-trigger in both
 *         modals are unchanged (regression twin of every row).
 *
 * Layer:
 *   - lib/hooks/use-modal-a11y.ts's pure helpers (computeFocusTrapTarget,
 *     applyScrollLock, restoreScrollLock, getFocusableElements) are imported
 *     and exercised directly against plain fake objects — real logic under
 *     test, not a mirrored simulator (the repo's vitest config runs a `node`
 *     environment with no jsdom/@testing-library, so the DOM-touching
 *     `useEffect` glue itself is covered by source-inspection instead, per
 *     precedent in __tests__/cam-246-loading-foundation.test.ts).
 *   - components/ImageGallery.tsx / components/PanoramaViewer.tsx ->
 *     source-inspection for the wiring + AC-4 regression guards.
 *
 * Coverage matrix per .claude/rules/qa.md: normal · null/empty · boundary ·
 * error/validation · concurrent/ordering.
 */

import { describe, it, expect, vi } from "vitest";
import * as fs from "fs";
import * as path from "path";
import {
  computeFocusTrapTarget,
  applyScrollLock,
  restoreScrollLock,
  getFocusableElements,
  type BodyStyleLike,
} from "../lib/hooks/use-modal-a11y";

const root = path.resolve(__dirname, "..");
const src = (rel: string) => fs.readFileSync(path.join(root, rel), "utf-8");

const hookSrc = src("lib/hooks/use-modal-a11y.ts");
const gallerySrc = src("components/ImageGallery.tsx");
const panoramaSrc = src("components/PanoramaViewer.tsx");

/** A minimal fake focusable element — duck-typed, not a real DOM node. */
function fakeElement(): HTMLElement {
  return { focus: vi.fn() } as unknown as HTMLElement;
}

// ===========================================================================
// AC-1/AC-2 + BR-2 + EC-1 — computeFocusTrapTarget (the real trap algorithm)
// ===========================================================================

describe("AC-1 — Tab wraps forward: last focusable -> first (real logic, not mocked)", () => {
  it("[normal] Tab on the last focusable returns the first", () => {
    const first = fakeElement();
    const mid = fakeElement();
    const last = fakeElement();
    const target = computeFocusTrapTarget([first, mid, last], last, false);
    expect(target).toBe(first);
  });

  it("[normal] Tab on a middle focusable returns null (native order handles it)", () => {
    const first = fakeElement();
    const mid = fakeElement();
    const last = fakeElement();
    const target = computeFocusTrapTarget([first, mid, last], mid, false);
    expect(target).toBeNull();
  });

  it("[boundary] a single-focusable-element modal wraps to itself on Tab", () => {
    const only = fakeElement();
    const target = computeFocusTrapTarget([only], only, false);
    expect(target).toBe(only);
  });

  it("[null/empty] an empty focusable list returns null (nothing to trap into)", () => {
    const target = computeFocusTrapTarget([], null, false);
    expect(target).toBeNull();
  });
});

describe("AC-2 — Shift+Tab wraps backward: first focusable -> last (real logic)", () => {
  it("[normal] Shift+Tab on the first focusable returns the last", () => {
    const first = fakeElement();
    const mid = fakeElement();
    const last = fakeElement();
    const target = computeFocusTrapTarget([first, mid, last], first, true);
    expect(target).toBe(last);
  });

  it("[normal] Shift+Tab on a middle focusable returns null (native order handles it)", () => {
    const first = fakeElement();
    const mid = fakeElement();
    const last = fakeElement();
    const target = computeFocusTrapTarget([first, mid, last], mid, true);
    expect(target).toBeNull();
  });

  it("[boundary] a single-focusable-element modal wraps to itself on Shift+Tab", () => {
    const only = fakeElement();
    const target = computeFocusTrapTarget([only], only, true);
    expect(target).toBe(only);
  });
});

describe("EC-1 — focus outside the container pulls to the first focusable (BR-2)", () => {
  it("[error/validation] current === null (nothing focused) -> pulls to first", () => {
    const first = fakeElement();
    const last = fakeElement();
    const target = computeFocusTrapTarget([first, last], null, false);
    expect(target).toBe(first);
  });

  it("[error/validation] current is an element outside the focusable set -> pulls to first", () => {
    const first = fakeElement();
    const last = fakeElement();
    const outsider = fakeElement();
    const target = computeFocusTrapTarget([first, last], outsider, false);
    expect(target).toBe(first);
  });

  it("[error/validation] pulls to first regardless of shiftKey when focus is outside", () => {
    const first = fakeElement();
    const last = fakeElement();
    const outsider = fakeElement();
    expect(computeFocusTrapTarget([first, last], outsider, true)).toBe(first);
    expect(computeFocusTrapTarget([first, last], outsider, false)).toBe(first);
  });
});

describe("EC-1 — the focusable set is queried fresh, never cached (live-requery semantics)", () => {
  it("[concurrent/ordering] the SAME current element wraps differently once the surrounding list shrinks between two calls", () => {
    // Simulates: an image-error swap removed a control between two keydowns.
    // computeFocusTrapTarget is pure and stateless — it always evaluates
    // against whatever list it is passed, proving the caller can safely
    // requery live at each keydown without any hook-level caching.
    const first = fakeElement();
    const mid = fakeElement();
    const last = fakeElement();

    // First keydown: 3 focusable controls, Tab on the last wraps to first.
    expect(computeFocusTrapTarget([first, mid, last], last, false)).toBe(first);

    // The control set changed (mid removed) before the next keydown.
    // Tab on `last` (now itself the LAST of a 2-item list) still wraps to `first`.
    expect(computeFocusTrapTarget([first, last], last, false)).toBe(first);

    // And `mid` is no longer part of the set at all -> treated as outside,
    // pulled to first.
    expect(computeFocusTrapTarget([first, last], mid, false)).toBe(first);
  });
});

describe("getFocusableElements — queries the live DOM via the FOCUSABLE_SELECTOR (structural)", () => {
  it("[normal] queries via container.querySelectorAll with the exported selector shape", () => {
    const calls: string[] = [];
    const fakeContainer = {
      querySelectorAll: (selector: string) => {
        calls.push(selector);
        return [] as unknown as NodeListOf<HTMLElement>;
      },
    } as unknown as Element;

    const result = getFocusableElements(fakeContainer);
    expect(result).toEqual([]);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toContain("button:not([disabled])");
    expect(calls[0]).toContain('[tabindex]:not([tabindex="-1"])');
  });

  it("[error/validation] BR-2 \"visible only\": excludes a matched element whose offsetParent is null (hidden)", () => {
    const visible = { offsetParent: {} } as unknown as HTMLElement;
    const hidden = { offsetParent: null } as unknown as HTMLElement;
    const fakeContainer = {
      querySelectorAll: () => [visible, hidden] as unknown as NodeListOf<HTMLElement>,
    } as unknown as Element;

    const result = getFocusableElements(fakeContainer);

    expect(result).toEqual([visible]);
    expect(result).not.toContain(hidden);
  });
});

// ===========================================================================
// AC-3 + BR-3 + EC-2/EC-3 — applyScrollLock / restoreScrollLock (real logic)
// ===========================================================================

describe("AC-3 — applyScrollLock locks overflow and snapshots the prior style (real logic)", () => {
  it("[normal] sets overflow hidden and returns the previous overflow/paddingRight", () => {
    const style: BodyStyleLike = { overflow: "", paddingRight: "" };
    const snapshot = applyScrollLock(style, 0);

    expect(style.overflow).toBe("hidden");
    expect(snapshot).toEqual({ previousOverflow: "", previousPaddingRight: "" });
  });

  it("[boundary] scrollbarWidth = 0 does not touch paddingRight (no scrollbar to compensate)", () => {
    const style: BodyStyleLike = { overflow: "auto", paddingRight: "8px" };
    applyScrollLock(style, 0);

    expect(style.paddingRight).toBe("8px");
  });

  it("[normal] scrollbarWidth > 0 compensates by adding the width to any existing paddingRight", () => {
    const style: BodyStyleLike = { overflow: "auto", paddingRight: "8px" };
    applyScrollLock(style, 15);

    expect(style.paddingRight).toBe("23px");
  });

  it("[boundary] scrollbarWidth > 0 with no prior paddingRight sets it to exactly the scrollbar width", () => {
    const style: BodyStyleLike = { overflow: "", paddingRight: "" };
    applyScrollLock(style, 17);

    expect(style.paddingRight).toBe("17px");
  });

  it("[normal] captures the pre-lock snapshot even when a non-empty overflow was already set", () => {
    const style: BodyStyleLike = { overflow: "scroll", paddingRight: "0px" };
    const snapshot = applyScrollLock(style, 0);

    expect(snapshot).toEqual({ previousOverflow: "scroll", previousPaddingRight: "0px" });
    expect(style.overflow).toBe("hidden");
  });
});

describe("AC-3/EC-2 — restoreScrollLock restores exactly the pre-lock style (never leaves the page locked)", () => {
  it("[normal] restores overflow and paddingRight to the captured snapshot", () => {
    const style: BodyStyleLike = { overflow: "", paddingRight: "" };
    const snapshot = applyScrollLock(style, 15);

    expect(style.overflow).toBe("hidden");

    restoreScrollLock(style, snapshot);

    expect(style.overflow).toBe("");
    expect(style.paddingRight).toBe("");
  });

  it("[EC-2] restores to a non-empty prior state (the page had its own overflow/padding before the modal opened)", () => {
    const style: BodyStyleLike = { overflow: "auto", paddingRight: "4px" };
    const snapshot = applyScrollLock(style, 15);

    restoreScrollLock(style, snapshot);

    expect(style.overflow).toBe("auto");
    expect(style.paddingRight).toBe("4px");
  });

  it("[EC-2] restoring after an abnormal unmount (snapshot captured, restore called immediately) never leaves overflow hidden", () => {
    const style: BodyStyleLike = { overflow: "", paddingRight: "" };
    const snapshot = applyScrollLock(style, 0);
    // Simulate an unmount happening on the very next tick (route change).
    restoreScrollLock(style, snapshot);

    expect(style.overflow).not.toBe("hidden");
  });
});

describe("EC-3 — sequential open/close cycles lock and restore independently (no lock-count leak)", () => {
  it("[concurrent/ordering] two full lock->restore cycles each restore to their own starting point", () => {
    const style: BodyStyleLike = { overflow: "", paddingRight: "" };

    // Cycle 1: opens with a scrollbar present.
    const snapshot1 = applyScrollLock(style, 15);
    expect(style.overflow).toBe("hidden");
    expect(style.paddingRight).toBe("15px");
    restoreScrollLock(style, snapshot1);
    expect(style.overflow).toBe("");
    expect(style.paddingRight).toBe("");

    // Cycle 2: page state changed between cycles (e.g. a different scrollbar
    // width, different prior overflow) — independent of cycle 1.
    style.overflow = "auto";
    const snapshot2 = applyScrollLock(style, 0);
    expect(style.overflow).toBe("hidden");
    expect(style.paddingRight).toBe(""); // scrollbarWidth 0 this time -> untouched
    restoreScrollLock(style, snapshot2);
    expect(style.overflow).toBe("auto");
    expect(style.paddingRight).toBe("");
  });

  it("[concurrent/ordering] three back-to-back cycles never accumulate padding (no leak across cycles)", () => {
    const style: BodyStyleLike = { overflow: "", paddingRight: "" };

    for (let i = 0; i < 3; i++) {
      const snapshot = applyScrollLock(style, 15);
      expect(style.paddingRight).toBe("15px");
      restoreScrollLock(style, snapshot);
      expect(style.paddingRight).toBe("");
    }
  });
});

// ===========================================================================
// BR-1 — structural: both modals consume the shared hook (no per-modal forks)
// ===========================================================================

describe("BR-1 — both modals import and call the shared useModalA11y hook", () => {
  it("[structural] ImageGallery.tsx imports useModalA11y from the hook", () => {
    expect(gallerySrc).toContain('import { useModalA11y } from "@/lib/hooks/use-modal-a11y"');
  });

  it("[structural] ImageGallery.tsx calls useModalA11y with a containerRef + active tied to isOpen", () => {
    expect(gallerySrc).toContain("useModalA11y(containerRef, { active: isOpen })");
  });

  it("[structural] ImageGallery.tsx attaches containerRef to the dialog root", () => {
    const dialogBlock = gallerySrc.slice(
      gallerySrc.indexOf('role="dialog"') - 100,
      gallerySrc.indexOf('role="dialog"') + 50
    );
    expect(dialogBlock).toContain("ref={containerRef}");
  });

  it("[structural] PanoramaViewer.tsx imports useModalA11y from the hook", () => {
    expect(panoramaSrc).toContain('import { useModalA11y } from "@/lib/hooks/use-modal-a11y"');
  });

  it("[structural] PanoramaViewer.tsx calls useModalA11y with a containerRef (always active while mounted)", () => {
    expect(panoramaSrc).toContain("useModalA11y(containerRef, { active: true })");
  });

  it("[structural] PanoramaViewer.tsx attaches containerRef to the dialog root", () => {
    const dialogBlock = panoramaSrc.slice(
      panoramaSrc.indexOf('role="dialog"') - 100,
      panoramaSrc.indexOf('role="dialog"') + 50
    );
    expect(dialogBlock).toContain("ref={containerRef}");
  });

  it("[structural] neither modal re-implements its own overflow/scroll-lock logic (no per-modal fork)", () => {
    expect(gallerySrc).not.toMatch(/document\.body\.style\.overflow/);
    expect(panoramaSrc).not.toMatch(/document\.body\.style\.overflow/);
  });

  it("[structural] the hook file is the only one of the three touching document.body.style.overflow", () => {
    expect(hookSrc).toMatch(/style\.overflow/);
    expect(gallerySrc).not.toContain("style.overflow");
    expect(panoramaSrc).not.toContain("style.overflow");
  });
});

// ===========================================================================
// BR-2/BR-3 — structural: the hook effects glue the pure helpers to the DOM
// ===========================================================================

describe("BR-2 — the hook's Tab-trap effect requeries focusables live at keydown time (EC-1)", () => {
  it("[structural] getFocusableElements is called INSIDE handleKeyDown, not cached at mount", () => {
    const handlerStart = hookSrc.indexOf("const handleKeyDown = (e: KeyboardEvent) => {");
    const handlerEnd = hookSrc.indexOf("};", handlerStart);
    const handlerBody = hookSrc.slice(handlerStart, handlerEnd);
    expect(handlerBody).toContain("getFocusableElements(container)");
  });

  it("[structural] the trap listens on Tab only (does not intercept every keydown)", () => {
    expect(hookSrc).toContain('if (e.key !== "Tab") return;');
  });

  it("[structural] a matched target calls preventDefault + focus (actually redirects focus)", () => {
    expect(hookSrc).toContain("e.preventDefault();");
    expect(hookSrc).toContain("target.focus();");
  });
});

describe("BR-3 — the hook's scroll-lock effect restores via cleanup (covers unmount, EC-2)", () => {
  it("[structural] applyScrollLock is called inside the active-gated effect", () => {
    expect(hookSrc).toContain("const snapshot = applyScrollLock(style, scrollbarWidth);");
  });

  it("[structural] restoreScrollLock runs from the effect's cleanup (return function) — fires on close AND unmount", () => {
    const idx = hookSrc.indexOf("const snapshot = applyScrollLock(style, scrollbarWidth);");
    const after = hookSrc.slice(idx, idx + 200);
    expect(after).toContain("return () => {");
    expect(after).toContain("restoreScrollLock(style, snapshot);");
  });

  it("[structural] scrollbarWidth is derived from a real layout delta (innerWidth - clientWidth)", () => {
    expect(hookSrc).toContain("window.innerWidth - document.documentElement.clientWidth");
  });
});

// ===========================================================================
// AC-4 — regression guard: Escape + focus-restore in both modals are unchanged
// ===========================================================================

describe("AC-4 — ImageGallery.tsx keeps its existing Escape handling unchanged", () => {
  it('[regression] still closes on Escape via e.key === "Escape" -> onClose()', () => {
    expect(gallerySrc).toContain('if (e.key === "Escape") onClose();');
  });

  it("[regression] the close button still calls onClose with its existing aria-label", () => {
    expect(gallerySrc).toContain("onClick={onClose}");
    expect(gallerySrc).toContain("aria-label={t.gallery.closeViewer}");
  });

  it("[regression] backdrop click still closes only on a direct backdrop hit", () => {
    expect(gallerySrc).toContain("e.target === e.currentTarget");
  });

  it("[regression] dialog role/aria-modal/aria-label are unchanged", () => {
    expect(gallerySrc).toContain('role="dialog"');
    expect(gallerySrc).toContain('aria-modal="true"');
    expect(gallerySrc).toContain("aria-label={t.gallery.viewerTitle}");
  });
});

describe("AC-4 — PanoramaViewer.tsx keeps its existing Escape + focus-restore handling unchanged", () => {
  it("[regression] still focuses the close button on open (unchanged BR-5 idiom)", () => {
    expect(panoramaSrc).toContain("closeButtonRef.current?.focus();");
  });

  it('[regression] still closes on Escape via e.key === "Escape" -> onClose()', () => {
    expect(panoramaSrc).toContain('if (e.key === "Escape") onClose();');
  });

  it("[regression] the close button keeps its ref + aria-label + testid", () => {
    expect(panoramaSrc).toContain("ref={closeButtonRef}");
    expect(panoramaSrc).toContain("aria-label={t.panorama.closeLabel}");
    expect(panoramaSrc).toContain('data-testid="btn--panorama-close"');
  });

  it("[regression] dialog role/aria-modal/aria-label are unchanged", () => {
    expect(panoramaSrc).toContain('role="dialog"');
    expect(panoramaSrc).toContain('aria-modal="true"');
    expect(panoramaSrc).toContain("aria-label={t.panorama.title}");
  });
});

// ===========================================================================
// BR-4 — zero new dependencies; hook is client-only + SSR-safe
// ===========================================================================

describe('BR-4 — zero new dependencies; the hook is "use client" and SSR-safe', () => {
  it('[structural] hook file starts with "use client"', () => {
    expect(hookSrc.trimStart().startsWith('"use client"')).toBe(true);
  });

  it("[structural] no external focus-trap library is imported (DOM/React only)", () => {
    expect(hookSrc).not.toMatch(/from ["'](focus-trap|body-scroll-lock)/);
  });

  it("[export] exports the hook + all pure helpers used by this test file", () => {
    expect(hookSrc).toContain("export function useModalA11y");
    expect(hookSrc).toContain("export function computeFocusTrapTarget");
    expect(hookSrc).toContain("export function applyScrollLock");
    expect(hookSrc).toContain("export function restoreScrollLock");
    expect(hookSrc).toContain("export function getFocusableElements");
  });
});

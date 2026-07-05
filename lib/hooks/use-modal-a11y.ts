"use client";

/**
 * useModalA11y — CAM-368
 *
 * Shared focus-trap + body scroll-lock for the two photo modals
 * (`ImageGallery`, `PanoramaViewer`). Closes a gap found in CAM-354's G3
 * review: `PanoramaViewer` faithfully inherited `ImageGallery`'s pre-existing
 * lack of a Tab trap and a body scroll lock.
 *
 * BR-1: this hook owns 100% of the trap + lock logic; both modals consume it
 * — no per-modal forks, no copy-paste. Escape handling + focus-restore-to-
 * trigger stay exactly where they already live in each modal (AC-4); this
 * hook only adds the Tab trap and the scroll lock.
 *
 * The DOM-touching effects below are thin glue over pure, independently
 * testable helpers (`computeFocusTrapTarget`, `applyScrollLock`,
 * `restoreScrollLock`). The repo's vitest config runs a `node` environment
 * with no jsdom/@testing-library — so unit tests exercise these pure
 * helpers directly against plain fake objects, and the effects themselves
 * are covered by structural (source-inspection) tests, per repo convention
 * (see __tests__/cam-246-loading-foundation.test.ts, __tests__/cam-361-*).
 */

import { useEffect, type RefObject } from "react";

export interface UseModalA11yOptions {
  /** Whether the modal is open. The trap + lock apply only while true. */
  active: boolean;
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * BR-2/EC-1: returns the LIVE, VISIBLE focusable set inside `container`.
 * Call this fresh at keydown time — never cache the result at mount — so a
 * focusable set that changes while the modal is open (e.g. an image error
 * swaps controls) still wraps correctly on the very next Tab press.
 *
 * `offsetParent !== null` excludes elements hidden via `display: none` or an
 * ancestor with `hidden`/`display: none` (BR-2 "visible only"). It does not
 * catch `visibility: hidden` (offsetParent stays non-null for that case),
 * which is an accepted gap — neither modal uses `visibility: hidden` on a
 * focusable control today.
 */
export function getFocusableElements(container: Element): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (el) => el.offsetParent !== null
  );
}

/**
 * BR-2: pure Tab/Shift+Tab wrap decision over an already-queried focusable
 * list. Returns the element focus should move to, or `null` when the native
 * Tab order already does the right thing (no wrap needed this keypress).
 *  - nothing focused, or focus is outside `focusable` -> pull to the first.
 *  - Shift+Tab while on the first -> wrap to the last.
 *  - Tab while on the last -> wrap to the first.
 */
export function computeFocusTrapTarget(
  focusable: HTMLElement[],
  current: Element | null,
  shiftKey: boolean
): HTMLElement | null {
  // An empty focusable set has nothing to trap into — Tab would escape the
  // dialog to the background page. Both consuming modals always render at
  // least a close button, so this branch is a defensive floor, not an
  // expected runtime path.
  if (focusable.length === 0) return null;

  const first = focusable[0];
  const last = focusable[focusable.length - 1];

  if (!current || !focusable.includes(current as HTMLElement)) {
    return first;
  }
  if (shiftKey && current === first) return last;
  if (!shiftKey && current === last) return first;
  return null;
}

export interface BodyStyleLike {
  overflow: string;
  paddingRight: string;
}

export interface ScrollLockSnapshot {
  previousOverflow: string;
  previousPaddingRight: string;
}

/**
 * BR-3: pure lock — snapshots the current inline style, hides overflow, and
 * compensates the scrollbar-width layout shift (a visible scrollbar that
 * disappears once overflow is hidden would otherwise nudge the layout).
 * Returns the snapshot `restoreScrollLock` needs to restore exactly.
 */
export function applyScrollLock(style: BodyStyleLike, scrollbarWidth: number): ScrollLockSnapshot {
  const snapshot: ScrollLockSnapshot = {
    previousOverflow: style.overflow,
    previousPaddingRight: style.paddingRight,
  };

  style.overflow = "hidden";
  if (scrollbarWidth > 0) {
    const currentPadding = parseFloat(style.paddingRight) || 0;
    style.paddingRight = `${currentPadding + scrollbarWidth}px`;
  }

  return snapshot;
}

/**
 * BR-3/EC-2: restores exactly the pre-lock inline style. A locked page with
 * no modal open is the worst failure of this story — this must run from
 * effect cleanup so it fires on close AND on abnormal unmount (route change,
 * back button).
 */
export function restoreScrollLock(style: BodyStyleLike, snapshot: ScrollLockSnapshot): void {
  style.overflow = snapshot.previousOverflow;
  style.paddingRight = snapshot.previousPaddingRight;
}

/**
 * BR-1: shared focus-trap + body scroll-lock, consumed by both
 * `ImageGallery` and `PanoramaViewer`. `containerRef` must point at the
 * dialog's root element (the `role="dialog"` node).
 */
export function useModalA11y<T extends HTMLElement>(
  containerRef: RefObject<T | null>,
  { active }: UseModalA11yOptions
): void {
  // BR-2/EC-1: Tab/Shift+Tab focus trap, scoped to the dialog container.
  useEffect(() => {
    if (!active) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const container = containerRef.current;
      if (!container) return;

      // Queried fresh on every keydown (EC-1) — never cached at mount.
      const focusable = getFocusableElements(container);
      const target = computeFocusTrapTarget(focusable, document.activeElement, e.shiftKey);
      if (target) {
        e.preventDefault();
        target.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [active, containerRef]);

  // BR-3/EC-2/EC-3: body scroll lock while open; restored exactly on close
  // or on abnormal unmount (route change/back button) via effect cleanup.
  // Each open/close cycle snapshots + restores independently (EC-3) — there
  // is no shared counter to leak across cycles.
  //
  // This assumes ONE modal is open at a time on document.body — both current
  // callers (ImageGallery, PanoramaViewer) are full-screen scrims that are
  // mutually exclusive in the UI, so they can never be open concurrently. A
  // future caller that stacks a second modal on top while this one stays
  // open would need a shared lock counter (increment on open, only restore
  // on the last close) — out of scope for this story.
  useEffect(() => {
    if (!active) return;

    const { style } = document.body;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    const snapshot = applyScrollLock(style, scrollbarWidth);

    return () => {
      restoreScrollLock(style, snapshot);
    };
  }, [active]);
}

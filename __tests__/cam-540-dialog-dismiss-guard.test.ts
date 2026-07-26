// @vitest-environment jsdom
/**
 * cam-540-dialog-dismiss-guard.test.ts — CAM-540
 *
 * Prove-It regression for: opening a <Select> (or any Radix popup that
 * disables outside pointer events while open) inside a <Dialog> and then
 * clicking anywhere inside the dialog closes the WHOLE dialog, not just
 * the popup.
 *
 * Root cause (see components/ui/dialog.tsx CAM-540 comment + story.md):
 * while the nested popup is the topmost "disable outside pointer events"
 * layer, Radix sets `pointer-events: none` on every layer beneath it,
 * INCLUDING the dialog's own content box. A click that lands anywhere on
 * that box (not on the popup itself) is not hit-tested there at all in a
 * real browser — it passes straight through to the dialog's own overlay.
 * jsdom's `fireEvent` cannot simulate that spatial pass-through (it always
 * dispatches directly on the node you name), so this test reproduces the
 * FAILURE MODE faithfully by firing directly on the overlay node while the
 * <Select> is open — from Radix's dismissable-layer machinery this is
 * indistinguishable from the real click-through, and it is exactly this
 * scenario the fix guards.
 *
 * AC coverage:
 *   AC-1  a click that resolves to the dialog's own overlay WHILE a nested
 *         Select is open does NOT close the dialog (the bug, now fixed)
 *   AC-2  a click on the SAME overlay node with NO nested popup open still
 *         closes the dialog (must not over-close — a real backdrop click)
 *   AC-3  Escape still closes the dialog (untouched code path)
 *   AC-4  selecting a Select item (a genuine "inside" interaction) closes
 *         only the popup, never the dialog (baseline, unaffected by the fix)
 */
import { beforeAll, describe, expect, it, vi } from "vitest";
import * as React from "react";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";

import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// jsdom gaps Radix's <Select> touches when it actually opens/positions.
beforeAll(() => {
  if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = () => false;
  }
  if (!Element.prototype.releasePointerCapture) {
    (Element.prototype as unknown as { releasePointerCapture: () => void }).releasePointerCapture = () => {};
  }
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = () => {};
  }
});

function Harness({ onOpenChange }: { onOpenChange: (open: boolean) => void }) {
  return React.createElement(
    Dialog,
    { open: true, onOpenChange },
    React.createElement(
      DialogContent,
      { "aria-describedby": undefined },
      React.createElement("h2", { "data-testid": "plain-heading" }, "Title"),
      React.createElement(
        Select,
        { value: "a", onValueChange: () => {} },
        React.createElement(
          SelectTrigger,
          null,
          React.createElement(SelectValue, null)
        ),
        React.createElement(
          SelectContent,
          null,
          React.createElement(SelectItem, { value: "a" }, "A"),
          React.createElement(SelectItem, { value: "b" }, "B")
        )
      )
    )
  );
}

/** A real click is a pointerdown/mousedown → pointerup/mouseup → click sequence. */
function fireFullClick(el: Element) {
  fireEvent.pointerDown(el, { bubbles: true, button: 0, pointerId: 1 });
  fireEvent.mouseDown(el, { bubbles: true, button: 0 });
  fireEvent.pointerUp(el, { bubbles: true, button: 0, pointerId: 1 });
  fireEvent.mouseUp(el, { bubbles: true, button: 0 });
  fireEvent.click(el, { bubbles: true, button: 0 });
}

/** Radix's outside-pointerdown listener attaches via a setTimeout(0) on mount. */
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

const getOverlay = () => document.querySelector('[data-slot="dialog-overlay"]') as HTMLElement;

async function openSelect() {
  fireFullClick(screen.getByRole("combobox"));
  await tick();
}

describe("CAM-540 AC-1 — a click that resolves to the overlay while the Select is open does not close the dialog", () => {
  it("keeps the dialog open when the (passed-through) click lands on the overlay with the Select popup active", async () => {
    const onOpenChange = vi.fn();
    render(React.createElement(Harness, { onOpenChange }));
    await tick();

    await openSelect();
    expect(screen.getByRole("listbox")).toBeTruthy();

    fireFullClick(getOverlay());
    await tick();

    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    cleanup();
  });
});

describe("CAM-540 AC-2 — a genuine backdrop click (no popup open) still closes the dialog", () => {
  it("closes the dialog when the overlay is clicked with nothing else open", async () => {
    const onOpenChange = vi.fn();
    render(React.createElement(Harness, { onOpenChange }));
    await tick();

    fireFullClick(getOverlay());
    await tick();

    expect(onOpenChange).toHaveBeenCalledWith(false);
    cleanup();
  });

  it("closes the dialog on a genuine backdrop click AFTER the Select has already been closed again", async () => {
    const onOpenChange = vi.fn();
    render(React.createElement(Harness, { onOpenChange }));
    await tick();

    await openSelect();
    // Selecting an item closes just the popup (AC-4) — the dialog must
    // still be dismissable normally afterwards (the guard must not stick).
    fireFullClick(screen.getAllByRole("option").find((o) => o.textContent === "B")!);
    await tick();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);

    fireFullClick(getOverlay());
    await tick();
    expect(onOpenChange).toHaveBeenCalledWith(false);
    cleanup();
  });
});

describe("CAM-540 AC-3 — Escape still closes the dialog", () => {
  it("calls onOpenChange(false) on Escape with no popup open", async () => {
    const onOpenChange = vi.fn();
    render(React.createElement(Harness, { onOpenChange }));
    await tick();

    fireEvent.keyDown(document, { key: "Escape", code: "Escape" });
    await tick();

    expect(onOpenChange).toHaveBeenCalledWith(false);
    cleanup();
  });
});

describe("CAM-540 AC-4 — selecting a Select item closes only the popup, never the dialog", () => {
  it("does not call onOpenChange when a SelectItem is clicked", async () => {
    const onOpenChange = vi.fn();
    render(React.createElement(Harness, { onOpenChange }));
    await tick();

    await openSelect();
    fireFullClick(screen.getAllByRole("option").find((o) => o.textContent === "B")!);
    await tick();

    expect(onOpenChange).not.toHaveBeenCalled();
    expect(screen.queryByRole("listbox")).toBeNull();
    cleanup();
  });
});

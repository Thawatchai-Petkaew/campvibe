/**
 * cam-440-non-modal-panel.test.ts — CAM-440 (BUG)
 *
 * Repro: "a big sidebar suddenly appeared on the right of the whole
 * website" (owner report). Root cause — AiChatPanel's Dialog root was a
 * default-MODAL Radix Dialog, so opening the panel mounted `RemoveScroll`,
 * which injects `body{padding-right + margin-right:<scrollbarWidth>px
 * !important}` on open — a blank band down the right edge of the ENTIRE
 * page + content shift, independent of the panel's own (transparent)
 * overlay. CAM-434 (launcher mounted on every page) made the symptom
 * site-wide. Fix: `<Dialog modal={false}>`.
 *
 * This repo's Vitest config runs `environment: 'node'` with no
 * jsdom/@testing-library (see cam-368-photo-modal-a11y.test.ts,
 * cam-272-ai-chat-components.test.ts), so the DOM-level claim (jsdom can't
 * observe RemoveScroll's real body-attribute mutation) is proven the same
 * way the rest of this feature proves Radix wiring: source-inspection for
 * the exact prop that starts/stops RemoveScroll, plus regression guards
 * that the Esc/outside-dismiss/focus-on-open paths (which do NOT depend on
 * `modal`) are still intact.
 *
 * Prove-It: `grep 'modal={false}'` on the pre-fix source returns nothing —
 * this suite's first test fails against that source and passes only once
 * the Dialog root carries `modal={false}`.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const panelSrc = readFileSync(
  resolve(__dirname, "..", "components/ai-chat/AiChatPanel.tsx"),
  "utf-8"
);

describe("CAM-440 — the chat panel is a non-modal Dialog (no body scroll-lock band)", () => {
  it("[structural/Prove-It] the Dialog root carries modal={false} — the actual fix; regresses to the site-wide scrollbar-band bug if removed", () => {
    // CAM-412: onOpenChange -> handleOpenChange (aborts an in-flight stream
    // on every close path) — modal={false} itself is untouched.
    expect(panelSrc).toContain("<Dialog open={open} onOpenChange={handleOpenChange} modal={false}>");
  });

  it("[structural] modal={false} is on the OUTER Dialog root, not just documented in a comment", () => {
    const dialogRootLine = panelSrc
      .split("\n")
      .find((line) => line.trim().startsWith("<Dialog open={open}"));
    expect(dialogRootLine).toBeDefined();
    expect(dialogRootLine).toMatch(/modal=\{false\}/);
  });

  it("[unit] dismiss path is unaffected by the non-modal change — no override disables Radix's native Esc/outside-dismiss", () => {
    // Same invariant CAM-429/AC-8 already rely on: DismissableLayer/FocusScope
    // on Dialog.Content drive Esc + outside-pointer dismiss independent of
    // `modal`; this fix must not have added an override to compensate.
    expect(panelSrc).not.toContain("onEscapeKeyDown");
    expect(panelSrc).not.toContain("onPointerDownOutside");
    expect(panelSrc).not.toContain("onInteractOutside");
  });

  it("[unit] the close button still drives the same controlled onOpenChange(false) Esc/scrim-dismiss uses", () => {
    // CAM-412: via the handleOpenChange wrapper (aborts an in-flight stream
    // on close) — still calls the SAME onOpenChange prop underneath.
    expect(panelSrc).toContain("onClick={() => handleOpenChange(false)}");
    expect(panelSrc).toContain("onOpenChange(next)");
  });

  it("[unit] focus still moves into the composer on open (onOpenAutoFocus, unaffected by modal={false})", () => {
    expect(panelSrc).toContain("onOpenAutoFocus={(e) => {");
    expect(panelSrc).toContain("composerRef.current?.focus();");
  });

  it("[unit] onCloseAutoFocus is still left untouched (Radix default restore-to-launcher), not overridden to compensate for modal={false}", () => {
    expect(panelSrc).not.toContain("onCloseAutoFocus");
  });

  it("[structural] the CAM-429 transparent overlay stays in the tree (harmless, minimizes churn) — not deleted as part of this fix", () => {
    expect(panelSrc).toContain('<DialogOverlay className="bg-transparent" />');
  });
});

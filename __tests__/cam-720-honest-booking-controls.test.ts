// @vitest-environment jsdom
/**
 * cam-720-honest-booking-controls.test.ts — CAM-720 (epic CAM-695,
 * in-chat-booking-completion)
 *
 * Three layers, one story (see `story.md`'s AC-1/AC-2/AC-3):
 *
 *  - AC-1/BR-1 — `ControlsRow` (back/edit/cancel) renders `secondary`
 *    (a real fill at rest), never `ghost`; the answer chips (`outline`) and
 *    the primary confirm/handoff CTA (`default`) are untouched.
 *  - AC-2/BR-3/EC-1 — a superseded (`isCurrent:false`) QUESTION block's
 *    chips AND controls take the real `disabled` attribute (out of tab
 *    order), extending CAM-701's `summary`/`submitting`-only pattern to
 *    every question step.
 *  - AC-3/BR-4/EC-2/EC-3 — the exit-supersede: `appendBookingNotice`
 *    (`conversation.ts`) retires the last still-current booking entry the
 *    same way a new booking entry would, proven at the pure-state level and
 *    end-to-end through both exit shapes `booking-turn.ts` produces (the
 *    2-strike escape hatch and `ยกเลิกการจอง`), then rendered to prove the
 *    resulting block is really disabled.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import * as React from "react";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { AiChatBookingStep, type BookingStepView } from "@/components/ai-chat/AiChatBookingStep";
import { appendBookingEntry, appendBookingNotice, type ChatEntry } from "@/components/ai-chat/conversation";
import { getTranslations } from "@/locales/translations";
import { processBookingCancel, processBookingTurn, startBookingTurn } from "@/components/ai-chat/booking-turn";
import type { BookingCampContext } from "@/components/ai-chat/booking-view";

const t = getTranslations("th");
const NOW = new Date("2026-07-22T10:00:00Z"); // Bangkok Wednesday (same fixture as cam-640)

const CAMP: BookingCampContext = {
  campId: "cs-1",
  slug: "phu-chi-fa-camp",
  name: "ภูชี้ฟ้า",
  weekendAvailability: [{ date: "2026-08-01", remaining: 6, blockedByHost: false }],
  maxGuestsPerDay: 10,
  useSpotView: false,
  unitPrice: 500,
  priceUnit: "PER_SITE",
  priceIsFree: false,
};

afterEach(() => cleanup());

function renderStep(
  view: BookingStepView,
  handlers: {
    onChipSelect?: (v: string) => void;
    onBack?: (s: string) => void;
    onEditDate?: () => void;
    onEditGuests?: () => void;
    onCancel?: () => void;
    onConfirm?: () => void;
  } = {}
) {
  render(React.createElement(LanguageProvider, null, React.createElement(AiChatBookingStep, { view, ...handlers })));
}

function bookingEntries(entries: ChatEntry[]) {
  return entries.filter((e) => e.role === "assistant" && e.kind === "booking");
}

/** Reads `view.isCurrent` off a booking entry, `undefined` for anything else (incl. `checkFailed`, which carries no such field). */
function currentFlag(entry: ChatEntry | undefined): boolean | undefined {
  if (!entry || entry.role !== "assistant" || entry.kind !== "booking") return undefined;
  if (entry.view.kind === "checkFailed") return undefined;
  return entry.view.isCurrent;
}

// ---------------------------------------------------------------------------
// AC-1/BR-1 — ControlsRow: ghost -> secondary. Chips + primary CTA untouched.
// ---------------------------------------------------------------------------
describe("AC-1/BR-1 — ControlsRow renders `secondary`, never `ghost`; chips + the primary CTA are untouched", () => {
  it("[normal] a question step's back/cancel controls carry variant secondary; the answer chip stays outline", () => {
    renderStep({
      kind: "question",
      step: "guests",
      isCurrent: true,
      questionText: "ไปกันกี่คน",
      chips: [{ kind: "guests", count: 2 }],
      controls: [{ kind: "back", toStep: "nights" }, { kind: "cancel" }],
    });

    expect(screen.getByTestId("btn--ai-chat-booking-back").getAttribute("data-variant")).toBe("secondary");
    expect(screen.getByTestId("btn--ai-chat-booking-cancel").getAttribute("data-variant")).toBe("secondary");
    expect(screen.getByTestId("btn--ai-chat-booking-chip").getAttribute("data-variant")).toBe("outline");
  });

  it("[normal] the summary step's edit/cancel controls carry variant secondary; the confirm CTA stays default", () => {
    renderStep({
      kind: "summary",
      isCurrent: true,
      campValue: "ภูชี้ฟ้า",
      datesValue: "ส. 8 ส.ค. พัก 2 คืน",
      guestsValue: "2 คน",
      totalValue: "฿1,000",
      cta: { kind: "confirm", label: "ยืนยันการจอง", authState: "member" },
      controls: [{ kind: "editDate" }, { kind: "editNights" }, { kind: "editGuests" }, { kind: "cancel" }],
    });

    expect(screen.getByTestId("btn--ai-chat-booking-cancel").getAttribute("data-variant")).toBe("secondary");
    for (const btn of screen.getAllByTestId("btn--ai-chat-booking-edit")) {
      expect(btn.getAttribute("data-variant")).toBe("secondary");
    }
    expect(screen.getByTestId("btn--ai-chat-booking-confirm").getAttribute("data-variant")).toBe("default");
  });
});

// ---------------------------------------------------------------------------
// AC-2/BR-3/EC-1 — a superseded QUESTION block's chips + controls disable for real.
// ---------------------------------------------------------------------------
describe("AC-2/BR-3 — a superseded (isCurrent:false) question block's chips + controls are really disabled", () => {
  it("[unit] the chip AND the back control take the real `disabled` attribute, out of tab order, and a tap is a no-op", () => {
    const onChipSelect = vi.fn();
    const onBack = vi.fn();
    renderStep(
      {
        kind: "question",
        step: "guests",
        isCurrent: false,
        questionText: "ไปกันกี่คน",
        chips: [{ kind: "guests", count: 2 }],
        controls: [{ kind: "back", toStep: "nights" }],
      },
      { onChipSelect, onBack }
    );

    const chip = screen.getByTestId("btn--ai-chat-booking-chip") as HTMLButtonElement;
    expect(chip.disabled).toBe(true);
    fireEvent.click(chip);
    expect(onChipSelect).not.toHaveBeenCalled();

    const backBtn = screen.getByTestId("btn--ai-chat-booking-back") as HTMLButtonElement;
    expect(backBtn.disabled).toBe(true);
    fireEvent.click(backBtn);
    expect(onBack).not.toHaveBeenCalled();
  });

  it("[normal] a CURRENT question block keeps its chip + control enabled (no regression)", () => {
    const onChipSelect = vi.fn();
    renderStep(
      {
        kind: "question",
        step: "guests",
        isCurrent: true,
        questionText: "ไปกันกี่คน",
        chips: [{ kind: "guests", count: 2 }],
        controls: [{ kind: "back", toStep: "nights" }],
      },
      { onChipSelect }
    );
    const chip = screen.getByTestId("btn--ai-chat-booking-chip") as HTMLButtonElement;
    expect(chip.disabled).toBe(false);
    fireEvent.click(chip);
    expect(onChipSelect).toHaveBeenCalledWith("2");
    expect((screen.getByTestId("btn--ai-chat-booking-back") as HTMLButtonElement).disabled).toBe(false);
  });

  it("[boundary/EC-1] a superseded block still carrying its frozen isChecking:true snapshot stays disabled (no flicker back to enabled)", () => {
    renderStep({
      kind: "question",
      step: "guests",
      isCurrent: false,
      isChecking: true,
      questionText: "ไปกันกี่คน",
      chips: [{ kind: "guests", count: 2 }],
      controls: [{ kind: "back", toStep: "nights" }],
    });
    expect((screen.getByTestId("btn--ai-chat-booking-chip") as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByTestId("btn--ai-chat-booking-back") as HTMLButtonElement).disabled).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// AC-3/BR-4/EC-2/EC-3 — the exit-supersede (conversation.ts's `appendBookingNotice`).
// ---------------------------------------------------------------------------
describe("AC-3/BR-4 — appendBookingNotice supersedes the last still-current booking entry", () => {
  it("[unit] a current question entry's view.isCurrent flips to false when the exit notice is appended", () => {
    let entries: ChatEntry[] = appendBookingEntry([], "guests", {
      kind: "question",
      step: "guests",
      isCurrent: true,
      questionText: "ไปกันกี่คน",
      chips: [],
      controls: [],
    });
    entries = appendBookingNotice(entries, t.aiChat.booking.cancelled);

    const [entry] = bookingEntries(entries);
    expect(currentFlag(entry)).toBe(false);
    expect(entries.at(-1)).toMatchObject({ role: "assistant", kind: "answer", text: t.aiChat.booking.cancelled });
  });

  it("[null/empty] a `checkFailed` entry (no isCurrent field) is left untouched", () => {
    const entries: ChatEntry[] = appendBookingEntry([], "guests", { kind: "checkFailed", onRetry: () => {} });
    const before = entries[0];
    const after = appendBookingNotice(entries, t.aiChat.booking.cancelled);
    expect(after[0]).toBe(before); // same reference — never mutated, never crashed reading `isCurrent`
  });

  it("[unit/EC-2] a non-current entry (e.g. an already-frozen `submitting` block) is left untouched — the exit-supersede never fights an existing disabled state", () => {
    const submittingEntry: ChatEntry = {
      id: "ai-chat-entry-1",
      role: "assistant",
      kind: "booking",
      step: "summary",
      view: {
        kind: "submitting",
        campValue: "ภูชี้ฟ้า",
        datesValue: "ส. 8 ส.ค. พัก 2 คืน",
        guestsValue: "2 คน",
        totalValue: "฿1,000",
        controls: [],
      },
    };
    const after = appendBookingNotice([submittingEntry], t.aiChat.booking.cancelled);
    expect(after[0]).toBe(submittingEntry); // untouched — `isCurrent` was never true to begin with
  });
});

describe("post-exit — the last block renders disabled after BOTH real exit shapes (booking-turn.ts)", () => {
  it("[normal] `ยกเลิกการจอง` (processBookingCancel) supersedes the last (date) block; its cancel control renders real-disabled", () => {
    const start = startBookingTurn([], CAMP, t, "th");
    const result = processBookingCancel(start.entries, t);
    expect(result.booking).toBeNull();

    const entry = bookingEntries(result.entries).at(-1);
    if (!entry || entry.role !== "assistant" || entry.kind !== "booking" || entry.view.kind === "checkFailed") {
      throw new Error("expected a question view");
    }
    expect(entry.view.isCurrent).toBe(false);

    renderStep(entry.view);
    expect((screen.getByTestId("btn--ai-chat-booking-cancel") as HTMLButtonElement).disabled).toBe(true);
  });

  it("[error/validation] the 2-strike escape hatch supersedes the last (date) block; its chip + cancel control render real-disabled", () => {
    const start = startBookingTurn([], CAMP, t, "th");
    const firstMiss = processBookingTurn(start.entries, start.booking!, { kind: "text", text: "จะกินอะไรดี" }, "จะกินอะไรดี", t, "th", NOW);
    expect(firstMiss.booking).not.toBeNull(); // one miss is only a reprompt

    const secondMiss = processBookingTurn(
      firstMiss.entries,
      firstMiss.booking!,
      { kind: "text", text: "อากาศเป็นไงบ้าง" },
      "อากาศเป็นไงบ้าง",
      t,
      "th",
      NOW
    );
    expect(secondMiss.booking).toBeNull();

    const entry = bookingEntries(secondMiss.entries).at(-1);
    if (!entry || entry.role !== "assistant" || entry.kind !== "booking" || entry.view.kind === "checkFailed") {
      throw new Error("expected a question view");
    }
    expect(entry.view.isCurrent).toBe(false);

    renderStep(entry.view);
    expect((screen.getByTestId("btn--ai-chat-booking-chip") as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByTestId("btn--ai-chat-booking-cancel") as HTMLButtonElement).disabled).toBe(true);
  });

  it("[normal/EC-3] starting a NEW flow after an exit renders the new block current and live — the old dead block stays dead", () => {
    const start = startBookingTurn([], CAMP, t, "th");
    const cancelled = processBookingCancel(start.entries, t);
    // A fresh `เริ่มจอง` tap runs `startBookingTurn` again over the notice-carrying entries.
    const restarted = startBookingTurn(cancelled.entries, CAMP, t, "th");

    const entries = bookingEntries(restarted.entries);
    expect(entries).toHaveLength(2); // the old (dead) date block + the new (live) one
    const [oldEntry, newEntry] = entries;
    if (!oldEntry || oldEntry.role !== "assistant" || oldEntry.kind !== "booking" || oldEntry.view.kind === "checkFailed") {
      throw new Error("expected a question view");
    }
    if (!newEntry || newEntry.role !== "assistant" || newEntry.kind !== "booking" || newEntry.view.kind === "checkFailed") {
      throw new Error("expected a question view");
    }
    expect(oldEntry.view.isCurrent).toBe(false); // never resurrected
    expect(newEntry.view.isCurrent).toBe(true);
  });
});

// @vitest-environment jsdom
/**
 * cam-699-ai-chat-booking-step-nights.test.ts — CAM-699 (epic CAM-695,
 * ADR-018 D8)
 *
 * Fixture-driven render coverage for the `nights` step inside
 * `AiChatBookingStep` — same jsdom + @testing-library/react pattern
 * `cam-638-ai-chat-booking-step.test.ts` already establishes for `date`/
 * `guests`/`summary`. Proves the nights chips render + tap, the type hint,
 * the back-to-date control, and that the caption now reads "step 2 of 4".
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import * as React from "react";
import { render, screen, within, fireEvent, cleanup } from "@testing-library/react";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { AiChatBookingStep, type BookingStepView } from "@/components/ai-chat/AiChatBookingStep";

function renderStep(
  view: BookingStepView,
  handlers: { onChipSelect?: (v: string) => void; onBack?: (s: string) => void; onCancel?: () => void } = {}
) {
  render(React.createElement(LanguageProvider, null, React.createElement(AiChatBookingStep, { view, ...handlers })));
}

afterEach(() => cleanup());

describe("nights question — chips render + tap, type hint, back-to-date control (design brief §3)", () => {
  it("[normal] renders the caption 'Step 2 of 4', 4 night chips, the type hint, and back+cancel controls", () => {
    const onChipSelect = vi.fn();
    const onBack = vi.fn();
    const onCancel = vi.fn();
    renderStep(
      {
        kind: "question",
        step: "nights",
        isCurrent: true,
        questionText: "Sat, 1 Aug it is. How many nights?",
        chips: [
          { kind: "nights", count: 1 },
          { kind: "nights", count: 2 },
          { kind: "nights", count: 3 },
          { kind: "nights", count: 4 },
        ],
        controls: [{ kind: "back", toStep: "date" }, { kind: "cancel" }],
      },
      { onChipSelect, onBack, onCancel }
    );

    const block = screen.getByTestId("msg--ai-chat-booking-step");
    expect(block.getAttribute("data-step")).toBe("nights");

    const caption = screen.getByTestId("text--ai-chat-booking-step-caption");
    expect(caption.textContent).toContain("Step 2 of 4");
    expect(caption.textContent).toContain("Nights");

    const chipGroup = screen.getByTestId("group--ai-chat-booking-chips");
    expect(chipGroup.getAttribute("data-step")).toBe("nights");
    const chips = within(chipGroup).getAllByTestId("btn--ai-chat-booking-chip");
    expect(chips).toHaveLength(4);
    expect(chips.map((c) => c.textContent)).toEqual(["1 nights", "2 nights", "3 nights", "4 nights"]);
    expect(chips[1]!.getAttribute("data-value")).toBe("2");

    fireEvent.click(chips[1]!);
    expect(onChipSelect).toHaveBeenCalledWith("2");

    expect(screen.getByTestId("text--ai-chat-booking-type-hint").textContent).toBe(
      "Staying longer? Just type the number of nights."
    );

    const backBtn = screen.getByTestId("btn--ai-chat-booking-back");
    expect(backBtn.getAttribute("data-step")).toBe("date");
    fireEvent.click(backBtn);
    expect(onBack).toHaveBeenCalledWith("date");

    const cancelBtn = screen.getByTestId("btn--ai-chat-booking-cancel");
    fireEvent.click(cancelBtn);
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("[error/validation] the tooLong copy still renders the unchanged chip row (design brief §3)", () => {
    renderStep({
      kind: "question",
      step: "nights",
      isCurrent: true,
      questionText: "You can book up to 30 nights at a time. Try a smaller number.",
      chips: [
        { kind: "nights", count: 1 },
        { kind: "nights", count: 2 },
        { kind: "nights", count: 3 },
        { kind: "nights", count: 4 },
      ],
      controls: [{ kind: "back", toStep: "date" }, { kind: "cancel" }],
    });
    expect(screen.getByText("You can book up to 30 nights at a time. Try a smaller number.")).toBeTruthy();
    expect(within(screen.getByTestId("group--ai-chat-booking-chips")).getAllByTestId("btn--ai-chat-booking-chip")).toHaveLength(4);
  });
});

describe("summary — the dates row now carries the real night count (CAM-699)", () => {
  it("[normal] renders 'Sat, 8 Aug, 2 nights' verbatim from the caller-supplied datesValue", () => {
    renderStep({
      kind: "summary",
      isCurrent: true,
      campValue: "Phu Chi Fa",
      datesValue: "Sat, 8 Aug, 2 nights",
      guestsValue: "2 people",
      totalValue: "฿1,000",
      // CAM-701 — `handoffHref` renamed to the `cta` discriminator.
      cta: { kind: "handoff", href: "/campgrounds/phu-chi-fa?checkIn=2026-08-08&checkOut=2026-08-10&guests=2" },
      controls: [{ kind: "editDate" }, { kind: "editGuests" }, { kind: "cancel" }],
    });
    const rows = screen.getAllByTestId("row--ai-chat-booking-summary-line");
    const datesRow = rows.find((r) => r.getAttribute("data-field") === "dates");
    expect(datesRow?.textContent).toContain("2 nights");
  });
});

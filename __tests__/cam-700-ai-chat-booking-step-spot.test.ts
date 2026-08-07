// @vitest-environment jsdom
/**
 * cam-700-ai-chat-booking-step-spot.test.ts — CAM-700 (epic CAM-695)
 *
 * Fixture-driven render coverage for the `spot` step inside
 * `AiChatBookingStep` — same jsdom + @testing-library/react pattern
 * cam-638/cam-699's own step-render tests already establish. Proves the
 * per-camp caption total ("Step 4 of 5" / "Step 5 of 5" — the Critical build
 * note this story closes), the pitch chips (name + price), the real empty
 * state, and that `editNights`/`editSpot` reuse the EXISTING generic
 * `onBack` handler (no new prop was added to `AiChatBookingStepProps`).
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import * as React from "react";
import { render, screen, within, fireEvent, cleanup } from "@testing-library/react";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { AiChatBookingStep, type BookingStepView } from "@/components/ai-chat/AiChatBookingStep";

function renderStep(
  view: BookingStepView,
  handlers: {
    onChipSelect?: (v: string) => void;
    onBack?: (s: string) => void;
    onEditDate?: () => void;
    onEditGuests?: () => void;
    onCancel?: () => void;
  } = {}
) {
  render(React.createElement(LanguageProvider, null, React.createElement(AiChatBookingStep, { view, ...handlers })));
}

afterEach(() => cleanup());

describe("spot question — per-camp caption total (Critical build note, design brief §2)", () => {
  it('[normal] a per-pitch camp at `spot` (step 4 of a 5-step flow) reads "Step 4 of 5"', () => {
    renderStep({
      kind: "question",
      step: "spot",
      isCurrent: true,
      questionText: "Pick the pitch you like.",
      chips: [
        { kind: "spot", id: "spot-a", name: "Riverside A", pricePerNight: 500 },
        { kind: "spot", id: "spot-b", name: "Pine hill B", pricePerNight: 700 },
      ],
      controls: [{ kind: "back", toStep: "guests" }, { kind: "cancel" }],
      useSpotView: true,
    });

    const caption = screen.getByTestId("text--ai-chat-booking-step-caption");
    expect(caption.textContent).toContain("Step 4 of 5");
    expect(caption.textContent).toContain("Choose a pitch");
  });

  it('[regression] a WHOLE-CAMP flow (useSpotView omitted/false) still reads "Step N of 4" — the per-camp total never leaks a spot camp\'s count onto a whole-camp flow', () => {
    renderStep({
      kind: "question",
      step: "guests",
      isCurrent: true,
      questionText: "How many of you are going?",
      chips: [],
      controls: [{ kind: "back", toStep: "nights" }, { kind: "cancel" }],
    });
    expect(screen.getByTestId("text--ai-chat-booking-step-caption").textContent).toContain("Step 3 of 4");
  });
});

describe("spot question — chips (pitch name + price), tap, type hint, back control", () => {
  it("[normal] renders one chip per offered pitch with name + price, taps report the pitch id", () => {
    const onChipSelect = vi.fn();
    const onBack = vi.fn();
    renderStep(
      {
        kind: "question",
        step: "spot",
        isCurrent: true,
        questionText: "Pick the pitch you like.",
        chips: [
          { kind: "spot", id: "spot-a", name: "Riverside A", pricePerNight: 500 },
          { kind: "spot", id: "spot-b", name: "Pine hill B", pricePerNight: 700 },
        ],
        controls: [{ kind: "back", toStep: "guests" }, { kind: "cancel" }],
        useSpotView: true,
      },
      { onChipSelect, onBack }
    );

    const chips = within(screen.getByTestId("group--ai-chat-booking-chips")).getAllByTestId("btn--ai-chat-booking-chip");
    expect(chips).toHaveLength(2);
    expect(chips[0]!.getAttribute("data-value")).toBe("spot-a");
    expect(chips[0]!.textContent).toContain("Riverside A");
    expect(chips[0]!.textContent).toContain("฿500");

    fireEvent.click(chips[0]!);
    expect(onChipSelect).toHaveBeenCalledWith("spot-a");

    expect(screen.getByTestId("text--ai-chat-booking-type-hint").textContent).toBe(
      "Want a different pitch? Just type its name."
    );

    const backBtn = screen.getByTestId("btn--ai-chat-booking-back");
    expect(backBtn.getAttribute("data-step")).toBe("guests");
    fireEvent.click(backBtn);
    expect(onBack).toHaveBeenCalledWith("guests");
  });

  it("[unit] isChecking (the step-entry fetch in flight) disables the (empty) chip group and shows the checking status line, no empty-state text", () => {
    renderStep({
      kind: "question",
      step: "spot",
      isCurrent: true,
      questionText: "Pick the pitch you like.",
      chips: [],
      isChecking: true,
      controls: [{ kind: "back", toStep: "guests" }, { kind: "cancel" }],
      useSpotView: true,
    });
    expect(screen.getByTestId("status--ai-chat-booking-checking").textContent).toBe("Checking availability…");
    expect(screen.queryByTestId("empty--ai-chat-booking-no-spots")).toBeNull();
  });
});

describe("spot empty — the REAL empty state (design brief §4, distinct testid from date's)", () => {
  it("[null/empty] no chip row, the dedicated empty--ai-chat-booking-no-spots testid, the edit trio + cancel", () => {
    const onBack = vi.fn();
    const onEditDate = vi.fn();
    const onEditGuests = vi.fn();
    renderStep(
      {
        kind: "question",
        step: "spot",
        isCurrent: true,
        questionText: "No pitch is open and big enough for your group on those dates. Want to change the dates or the group size?",
        chips: [],
        controls: [{ kind: "editDate" }, { kind: "editNights" }, { kind: "editGuests" }, { kind: "cancel" }],
        useSpotView: true,
      },
      { onBack, onEditDate, onEditGuests }
    );

    const empty = screen.getByTestId("empty--ai-chat-booking-no-spots");
    expect(empty.textContent).toContain("No pitch is open");
    expect(screen.queryByTestId("group--ai-chat-booking-chips")).toBeNull();
    expect(screen.queryByTestId("text--ai-chat-booking-type-hint")).toBeNull();

    // editNights reuses the GENERIC onBack prop (no dedicated onEditNights
    // prop exists on AiChatBookingStepProps) — proven behaviourally here.
    const editButtons = screen.getAllByTestId("btn--ai-chat-booking-edit");
    const editNightsBtn = editButtons.find((b) => b.getAttribute("data-step") === "nights")!;
    expect(editNightsBtn.textContent).toBe("Change nights");
    fireEvent.click(editNightsBtn);
    expect(onBack).toHaveBeenCalledWith("nights");

    const editDateBtn = editButtons.find((b) => b.getAttribute("data-step") === "date")!;
    fireEvent.click(editDateBtn);
    expect(onEditDate).toHaveBeenCalledOnce();

    const editGuestsBtn = editButtons.find((b) => b.getAttribute("data-step") === "guests")!;
    fireEvent.click(editGuestsBtn);
    expect(onEditGuests).toHaveBeenCalledOnce();
  });
});

describe("summary — the spot row + editSpot control (per-pitch camps only)", () => {
  it('[normal] a per-pitch summary (step 5 of 5) renders the pitch row + editSpot, which reuses onBack("spot")', () => {
    const onBack = vi.fn();
    renderStep(
      {
        kind: "summary",
        isCurrent: true,
        campValue: "Phu Chi Fa",
        datesValue: "Sat, 1 Aug, 2 nights",
        guestsValue: "2 people",
        spotValue: "Riverside A",
        totalValue: "฿1,000",
        // CAM-701 — `handoffHref` renamed to the `cta` discriminator.
        cta: { kind: "handoff", href: "/campgrounds/phu-chi-fa?checkIn=2026-08-01&checkOut=2026-08-03&guests=2" },
        controls: [{ kind: "editDate" }, { kind: "editGuests" }, { kind: "editSpot" }, { kind: "cancel" }],
        useSpotView: true,
      },
      { onBack }
    );

    expect(screen.getByTestId("text--ai-chat-booking-step-caption").textContent).toContain("Step 5 of 5");

    const rows = screen.getAllByTestId("row--ai-chat-booking-summary-line");
    expect(rows.map((r) => r.getAttribute("data-field"))).toEqual(["camp", "dates", "guests", "spot", "total"]);
    const spotRow = rows.find((r) => r.getAttribute("data-field") === "spot")!;
    expect(spotRow.textContent).toBe("Pitch" + "Riverside A");

    const editSpotBtn = screen.getAllByTestId("btn--ai-chat-booking-edit").find((b) => b.getAttribute("data-step") === "spot")!;
    expect(editSpotBtn.textContent).toBe("Change pitch");
    fireEvent.click(editSpotBtn);
    expect(onBack).toHaveBeenCalledWith("spot");
  });

  it("[null/empty] a whole-camp summary (no spotValue) renders NO spot row and only 3 controls — unchanged from round 1", () => {
    renderStep({
      kind: "summary",
      isCurrent: true,
      campValue: "Phu Chi Fa",
      datesValue: "Sat, 1 Aug, 1 night",
      guestsValue: "2 people",
      totalValue: "฿500",
      // CAM-701 — `handoffHref` renamed to the `cta` discriminator.
      cta: { kind: "handoff", href: "/campgrounds/phu-chi-fa?checkIn=2026-08-01&checkOut=2026-08-02&guests=2" },
      controls: [{ kind: "editDate" }, { kind: "editGuests" }, { kind: "cancel" }],
    });
    const rows = screen.getAllByTestId("row--ai-chat-booking-summary-line");
    expect(rows.map((r) => r.getAttribute("data-field"))).toEqual(["camp", "dates", "guests", "total"]);
    expect(screen.queryAllByTestId("btn--ai-chat-booking-edit")).toHaveLength(2);
  });
});

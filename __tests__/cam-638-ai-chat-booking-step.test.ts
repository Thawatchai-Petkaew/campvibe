// @vitest-environment jsdom
/**
 * cam-638-ai-chat-booking-step.test.ts — CAM-638 (epic CAM-630, design brief
 * CAM-637)
 *
 * Fixture-driven render coverage for `AiChatBookingStep` — every state the
 * design brief §4 names, rendered for real (jsdom + @testing-library/react,
 * scoped via the top-of-file pragma, same pattern as
 * __tests__/cam-540-dialog-dismiss-guard.test.ts / cam-496-filter-modal-
 * hydration.test.ts — the repo's default Vitest environment stays `node`).
 * `next/link` is mocked to a plain anchor purely to keep this a component
 * test (no full Next router harness needed) — the production component's
 * own `next/link` import is untouched.
 *
 * States covered: date question (with a live-capacity chip + a no-cap chip),
 * date empty, guests question, guests checking (the one async moment),
 * summary, and all THREE error shapes the design brief specifies (not the
 * two named in the pre-design ticket — brief §5: "Three, not two"):
 *   E1 "the day filled up"      -> a normal `date` question render (fresh copy)
 *   E2 "party size exceeds"     -> a normal `guests` question render (one capChip)
 *   E3 "the re-check itself failed" -> the dedicated `checkFailed` view
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import * as React from "react";
import { render, screen, within, fireEvent, cleanup } from "@testing-library/react";
import { LanguageProvider } from "@/contexts/LanguageContext";
import {
  AiChatBookingStep,
  type BookingStepView,
} from "@/components/ai-chat/AiChatBookingStep";

// Radix Slot (Button asChild) merges the button's own attrs onto the single
// child (Button strips only className/variant/size/asChild itself; the rest
// — data-slot/data-variant/data-size/data-testid + the merged className —
// spreads through Slot.Root onto this Link mock). Listed explicitly rather
// than via an index signature: `forwardRef<T, P>` with an indexed `P`
// re-derives EVERY property's type (including the explicitly-declared
// `children?: ReactNode`) through the index signature, collapsing it to
// `unknown` inside the render function — confirmed by isolated repro, not a
// cast-worthy edge case.
interface MockLinkProps {
  href: string;
  children?: React.ReactNode;
  className?: string;
  "data-testid"?: string;
  "data-slot"?: string;
  "data-variant"?: string;
  "data-size"?: string;
}

vi.mock("next/link", () => {
  const MockLink = React.forwardRef<HTMLAnchorElement, MockLinkProps>(({ href, children, ...rest }, ref) =>
    React.createElement("a", { href, ref, ...rest }, children)
  );
  MockLink.displayName = "MockNextLink";
  return { __esModule: true, default: MockLink };
});

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
  render(
    React.createElement(
      LanguageProvider,
      null,
      React.createElement(AiChatBookingStep, { view, ...handlers })
    )
  );
}

afterEach(() => cleanup());

describe("date question — AC-1 default/hover/focus states + BR-8 testids", () => {
  it("[normal] renders the caption, sentence, live-capacity + no-cap chips, type hint, and cancel-only controls", () => {
    const onChipSelect = vi.fn();
    const onCancel = vi.fn();
    renderStep(
      {
        kind: "question",
        step: "date",
        isCurrent: true,
        questionText: "Let's get Phu Chi Fa booked. Which day would you like?",
        chips: [
          { kind: "date", date: "2026-08-08", remaining: 6 },
          { kind: "date", date: "2026-08-15", remaining: null },
        ],
        controls: [{ kind: "cancel" }],
      },
      { onChipSelect, onCancel }
    );

    const block = screen.getByTestId("msg--ai-chat-booking-step");
    expect(block.getAttribute("data-step")).toBe("date");
    expect(block.getAttribute("role")).toBe("group");

    const caption = screen.getByTestId("text--ai-chat-booking-step-caption");
    // CAM-699 — `nights` inserted into the registry; the total is now 4.
    expect(caption.textContent).toContain("Step 1 of 4");
    expect(caption.textContent).toContain("Choose a date");
    expect(caption.getAttribute("aria-current")).toBe("step");
    expect(caption.getAttribute("tabIndex")).toBe("-1");

    const chipGroup = screen.getByTestId("group--ai-chat-booking-chips");
    expect(chipGroup.getAttribute("data-step")).toBe("date");
    const chips = within(chipGroup).getAllByTestId("btn--ai-chat-booking-chip");
    expect(chips).toHaveLength(2);
    expect(chips[0]!.getAttribute("data-value")).toBe("2026-08-08");
    expect(chips[0]!.getAttribute("aria-label")).toBe("Sat, Aug 8, 6 spots left");
    expect(chips[1]!.getAttribute("data-value")).toBe("2026-08-15");
    expect(chips[1]!.getAttribute("aria-label")).toBe("Sat, Aug 15, spots open");

    fireEvent.click(chips[0]!);
    expect(onChipSelect).toHaveBeenCalledWith("2026-08-08");

    expect(screen.getByTestId("text--ai-chat-booking-type-hint").textContent).toBe(
      'Or type a date yourself, like "next Saturday" or "15 Aug".'
    );

    expect(screen.queryByTestId("btn--ai-chat-booking-back")).toBeNull();
    const cancelBtn = screen.getByTestId("btn--ai-chat-booking-cancel");
    expect(cancelBtn.getAttribute("data-step")).toBe("date");
    fireEvent.click(cancelBtn);
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("[unit] a superseded (non-current) block's caption loses aria-current", () => {
    renderStep({
      kind: "question",
      step: "guests",
      isCurrent: false,
      questionText: "How many of you are going?",
      chips: [],
      controls: [],
    });
    expect(screen.getByTestId("text--ai-chat-booking-step-caption").hasAttribute("aria-current")).toBe(false);
  });
});

describe("date empty — AC-1 empty state (no open weekend)", () => {
  it("[null/empty] no chip row, no type hint, the empty testid carries the question text, cancel stays the way out", () => {
    renderStep({
      kind: "question",
      step: "date",
      isCurrent: true,
      questionText: "No Saturdays are open in this stretch. Type the day you have in mind and I'll go look.",
      chips: [],
      controls: [{ kind: "cancel" }],
    });

    const empty = screen.getByTestId("empty--ai-chat-booking-no-dates");
    expect(empty.textContent).toBe(
      "No Saturdays are open in this stretch. Type the day you have in mind and I'll go look."
    );
    expect(screen.queryByTestId("group--ai-chat-booking-chips")).toBeNull();
    expect(screen.queryByTestId("text--ai-chat-booking-type-hint")).toBeNull();
    expect(screen.getByTestId("btn--ai-chat-booking-cancel")).toBeTruthy();
  });
});

describe("guests question — AC-1 default + BR chip formula", () => {
  it("[normal] renders guest-count chips + a back-to-date control", () => {
    const onBack = vi.fn();
    renderStep(
      {
        kind: "question",
        step: "guests",
        isCurrent: true,
        questionText: "Sat, 8 Aug it is. That day has 6 spots left. How many of you are going?",
        chips: [
          { kind: "guests", count: 1 },
          { kind: "guests", count: 2 },
        ],
        controls: [{ kind: "back", toStep: "date" }, { kind: "cancel" }],
      },
      { onBack }
    );

    const chips = within(screen.getByTestId("group--ai-chat-booking-chips")).getAllByTestId("btn--ai-chat-booking-chip");
    expect(chips.map((c) => c.textContent)).toEqual(["1 people", "2 people"]);

    const backBtn = screen.getByTestId("btn--ai-chat-booking-back");
    expect(backBtn.getAttribute("data-step")).toBe("date");
    expect(backBtn.textContent).toBe("Back");
    fireEvent.click(backBtn);
    expect(onBack).toHaveBeenCalledWith("date");
  });
});

describe("guests checking — the one async moment (loading.md: text status, no spinner)", () => {
  it("[unit] chips are disabled + aria-busy, and a role=status line renders (design brief §4)", () => {
    renderStep({
      kind: "question",
      step: "guests",
      isCurrent: true,
      questionText: "How many of you are going?",
      chips: [{ kind: "guests", count: 2 }],
      isChecking: true,
      controls: [{ kind: "back", toStep: "date" }],
    });

    const chipGroup = screen.getByTestId("group--ai-chat-booking-chips");
    expect(chipGroup.getAttribute("aria-busy")).toBe("true");
    const chip = screen.getByTestId("btn--ai-chat-booking-chip");
    expect((chip as HTMLButtonElement).disabled).toBe(true);

    const status = screen.getByTestId("status--ai-chat-booking-checking");
    expect(status.getAttribute("role")).toBe("status");
    expect(status.getAttribute("aria-live")).toBe("polite");
    expect(status.textContent).toBe("Checking availability…");
  });
});

describe("E2 — over capacity offers exactly one ceiling chip (guests stays current, no rewind)", () => {
  it("[boundary] the sole chip is the cap offer, value = the ceiling count", () => {
    renderStep({
      kind: "question",
      step: "guests",
      isCurrent: true,
      questionText: "Sat, 8 Aug has 4 spots left, so 6 people may not fit.",
      chips: [{ kind: "guestsCap", count: 4 }],
      controls: [{ kind: "back", toStep: "date" }, { kind: "cancel" }],
    });
    const chip = screen.getByTestId("btn--ai-chat-booking-chip");
    expect(chip.getAttribute("data-value")).toBe("4");
    expect(chip.textContent).toBe("4 works");
  });
});

describe("E1 — the day filled up rewinds to a normal date question (fresh chips, same shape)", () => {
  it("[normal] renders as an ordinary current date block with the just-filled sentence", () => {
    renderStep({
      kind: "question",
      step: "date",
      isCurrent: true,
      questionText: "Sorry, Sat, 8 Aug filled up just now. Want to try another day?",
      chips: [{ kind: "date", date: "2026-08-15", remaining: 3 }],
      controls: [{ kind: "cancel" }],
    });
    expect(screen.getByTestId("msg--ai-chat-booking-step").getAttribute("data-step")).toBe("date");
    expect(screen.getByText("Sorry, Sat, 8 Aug filled up just now. Want to try another day?")).toBeTruthy();
  });
});

describe("summary — AC-4 the draft card + honest total + non-confirming handoff", () => {
  it("[normal] renders all 4 rows, the not-charged + estimate captions, and a <Link> handoff (never confirmation copy)", () => {
    const onEditDate = vi.fn();
    const onEditGuests = vi.fn();
    renderStep(
      {
        kind: "summary",
        isCurrent: true,
        campValue: "Phu Chi Fa",
        datesValue: "Sat, 8 Aug, 1 night",
        guestsValue: "2 people",
        totalValue: "฿500",
        handoffHref: "/campgrounds/phu-chi-fa?checkIn=2026-08-08&checkOut=2026-08-09&guests=2",
        controls: [{ kind: "editDate" }, { kind: "editGuests" }, { kind: "cancel" }],
      },
      { onEditDate, onEditGuests }
    );

    // CAM-699 — `summary` is now step 4 of 4 (date, nights, guests, summary).
    expect(screen.getByTestId("text--ai-chat-booking-step-caption").textContent).toContain("Step 4 of 4");

    const rows = screen.getAllByTestId("row--ai-chat-booking-summary-line");
    expect(rows).toHaveLength(4);
    expect(rows.map((r) => r.getAttribute("data-field"))).toEqual(["camp", "dates", "guests", "total"]);
    expect(rows[0]!.textContent).toBe("CampsitePhu Chi Fa");
    expect(rows[3]!.textContent).toBe("Estimated total฿500");

    expect(screen.getByText("You won't be charged yet")).toBeTruthy();
    expect(
      screen.getByText("The camp's own fees aren't included here. See the full amount at the booking page.")
    ).toBeTruthy();

    // Button asChild + Slot clones the anchor itself (no separate wrapper element).
    const handoff = screen.getByTestId("btn--ai-chat-booking-handoff");
    expect(handoff.textContent).toContain("Continue at the booking page");
    expect(handoff.textContent).not.toMatch(/confirm|book now/i);
    expect(handoff.getAttribute("href")).toBe(
      "/campgrounds/phu-chi-fa?checkIn=2026-08-08&checkOut=2026-08-09&guests=2"
    );

    // two elements share the "edit" testid (date + guests) distinguished by data-step
    const editButtons = screen.getAllByTestId("btn--ai-chat-booking-edit");
    expect(editButtons).toHaveLength(2);
    expect(editButtons[0]!.getAttribute("data-step")).toBe("date");
    expect(editButtons[1]!.getAttribute("data-step")).toBe("guests");
    fireEvent.click(editButtons[0]!);
    expect(onEditDate).toHaveBeenCalledOnce();
    fireEvent.click(editButtons[1]!);
    expect(onEditGuests).toHaveBeenCalledOnce();
  });
});

describe("E3 — the re-check itself failed (design brief §5: reuse ErrorBanner + aiChat.retry verbatim, no step block)", () => {
  it("[error] renders ErrorBanner + a retry button, with NO step-block wrapper, and retry re-runs the check", () => {
    const onRetry = vi.fn();
    renderStep({ kind: "checkFailed", onRetry });

    expect(screen.queryByTestId("msg--ai-chat-booking-step")).toBeNull();
    const banner = screen.getByTestId("error--ai-chat-booking-check-failed");
    expect(banner.getAttribute("role")).toBe("alert");
    expect(banner.textContent).toContain("Couldn't check availability. Please try again.");

    const retryBtn = screen.getByTestId("btn--ai-chat-retry");
    expect(retryBtn.textContent).toBe("Try again");
    fireEvent.click(retryBtn);
    expect(onRetry).toHaveBeenCalledOnce();
  });
});

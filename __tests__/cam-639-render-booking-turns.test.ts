// @vitest-environment jsdom
/**
 * cam-639-render-booking-turns.test.ts — CAM-639 (epic CAM-630, in-chat
 * guided booking)
 *
 * Fixture-driven render coverage proving `AiChatMessageList` mounts the
 * CAM-638 `AiChatBookingStep` presentation for a `kind:"booking"` entry
 * (`conversation.ts`) — the wiring this story adds. Covers every step id in
 * the registry (date/guests/summary) plus the design brief's three error
 * shapes (§5): E1 (day filled up — a normal `date` question render with
 * fresh copy), E2 (over capacity — a normal `guests` question render with
 * the single ceiling chip), E3 (the re-check itself failed — the dedicated
 * `checkFailed` view, no step-block wrapper).
 *
 * `next/link` is mocked the same way `cam-638-ai-chat-booking-step.test.ts`
 * does, purely to keep this a component test (the summary fixture's handoff
 * button renders via `<Button asChild><Link .../></Button>`).
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import * as React from "react";
import { render, screen, cleanup } from "@testing-library/react";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { AiChatMessageList } from "@/components/ai-chat/AiChatMessageList";
import type { ChatEntry } from "@/components/ai-chat/conversation";
import type { BookingStepId } from "@/components/ai-chat/booking-flow";
import type { BookingStepView } from "@/components/ai-chat/AiChatBookingStep";

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

function bookingEntry(step: BookingStepId, view: BookingStepView, id = "b1"): ChatEntry {
  return { id, role: "assistant", kind: "booking", step, view };
}

function renderEntries(entries: ChatEntry[]) {
  render(
    React.createElement(
      LanguageProvider,
      null,
      React.createElement(AiChatMessageList, {
        entries,
        sending: false,
        resuming: false,
        // CAM-703 (2026-08-06) — AiChatMessageListProps grew a required
        // liveAuthed prop; false is neutral for every fixture this file
        // renders (none of them use a `confirm`-kind cta).
        liveAuthed: false,
        onSuggestion: vi.fn(),
        onRetry: vi.fn(),
        onSelectCamp: vi.fn(),
        // CAM-640 — this story wires these; fixture-only no-ops here (the
        // real wiring is covered by cam-640-*.test.ts). CAM-702 (2026-08-06)
        // added onBookingConfirm/onBookingCheckAndRetry to the same prop
        // contract; fixture-only no-ops here too (real wiring covered by
        // cam-702-*.test.ts).
        onBookingChipSelect: vi.fn(),
        onBookingBack: vi.fn(),
        onBookingEditDate: vi.fn(),
        onBookingEditGuests: vi.fn(),
        onBookingCancel: vi.fn(),
        onBookingConfirm: vi.fn(),
        onBookingCheckAndRetry: vi.fn(),
      })
    )
  );
}

afterEach(() => cleanup());

describe("AiChatMessageList — kind:'booking' entry mounts AiChatBookingStep, per step id", () => {
  it("[normal] step 'date' renders the step block with data-step='date'", () => {
    const view: BookingStepView = {
      kind: "question",
      step: "date",
      isCurrent: true,
      questionText: "Let's get Phu Chi Fa booked. Which day would you like?",
      chips: [{ kind: "date", date: "2026-08-08", remaining: 6 }],
      controls: [{ kind: "cancel" }],
    };
    renderEntries([bookingEntry("date", view)]);
    const block = screen.getByTestId("msg--ai-chat-booking-step");
    expect(block.getAttribute("data-step")).toBe("date");
    expect(screen.getByText("Let's get Phu Chi Fa booked. Which day would you like?")).toBeTruthy();
  });

  it("[normal] step 'guests' renders the step block with data-step='guests'", () => {
    const view: BookingStepView = {
      kind: "question",
      step: "guests",
      isCurrent: true,
      questionText: "Sat, 8 Aug it is. That day has 6 spots left. How many of you are going?",
      chips: [{ kind: "guests", count: 1 }],
      controls: [{ kind: "back", toStep: "date" }],
    };
    renderEntries([bookingEntry("guests", view)]);
    expect(screen.getByTestId("msg--ai-chat-booking-step").getAttribute("data-step")).toBe("guests");
  });

  it("[normal] step 'summary' renders the summary block", () => {
    const view: BookingStepView = {
      kind: "summary",
      isCurrent: true,
      campValue: "Phu Chi Fa",
      datesValue: "Sat, 8 Aug, 1 night",
      guestsValue: "2 people",
      totalValue: "฿500",
      // CAM-701 — `handoffHref` renamed to the `cta` discriminator.
      cta: { kind: "handoff", href: "/campgrounds/phu-chi-fa?checkIn=2026-08-08&checkOut=2026-08-09&guests=2" },
      controls: [{ kind: "editDate" }, { kind: "editGuests" }, { kind: "cancel" }],
    };
    renderEntries([bookingEntry("summary", view)]);
    expect(screen.getByTestId("msg--ai-chat-booking-step").getAttribute("data-step")).toBe("summary");
    expect(screen.getByTestId("btn--ai-chat-booking-handoff").getAttribute("href")).toBe(
      "/campgrounds/phu-chi-fa?checkIn=2026-08-08&checkOut=2026-08-09&guests=2"
    );
  });

  it("[error/validation] E1 — day filled up rewinds to an ordinary 'date' question with fresh copy", () => {
    const view: BookingStepView = {
      kind: "question",
      step: "date",
      isCurrent: true,
      questionText: "Sorry, Sat, 8 Aug filled up just now. Want to try another day?",
      chips: [{ kind: "date", date: "2026-08-15", remaining: 3 }],
      controls: [{ kind: "cancel" }],
    };
    renderEntries([bookingEntry("date", view)]);
    expect(screen.getByTestId("msg--ai-chat-booking-step").getAttribute("data-step")).toBe("date");
    expect(screen.getByText("Sorry, Sat, 8 Aug filled up just now. Want to try another day?")).toBeTruthy();
  });

  it("[error/validation] E2 — over capacity stays on 'guests' with the single ceiling chip", () => {
    const view: BookingStepView = {
      kind: "question",
      step: "guests",
      isCurrent: true,
      questionText: "Sat, 8 Aug has 4 spots left, so 6 people may not fit.",
      chips: [{ kind: "guestsCap", count: 4 }],
      controls: [{ kind: "back", toStep: "date" }, { kind: "cancel" }],
    };
    renderEntries([bookingEntry("guests", view)]);
    const chip = screen.getByTestId("btn--ai-chat-booking-chip");
    expect(chip.getAttribute("data-value")).toBe("4");
    expect(chip.textContent).toBe("4 works");
  });

  it("[error/validation] E3 — the re-check itself failed renders the dedicated checkFailed view, no step-block wrapper", () => {
    const view: BookingStepView = { kind: "checkFailed", onRetry: vi.fn() };
    renderEntries([bookingEntry("guests", view)]);
    expect(screen.queryByTestId("msg--ai-chat-booking-step")).toBeNull();
    expect(screen.getByTestId("error--ai-chat-booking-check-failed")).toBeTruthy();
  });
});

describe("AiChatMessageList — a booking entry carries no added motion", () => {
  it("[unit] the rendered block has no motion-safe/animate/transition class of AiChatMessageList's own", () => {
    const view: BookingStepView = {
      kind: "question",
      step: "date",
      isCurrent: true,
      questionText: "q",
      chips: [],
      controls: [],
    };
    renderEntries([bookingEntry("date", view)]);
    // AiChatBookingStep itself carries no motion class (CAM-638); this only
    // guards that AiChatMessageList's new branch doesn't wrap it in one.
    const block = screen.getByTestId("msg--ai-chat-booking-step");
    expect(block.parentElement?.className ?? "").not.toMatch(/animate-|transition-/);
  });
});

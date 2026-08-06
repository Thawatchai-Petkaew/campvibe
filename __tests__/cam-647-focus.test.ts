// @vitest-environment jsdom
/**
 * cam-647-focus.test.ts — CAM-647 (epic CAM-695, ADR-016 decision point 5)
 * "The chat summary is checked against live availability before it is
 * shown" — STEP-TRANSITION FOCUS MANAGEMENT
 *
 * Fixture-driven render coverage, same jsdom + @testing-library/react
 * pattern cam-638/cam-699/cam-700/cam-701's own step-render tests already
 * establish. Every distinct booking entry mounts its OWN `AiChatBookingStep`
 * instance exactly once (a superseded entry re-renders in place, never
 * remounts — see the component's own CAM-647 comment), so asserting
 * `document.activeElement` right after `render()` proves the mount-time
 * focus behaviour the design brief's focus table (round1 §7 / round2 §10)
 * requires.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import * as React from "react";
import { render, cleanup } from "@testing-library/react";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { AiChatBookingStep, type BookingStepView } from "@/components/ai-chat/AiChatBookingStep";

interface MockLinkProps {
  href: string;
  children?: React.ReactNode;
  className?: string;
  "data-testid"?: string;
}

vi.mock("next/link", () => {
  const MockLink = React.forwardRef<HTMLAnchorElement, MockLinkProps>(({ href, children, ...rest }, ref) =>
    React.createElement("a", { href, ref, ...rest }, children)
  );
  MockLink.displayName = "MockNextLink";
  return { __esModule: true, default: MockLink };
});

function renderStep(view: BookingStepView) {
  render(React.createElement(LanguageProvider, null, React.createElement(AiChatBookingStep, { view })));
}

afterEach(() => cleanup());

const BASE_ROWS = {
  campValue: "Phu Chi Fa",
  datesValue: "Sat, 8 Aug, 2 nights",
  guestsValue: "2 people",
  totalValue: "฿1,000",
};

describe("question view — a chip-triggered transition (focusCaption absent) moves focus to the caption", () => {
  it("[normal] the step caption is the active element on mount", () => {
    renderStep({
      kind: "question",
      step: "guests",
      isCurrent: true,
      questionText: "How many of you are going?",
      chips: [],
      controls: [{ kind: "back", toStep: "nights" }, { kind: "cancel" }],
    });
    expect(document.activeElement?.getAttribute("data-testid")).toBe("text--ai-chat-booking-step-caption");
  });
});

describe("question view — a typed-triggered transition (focusCaption:false) leaves focus alone", () => {
  it("[normal] the caption is NOT the active element on mount (the composer keeps the caret)", () => {
    renderStep({
      kind: "question",
      step: "guests",
      isCurrent: true,
      questionText: "How many of you are going?",
      chips: [],
      controls: [{ kind: "back", toStep: "nights" }, { kind: "cancel" }],
      focusCaption: false,
    });
    expect(document.activeElement?.getAttribute("data-testid")).not.toBe("text--ai-chat-booking-step-caption");
  });
});

describe("question view — the checking (isChecking) interim state respects the SAME focusCaption rule", () => {
  it("[normal] a chip-triggered checking block still focuses its caption", () => {
    renderStep({
      kind: "question",
      step: "guests",
      isCurrent: true,
      questionText: "How many of you are going?",
      chips: [],
      isChecking: true,
      controls: [{ kind: "back", toStep: "nights" }, { kind: "cancel" }],
    });
    expect(document.activeElement?.getAttribute("data-testid")).toBe("text--ai-chat-booking-step-caption");
  });
});

describe("summary view — always focuses its caption (never reached via a typed trigger)", () => {
  it("[normal] the step caption is the active element on mount", () => {
    renderStep({
      kind: "summary",
      isCurrent: true,
      ...BASE_ROWS,
      cta: { kind: "handoff", href: "/campgrounds/phu-chi-fa" },
      controls: [{ kind: "cancel" }],
    });
    expect(document.activeElement?.getAttribute("data-testid")).toBe("text--ai-chat-booking-step-caption");
  });
});

describe("submitting view — focus stays on the confirm button (a FRESH mount re-focuses it explicitly)", () => {
  it("[normal] the aria-disabled confirm button is the active element on mount", () => {
    renderStep({
      kind: "submitting",
      ...BASE_ROWS,
      controls: [{ kind: "cancel" }],
    });
    expect(document.activeElement?.getAttribute("data-testid")).toBe("btn--ai-chat-booking-confirm");
  });
});

describe("booked view — focuses the success heading (the camper hears the outcome before the next action)", () => {
  it("[normal] the success title heading is the active element on mount", () => {
    renderStep({
      kind: "booked",
      bookingId: "bk_123",
      ...BASE_ROWS,
    });
    expect(document.activeElement?.getAttribute("data-testid")).toBe("text--ai-chat-booking-success-title");
  });
});

describe("bookingFailed view — focuses the ErrorBanner (F1/F2/F3)", () => {
  it("[normal] the error banner container is the active element on mount", () => {
    renderStep({
      kind: "bookingFailed",
      reason: "uncertain",
      ...BASE_ROWS,
    });
    expect(document.activeElement?.getAttribute("data-testid")).toBe("error--ai-chat-booking-failed");
  });
});

describe("checkFailed view — focuses the ลองใหม่ retry button (the row that had focus is gone)", () => {
  it("[normal] the retry button is the active element on mount", () => {
    renderStep({ kind: "checkFailed", onRetry: () => {} });
    expect(document.activeElement?.getAttribute("data-testid")).toBe("btn--ai-chat-retry");
  });
});

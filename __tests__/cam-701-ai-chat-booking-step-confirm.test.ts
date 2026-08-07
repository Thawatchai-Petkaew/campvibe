// @vitest-environment jsdom
/**
 * cam-701-ai-chat-booking-step-confirm.test.ts — CAM-701 (epic CAM-695,
 * design brief CAM-697 §5-§9)
 *
 * Fixture-driven render coverage, same jsdom + @testing-library/react
 * pattern cam-638/cam-699/cam-700's own step-render tests already
 * establish. PRESENTATION ONLY (see `AiChatBookingStep.tsx`'s CAM-701 file
 * header) — every handler below is a `vi.fn()` fixture; no network call
 * exists yet (that is CAM-702's surface).
 *
 * Covers:
 *  - the `cta` discriminator on `summary` (confirm vs the interim handoff
 *    escape) and that both call the SAME `onConfirm` prop where applicable;
 *  - the two a11y Critical fixes this story owns: an in-flight confirm uses
 *    `aria-disabled` (never `disabled`, §6), a SUPERSEDED summary's confirm
 *    + every control is REALLY `disabled` (§5);
 *  - `submitting`, `booked`, and both `bookingFailed` flavours tested here
 *    (F1 rateLimited, F2 uncertain — F3 sessionExpired is covered by its own
 *    fixture too, all three share one render branch);
 *  - the dropped `role="row"` (design brief §12 Important).
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import * as React from "react";
import { render, screen, within, fireEvent, cleanup } from "@testing-library/react";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { AiChatBookingStep, type BookingStepView } from "@/components/ai-chat/AiChatBookingStep";

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
    onConfirm?: () => void;
    onCheckAndRetry?: () => void;
    // CAM-703 (2026-08-06) — the LIVE session override for the confirm
    // control's displayed label/data-auth; defaults false (guest) to match
    // AiChatBookingStepProps's own default.
    liveAuthed?: boolean;
  } = {}
) {
  render(React.createElement(LanguageProvider, null, React.createElement(AiChatBookingStep, { view, ...handlers })));
}

afterEach(() => cleanup());

const BASE_ROWS = {
  campValue: "Phu Chi Fa",
  datesValue: "Sat, 8 Aug, 2 nights",
  guestsValue: "2 people",
  totalValue: "฿1,000",
};

describe("summary — confirm CTA (design brief §5, 'one control two labels')", () => {
  // CAM-703 (2026-08-06 dated supersede) — the rendered label/data-auth now
  // come from the LIVE `liveAuthed` prop, never the fixture's own
  // `cta.label`/`authState` (design brief §5's critical note — see
  // AiChatBookingStep.tsx's own doc comment). Both tests below now pass
  // `liveAuthed` explicitly and assert the LIVE-derived copy; the full
  // live-flip matrix (a stale `cta.authState:'guest'` still rendering
  // ยืนยันการจอง once `liveAuthed:true`) is cam-703-login-gate.test.ts's own
  // surface.
  it("[normal] liveAuthed:true renders ยืนยันการจอง, data-auth=member, and calls onConfirm on tap", () => {
    const onConfirm = vi.fn();
    renderStep(
      {
        kind: "summary",
        isCurrent: true,
        ...BASE_ROWS,
        cta: { kind: "confirm", label: "Confirm booking", authState: "member" },
        controls: [{ kind: "editDate" }, { kind: "editGuests" }, { kind: "cancel" }],
      },
      { onConfirm, liveAuthed: true }
    );

    const btn = screen.getByTestId("btn--ai-chat-booking-confirm");
    expect(btn.getAttribute("data-auth")).toBe("member");
    expect(btn.textContent).toBe("Confirm booking");
    expect((btn as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(btn);
    expect(onConfirm).toHaveBeenCalledOnce();

    // the intro sentence switches to the confirm-flavoured copy (never the
    // round-1 handoff sentence) once the CTA writes.
    expect(screen.getByText("Have a look. If it's right, go ahead and confirm.")).toBeTruthy();
  });

  it("[normal] liveAuthed:false (default) renders the login-to-confirm label, same testid + position, and still calls onConfirm", () => {
    const onConfirm = vi.fn();
    renderStep(
      {
        kind: "summary",
        isCurrent: true,
        ...BASE_ROWS,
        cta: { kind: "confirm", label: "Sign in to confirm booking", authState: "guest" },
        controls: [{ kind: "editDate" }, { kind: "editGuests" }, { kind: "cancel" }],
      },
      { onConfirm }
    );

    const btn = screen.getByTestId("btn--ai-chat-booking-confirm");
    expect(btn.getAttribute("data-auth")).toBe("guest");
    expect(btn.textContent).toBe("Sign in to confirm booking");
    fireEvent.click(btn);
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it("[normal] a per-spot summary still renders the handoff <Link> (the interim CAM-700 escape, unchanged intro copy)", () => {
    renderStep({
      kind: "summary",
      isCurrent: true,
      ...BASE_ROWS,
      spotValue: "Riverside A",
      cta: { kind: "handoff", href: "/campgrounds/phu-chi-fa?checkIn=2026-08-08&checkOut=2026-08-10&guests=2" },
      controls: [{ kind: "editDate" }, { kind: "editGuests" }, { kind: "editSpot" }, { kind: "cancel" }],
    });

    const handoff = screen.getByTestId("btn--ai-chat-booking-handoff");
    expect(handoff.getAttribute("href")).toBe("/campgrounds/phu-chi-fa?checkIn=2026-08-08&checkOut=2026-08-10&guests=2");
    expect(screen.queryByTestId("btn--ai-chat-booking-confirm")).toBeNull();
    // the round-1 sentence is still accurate for THIS cta shape.
    expect(screen.getByText("Have a look. If it's right, carry on at the booking page.")).toBeTruthy();
  });
});

describe("summary — superseded (isCurrent:false) goes REALLY inert (design brief §5 Critical, flag 3)", () => {
  it("[unit] a superseded CONFIRM summary's CTA + every control take the real `disabled` attribute, and a tap is a no-op", () => {
    const onConfirm = vi.fn();
    const onEditDate = vi.fn();
    renderStep(
      {
        kind: "summary",
        isCurrent: false,
        ...BASE_ROWS,
        cta: { kind: "confirm", label: "Confirm booking", authState: "member" },
        controls: [{ kind: "editDate" }, { kind: "cancel" }],
      },
      { onConfirm, onEditDate }
    );

    const btn = screen.getByTestId("btn--ai-chat-booking-confirm") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    fireEvent.click(btn);
    expect(onConfirm).not.toHaveBeenCalled();

    const editBtn = screen.getByTestId("btn--ai-chat-booking-edit") as HTMLButtonElement;
    expect(editBtn.disabled).toBe(true);
    fireEvent.click(editBtn);
    expect(onEditDate).not.toHaveBeenCalled();
  });

  it("[unit] a superseded HANDOFF summary renders a real disabled button (no live <a>), not merely handler-less", () => {
    renderStep({
      kind: "summary",
      isCurrent: false,
      ...BASE_ROWS,
      cta: { kind: "handoff", href: "/campgrounds/phu-chi-fa?checkIn=2026-08-08&checkOut=2026-08-10&guests=2" },
      controls: [{ kind: "cancel" }],
    });
    const handoff = screen.getByTestId("btn--ai-chat-booking-handoff");
    expect(handoff.tagName).toBe("BUTTON");
    expect((handoff as HTMLButtonElement).disabled).toBe(true);
  });
});

describe("submitting — the write in flight (design brief §6 Critical, flag 2)", () => {
  it("[unit] the confirm button is aria-disabled (never the `disabled` attribute), a role=status line renders, and every OTHER control is really disabled", () => {
    renderStep({
      kind: "submitting",
      ...BASE_ROWS,
      controls: [{ kind: "editDate" }, { kind: "editGuests" }, { kind: "cancel" }],
    });

    const confirmBtn = screen.getByTestId("btn--ai-chat-booking-confirm") as HTMLButtonElement;
    expect(confirmBtn.getAttribute("aria-disabled")).toBe("true");
    expect(confirmBtn.disabled).toBe(false); // Critical: never the real attribute — it must keep focus

    const status = screen.getByTestId("status--ai-chat-booking-submitting");
    expect(status.getAttribute("role")).toBe("status");
    expect(status.getAttribute("aria-live")).toBe("polite");
    expect(status.textContent).toBe("Confirming your booking…");

    const editBtn = screen.getAllByTestId("btn--ai-chat-booking-edit")[0] as HTMLButtonElement;
    expect(editBtn.disabled).toBe(true);
    const cancelBtn = screen.getByTestId("btn--ai-chat-booking-cancel") as HTMLButtonElement;
    expect(cancelBtn.disabled).toBe(true);

    // the summary rows stay on screen, frozen, unchanged.
    const rows = screen.getAllByTestId("row--ai-chat-booking-summary-line");
    expect(rows.map((r) => r.getAttribute("data-field"))).toEqual(["camp", "dates", "guests", "total"]);
    expect(screen.getByTestId("text--ai-chat-booking-step-caption").textContent).toContain("Step 4 of 4");
  });
});

describe("booked — the terminal success state (design brief §7)", () => {
  it("[normal] the heading, the server total (not the estimate label), the pending note, both links, and NO booking code", () => {
    renderStep({
      kind: "booked",
      bookingId: "bk_123",
      campValue: "Phu Chi Fa",
      datesValue: "Sat, 8 Aug, 2 nights",
      guestsValue: "2 people",
      spotValue: "Riverside A",
      totalValue: "฿1,000",
    });

    const heading = screen.getByTestId("text--ai-chat-booking-success-title");
    expect(heading.textContent).toBe("Booking confirmed");
    expect(heading.getAttribute("tabIndex")).toBe("-1");

    const card = screen.getByTestId("block--ai-chat-booking-success");
    expect(card.getAttribute("role")).toBe("group");

    const rows = within(card).getAllByTestId("row--ai-chat-booking-success-line");
    expect(rows.map((r) => r.getAttribute("data-field"))).toEqual(["camp", "dates", "guests", "spot", "total"]);
    // the SERVER total is labelled flat "Total", never "Estimated total".
    expect(rows[4]!.textContent).toBe("Total฿1,000");

    expect(screen.getByText("You won't be charged yet")).toBeTruthy();
    expect(screen.getByText("The camp will confirm your booking.")).toBeTruthy();

    const viewBooking = screen.getByTestId("btn--ai-chat-booking-view-confirmation");
    expect(viewBooking.getAttribute("href")).toBe("/bookings/bk_123/confirmation");
    const viewAll = screen.getByTestId("btn--ai-chat-booking-view-bookings");
    expect(viewAll.getAttribute("href")).toBe("/bookings");

    // no booking reference / code anywhere on this card (design brief §7).
    expect(screen.queryByText(/CAMP-/)).toBeNull();
    expect(screen.queryByTestId("msg--ai-chat-booking-step")).toBeNull();
    expect(screen.queryByTestId("group--ai-chat-booking-controls")).toBeNull();
  });
});

describe("bookingFailed — F1/F2/F3 (design brief §8)", () => {
  it("[error/validation] F1 rateLimited — banner + the summary rows intact + the confirm CTA re-enabled (no new buttons)", () => {
    const onConfirm = vi.fn();
    renderStep(
      {
        kind: "bookingFailed",
        reason: "rateLimited",
        ...BASE_ROWS,
        cta: { kind: "confirm", label: "Confirm booking", authState: "member" },
      },
      { onConfirm }
    );

    const banner = screen.getByTestId("error--ai-chat-booking-failed");
    expect(banner.getAttribute("data-reason")).toBe("rateLimited");
    expect(banner.getAttribute("tabIndex")).toBe("-1");
    expect(banner.textContent).toContain("That's a lot of booking attempts in a row. Wait a moment, then confirm again.");

    const rows = screen.getAllByTestId("row--ai-chat-booking-summary-line");
    expect(rows.map((r) => r.getAttribute("data-field"))).toEqual(["camp", "dates", "guests", "total"]);

    const confirmBtn = screen.getByTestId("btn--ai-chat-booking-confirm") as HTMLButtonElement;
    expect(confirmBtn.disabled).toBe(false);
    fireEvent.click(confirmBtn);
    expect(onConfirm).toHaveBeenCalledOnce();

    expect(screen.queryByTestId("btn--ai-chat-booking-check-retry")).toBeNull();
  });

  it("[error/validation] F2 uncertain — banner + check-and-retry (primary) + view-my-bookings (secondary), NO plain confirm button", () => {
    const onCheckAndRetry = vi.fn();
    renderStep(
      { kind: "bookingFailed", reason: "uncertain", ...BASE_ROWS },
      { onCheckAndRetry }
    );

    const banner = screen.getByTestId("error--ai-chat-booking-failed");
    expect(banner.getAttribute("data-reason")).toBe("uncertain");
    expect(banner.textContent).toContain("I'm not sure yet whether the booking went through. Check first so you don't book twice.");

    expect(screen.queryByTestId("btn--ai-chat-booking-confirm")).toBeNull();

    const retryBtn = screen.getByTestId("btn--ai-chat-booking-check-retry");
    expect(retryBtn.textContent).toBe("Check, then try again");
    fireEvent.click(retryBtn);
    expect(onCheckAndRetry).toHaveBeenCalledOnce();

    const viewMine = screen.getByTestId("btn--ai-chat-booking-view-my-bookings");
    expect(viewMine.textContent).toBe("See my bookings");
    expect(viewMine.getAttribute("href")).toBe("/bookings");
  });

  it("[error/validation] F3 sessionExpired — banner + the CTA reverted to login-to-confirm", () => {
    const onConfirm = vi.fn();
    renderStep(
      {
        kind: "bookingFailed",
        reason: "sessionExpired",
        ...BASE_ROWS,
        cta: { kind: "confirm", label: "Sign in to confirm booking", authState: "guest" },
      },
      { onConfirm }
    );

    const banner = screen.getByTestId("error--ai-chat-booking-failed");
    expect(banner.getAttribute("data-reason")).toBe("sessionExpired");
    expect(banner.textContent).toContain("You've been signed out. Sign in again, then confirm.");

    const btn = screen.getByTestId("btn--ai-chat-booking-confirm");
    expect(btn.getAttribute("data-auth")).toBe("guest");
    expect(btn.textContent).toBe("Sign in to confirm booking");
    fireEvent.click(btn);
    expect(onConfirm).toHaveBeenCalledOnce();
  });
});

describe("a11y — the dropped role=\"row\" (design brief §12 Important, flag 4)", () => {
  it("[unit] no summary/success row carries role=\"row\" (was an orphan aria-required-parent violation)", () => {
    renderStep({
      kind: "summary",
      isCurrent: true,
      ...BASE_ROWS,
      cta: { kind: "confirm", label: "Confirm booking", authState: "member" },
      controls: [{ kind: "cancel" }],
    });
    for (const row of screen.getAllByTestId("row--ai-chat-booking-summary-line")) {
      expect(row.hasAttribute("role")).toBe(false);
    }
  });
});

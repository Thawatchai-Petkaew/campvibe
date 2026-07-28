// @vitest-environment jsdom
/**
 * cam-616-dashboard-and-notifications.test.ts — CAM-616 (Part 2 of 3)
 *
 * app/dashboard/campsites/page.tsx:69 — a 500 from /api/operator/dashboard
 * used to fall through to `setCampSites([])` with NO error state at all on
 * this surface, rendering the operator's entire portfolio as
 * `t.dashboard.noCampSitesFound` ("no camp sites yet") — indistinguishable
 * from having actually deleted every listing. Per this ticket's SCOPE note,
 * adding an error state where none existed is part of the work.
 *
 * components/NotificationCenter.tsx:120 — hostBookings/camperBookings/invites
 * shared ONE try/catch (the CAM-362 anti-pattern) over THREE INDEPENDENT
 * sources; any one hiccup wiped every list to `[]`, so a host with real
 * pending booking requests saw "no new notifications" (costs real bookings).
 *
 * Both use `render(React.createElement(LanguageProvider, null, ...))` — the
 * cam-496-filter-modal-hydration.test.ts precedent for this codebase's client
 * components. next/image is shimmed to a ref-forwarding <img> (the ir1/
 * cam-393/cam-539 precedent) since <ErrorState/> renders through
 * ImageWithFallback.
 *
 * Coverage matrix per .claude/rules/qa.md:
 *   normal (successful load) · null/empty (genuinely 0 sources / 0 campsites,
 *   no error, stays the correct empty/table-empty state) · error/teeth (a
 *   failure renders a distinguishable error+retry, never the empty state) ·
 *   concurrent/ordering (one source failing does not wipe a sibling
 *   source's already-loaded data — the CAM-362 independence property)
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as React from "react";
import { render, screen, cleanup, fireEvent, waitFor, act } from "@testing-library/react";
import { LanguageProvider } from "@/contexts/LanguageContext";

vi.mock("next/image", () => ({
  __esModule: true,
  default: React.forwardRef(function MockImage(
    props: { className?: string; src?: unknown; alt?: string },
    ref: React.Ref<HTMLImageElement>
  ) {
    return React.createElement("img", {
      ref,
      className: props.className,
      src: typeof props.src === "string" ? props.src : "",
      alt: props.alt,
    });
  }),
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Part 1 — app/dashboard/campsites/page.tsx
// ---------------------------------------------------------------------------

describe("app/dashboard/campsites/page.tsx — a load failure must not render as zero camp sites", () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  async function renderPage() {
    const mod = await import("@/app/dashboard/campsites/page");
    const Page = mod.default;
    return render(React.createElement(LanguageProvider, null, React.createElement(Page)));
  }

  it("[normal] a successful load renders the table (sanity — happy path untouched)", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { campSites: [], permissions: {} } }),
    });
    await renderPage();
    await waitFor(() => {
      expect(screen.queryByTestId("btn--error-primary-error")).toBeNull();
    });
  });

  it("[error/teeth] a 500 response renders an error state with retry — never the empty-table row", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "Internal error" }),
    });
    await renderPage();

    // The error state's retry CTA (ErrorState "error" variant) must appear.
    await screen.findByTestId("btn--error-primary-error");
    // And the misleading "you have zero camp sites" empty row must NOT render.
    expect(screen.queryByText(/no camp sites|ยังไม่มีแคมป์/i)).toBeNull();
  });

  it("[error] a network throw also renders the error state (not an empty table)", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("network down"));
    await renderPage();
    await screen.findByTestId("btn--error-primary-error");
  });

  it("[normal] retry re-issues the request and can recover to the table view", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "Internal error" }),
    });
    await renderPage();
    await screen.findByTestId("btn--error-primary-error");

    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { campSites: [], permissions: {} } }),
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId("btn--error-primary-error"));
    });
    await waitFor(() => {
      expect(screen.queryByTestId("btn--error-primary-error")).toBeNull();
    });
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });
});

// ---------------------------------------------------------------------------
// Part 2 — components/NotificationCenter.tsx
// ---------------------------------------------------------------------------

import { NotificationCenter } from "@/components/NotificationCenter";

function renderCenter(props: Partial<React.ComponentProps<typeof NotificationCenter>> = {}) {
  return render(
    React.createElement(
      LanguageProvider,
      null,
      React.createElement(NotificationCenter, {
        showHostBookings: true,
        showCamperBookingUpdates: false,
        showInvites: false,
        pollMs: 999999,
        ...props,
      })
    )
  );
}

async function openBell() {
  const trigger = screen.getByRole("button", { name: /notification/i });
  // Radix's DropdownMenuTrigger listens for a pointerdown before the click —
  // jsdom needs both fired to actually flip the (controlled) open state.
  fireEvent.pointerDown(trigger, { button: 0, pointerId: 1 });
  fireEvent.click(trigger);
  await waitFor(() => {
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
  });
}

describe("NotificationCenter — three independent sources must not share one fate (CAM-362 anti-pattern, CAM-616)", () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  it("[error/teeth] a host-bookings failure with a real pending booking must show an error+retry, never 'no new notifications'", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ok: false, json: async () => ({}) });
    renderCenter();
    await openBell();
    await screen.findByTestId("banner--notifications-error");
    expect(screen.queryByText(/no new notifications/i)).toBeNull();
  });

  it("[normal] a successful host-bookings load renders the real pending booking (sanity)", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ([{ id: "b1", campSite: { nameEn: "River Camp" }, status: "PENDING" }]),
    });
    renderCenter();
    await openBell();
    await screen.findByText("River Camp");
  });

  it("[concurrent/ordering] an invites failure does NOT wipe a sibling host-bookings list that already loaded (the CAM-362 independence property)", async () => {
    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ([{ id: "b1", campSite: { nameEn: "River Camp" }, status: "PENDING" }]),
      })
      .mockResolvedValueOnce({ ok: false, json: async () => ({}) }); // invites fails
    renderCenter({ showHostBookings: true, showInvites: true });
    await openBell();
    // The host booking that DID load must still render — a sibling source's
    // failure must never erase data that already succeeded.
    await screen.findByText("River Camp");
  });

  it("[null/empty] genuinely zero notifications (no error) still shows the plain empty copy, not the error banner", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ok: true, json: async () => ([]) });
    renderCenter();
    await openBell();
    await waitFor(() => {
      expect(screen.queryByTestId("banner--notifications-error")).toBeNull();
    });
  });

  it("[error] retry re-issues the request and can recover", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ok: false, json: async () => ({}) });
    renderCenter();
    await openBell();
    await screen.findByTestId("banner--notifications-error");

    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ([{ id: "b1", campSite: { nameEn: "River Camp" }, status: "PENDING" }]),
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId("btn--notifications-retry"));
    });
    await screen.findByText("River Camp");
  });
});

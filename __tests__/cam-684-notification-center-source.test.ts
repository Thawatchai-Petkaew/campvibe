// @vitest-environment jsdom
/**
 * cam-684-notification-center-source.test.ts — CAM-684
 *
 * components/NotificationCenter.tsx no longer derives host booking items
 * from /api/operator/bookings?status=PENDING (the `showHostBookings` prop
 * is gone at both mount sites). Host booking items now come from the
 * caller's own persisted rows, GET /api/notifications (CAM-683). Invites
 * (interactive: accept/decline) stay a separate, untouched source per the
 * story's note — a Notification row is a passive record with a link, it
 * has no verb.
 *
 * Coverage matrix per .claude/rules/qa.md:
 *   normal (notifications source used; invites still work) ·
 *   unit (unread-only badge; opening an item decrements it, no full
 *     refetch) ·
 *   error/teeth — LOAD-BEARING (a /api/notifications failure alongside a
 *     healthy /api/team/invitations must show BOTH the loaded invite AND
 *     the error banner — collapsing the two sources into one try/catch
 *     reintroduces the exact bug CAM-616 fixed).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as React from "react";
import { render, screen, cleanup, fireEvent, waitFor, act, within } from "@testing-library/react";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { NotificationCenter } from "@/components/NotificationCenter";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function renderCenter(props: Partial<React.ComponentProps<typeof NotificationCenter>> = {}) {
  return render(
    React.createElement(
      LanguageProvider,
      null,
      React.createElement(NotificationCenter, {
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
  fireEvent.pointerDown(trigger, { button: 0, pointerId: 1 });
  fireEvent.click(trigger);
  await waitFor(() => {
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
  });
  return trigger;
}

describe("NotificationCenter — host booking items come from GET /api/notifications (CAM-684)", () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  it("[unit] fetches /api/notifications and never /api/operator/bookings?status=PENDING", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => [] });
    global.fetch = fetchMock;

    renderCenter();
    await openBell();

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/notifications", expect.anything());
    });
    const calledUrls = fetchMock.mock.calls.map((call) => String(call[0]));
    expect(calledUrls.some((u) => u.includes("/api/operator/bookings"))).toBe(false);
  });

  it("[normal] invites still render and Accept still PATCHes /api/team/invitations/[id] (interactive source untouched)", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => [] }) // GET /api/notifications
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [{ id: "inv1", campSite: { nameEn: "Pine Camp" }, role: "STAFF" }],
      }) // GET /api/team/invitations
      .mockResolvedValue({ ok: true, json: async () => ({}) }); // PATCH accept + the refetch it triggers
    global.fetch = fetchMock;

    renderCenter({ showInvites: true });
    await openBell();
    await screen.findByText("Pine Camp");

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /accept/i }));
    });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/team/invitations/inv1",
        expect.objectContaining({ method: "PATCH" })
      );
    });
  });

  it("[unit] the bell badge counts unread only; opening an unread item decrements it without a full refetch", async () => {
    const notificationsFixture = [
      { id: "n1", type: "BOOKING", title: "Unread One", body: null, link: null, isRead: false, createdAt: new Date().toISOString() },
      { id: "n2", type: "BOOKING", title: "Read Two", body: null, link: null, isRead: true, createdAt: new Date().toISOString() },
    ];
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => notificationsFixture }) // GET /api/notifications
      .mockResolvedValue({ ok: true, json: async () => ({}) }); // PATCH mark-one-read
    global.fetch = fetchMock;

    renderCenter();
    const trigger = await openBell();
    await screen.findByText("Unread One");

    // One unread row (n2 is already read) => badge shows "1".
    within(trigger).getByText("1");

    await act(async () => {
      fireEvent.click(screen.getByText("Unread One"));
    });

    // Optimistic local update: isRead flips immediately, no full refetch —
    // the badge count recomputes to 0 and the span itself stops rendering
    // (counts.total > 0 gate), all from ONE additional fetch call (the
    // PATCH), never a second GET /api/notifications.
    await waitFor(() => {
      expect(within(trigger).queryByText("1")).toBeNull();
    });
    const getCalls = fetchMock.mock.calls.filter((call) => String(call[0]) === "/api/notifications");
    expect(getCalls).toHaveLength(1);
  });

  it("[error/teeth, load-bearing] a /api/notifications failure alongside a healthy /api/team/invitations must show BOTH the loaded invite AND the error banner, never the empty state", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, json: async () => ({}) }) // GET /api/notifications fails
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [{ id: "inv1", campSite: { nameEn: "Pine Camp" }, role: "STAFF" }],
      }); // GET /api/team/invitations succeeds
    global.fetch = fetchMock;

    renderCenter({ showInvites: true });
    await openBell();

    // Both must be true at once — collapsing the two sources into one
    // try/catch would either hide the invite or hide the error.
    await screen.findByText("Pine Camp");
    await screen.findByTestId("banner--notifications-error");
    expect(screen.queryByText(/no new notifications/i)).toBeNull();
  });
});

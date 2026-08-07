// @vitest-environment jsdom
/**
 * cam-704-guest-gate-integration.test.ts — CAM-704 root-cause follow-up
 * (epic CAM-695, ADR-018 D2)
 *
 * The gap: CAM-703's own unit/source-inspection suite (cam-703-login-gate
 * test.ts) proved `AiChatBookingStep`'s LIVE label flip and `use-ai-chat.ts`'s
 * wiring in isolation, but nothing ever rendered the REAL `AiChatPanel` tree
 * end-to-end for a guest and asserted the confirm tap actually opens a real
 * `LoginModal` — the exact integration `e2e/regression/cam-704-chat-
 * booking-commit.spec.ts`'s guest-gate case exercises in a real browser.
 * This is that missing layer: a real React render (jsdom + RTL, no
 * source-inspection shortcuts) driving card -> detail -> start -> date ->
 * nights -> guests -> summary -> confirm tap, asserting a SECOND real
 * `role="dialog"` element opens with the exact loginPrompt subtitle.
 *
 * Root-cause note (2026-08-07): this test PASSES against the shipped
 * CAM-703 code — the guest-gate wiring (writeBookingResume -> onNeedsLogin
 * -> AiChatPanel state -> <LoginModal isOpen> -> a real Radix dialog with
 * the right text) is correct. The CI e2e failure this story chases is NOT
 * reproducible via this harness once given parity with what a real browser
 * already provides (an App Router context — `next/navigation`'s hooks throw
 * with no provider under plain jsdom, a harness gap, not an app bug; and
 * `lib/actions.ts`'s `'use server'` export, which Next's own bundler
 * replaces with a client RPC stub and Vitest does not). Kept as a permanent
 * regression guard for the boundary this story's unit suite did not cover;
 * the e2e's own diagnostic capture (pageerror/console, see that file) is
 * the mechanism to catch a genuinely environment-specific failure next time.
 */
import { describe, it, vi, beforeAll, afterEach, expect } from "vitest";
import * as React from "react";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { LanguageProvider } from "@/contexts/LanguageContext";

vi.mock("next-auth/react", () => ({
  useSession: () => ({ data: null, status: "unauthenticated" }),
  SessionProvider: ({ children }: { children: React.ReactNode }) => children,
  signIn: vi.fn(),
  signOut: vi.fn(),
}));

// LoginModal calls useRouter/usePathname/useSearchParams directly — these
// throw "invariant expected app router to be mounted" with no
// AppRouterContext.Provider ancestor (never present under plain jsdom). In
// the real app this context always exists (Next's root layout provides it),
// so mocking it here is harness parity, not a behavior change.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));

// lib/actions.ts is 'use server' — Next's own bundler replaces a client
// import of it with a thin RPC stub (never pulling prisma/bcrypt/next-auth
// server internals into the client bundle); plain Vitest has no such
// transform, so importing it for real here fails to resolve next-auth's own
// server-only internals. Mocked the same way the real bundler effectively
// does; googleSignIn itself is never exercised by this guest-tap path.
vi.mock("@/lib/actions", () => ({ googleSignIn: vi.fn() }));

const CAMP_ID = "cam-704-camp";
const CHECK_IN = "2026-09-05";

function detailBody() {
  return {
    ok: true,
    id: CAMP_ID,
    nameTh: "ลานทดสอบ",
    nameEn: "Test Camp",
    description: null,
    amenities: [],
    reviews: [],
    reviewSummary: { hasReviews: false, avgRating: null, count: 0 },
    price: { low: 200, high: 500, currency: "THB", extraFeeAmount: null, extraFeeLabel: null, feeInfo: null, isFree: false },
    capacity: { maxGuestsPerDay: 20, maxTentsPerDay: null },
    useSpotView: false,
    cancellationPolicy: null,
    isVerified: true,
    checkInTime: "14:00",
    checkOutTime: "10:00",
    minimumAge: 7,
    location: { province: "Loei", region: "Northeast" },
    directions: null,
    distanceFromBangkokKm: 330,
    availableWeekendDates: [CHECK_IN],
    weekendAvailability: [{ date: CHECK_IN, remaining: 6, blockedByHost: false }],
    facets: [],
  };
}

beforeAll(() => {
  if (!window.matchMedia) {
    window.matchMedia = ((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })) as unknown as typeof window.matchMedia;
  }
  // jsdom doesn't implement scrollTo — the panel's auto-scroll effect calls
  // it on every new entry; a no-op stub avoids an unrelated uncaught
  // exception that has nothing to do with this test's own assertions.
  Element.prototype.scrollTo = vi.fn();

  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const u = String(url);
      if (u.includes("/api/ai/chat")) {
        return {
          ok: true,
          status: 200,
          headers: { get: () => "application/json" },
          json: async () => ({
            answer: "พบผลลัพธ์ที่ตรงกัน",
            cards: [
              {
                id: CAMP_ID,
                nameTh: "ลานทดสอบ",
                nameEn: "Test Camp",
                nameThSlug: "test-camp",
                nameEnSlug: "test-camp",
                priceLow: 200,
                createdAt: new Date().toISOString(),
                avgRating: null,
                reviewCount: 0,
                location: { province: "เลย" },
                images: [{ url: "/placeholder-camp.svg" }],
              },
            ],
          }),
        };
      }
      if (u.includes(`/api/ai/camp-detail/${CAMP_ID}`)) {
        return { ok: true, status: 200, json: async () => detailBody() };
      }
      if (u.includes(`/api/campsites/${CAMP_ID}/remaining-capacity`)) {
        return { ok: true, status: 200, json: async () => ({ remaining: 6, blockedByHost: false }) };
      }
      throw new Error(`unmocked fetch in cam-704-guest-gate-integration.test.ts: ${u}`);
    })
  );
});

afterEach(() => cleanup());

describe("CAM-704 guest gate — a real AiChatPanel render, not source-inspection", () => {
  it("[normal] drives card -> detail -> start -> date -> nights -> guests -> summary, then the confirm tap opens a real second dialog with the loginPrompt subtitle, verbatim", async () => {
    const { AiChatPanel } = await import("@/components/ai-chat/AiChatPanel");
    render(
      // initialLanguage="th" — the real e2e guest sets campvibe_lang=th (the
      // language trap, e2e/regression/README.md); LanguageProvider defaults
      // to "en" otherwise, and this test asserts the Thai copy verbatim.
      // Cast narrows `children` to optional on the element type only (never
      // `any`) so `React.createElement`'s props-object + children-arg
      // overload resolves — `LanguageProviderProps` declares `children`
      // required, which TS's overload matching rejects when a 3rd argument
      // is also passed.
      React.createElement(
        LanguageProvider as React.ComponentType<{ initialLanguage?: "th" | "en"; children?: React.ReactNode }>,
        { initialLanguage: "th" },
        React.createElement(AiChatPanel, { open: true, onOpenChange: () => {} })
      )
    );

    await screen.findByTestId("dialog--ai-chat-panel");

    const composer = await screen.findByTestId("input--ai-chat-composer");
    fireEvent.change(composer, { target: { value: "มีแคมป์ไหม" } });
    fireEvent.click(screen.getByTestId("btn--ai-chat-send"));

    const cardButton = await screen.findByTestId("btn--ai-chat-card-select", {}, { timeout: 5000 });
    fireEvent.click(cardButton);

    await waitFor(() => {
      expect((screen.getByTestId("btn--ai-chat-booking-start") as HTMLButtonElement).disabled).toBe(false);
    }, { timeout: 8000 });
    fireEvent.click(screen.getByTestId("btn--ai-chat-booking-start"));

    const dateChip = await screen.findByTestId("btn--ai-chat-booking-chip", {}, { timeout: 5000 });
    expect(dateChip.getAttribute("data-step")).toBe("date");
    fireEvent.click(dateChip);

    // Superseded chip rows stay in the DOM (design brief §5) — scope every
    // click by data-step, never a bare index, or a later click can land on
    // a stale earlier-step chip.
    await waitFor(() => {
      expect(document.querySelector('[data-testid="btn--ai-chat-booking-chip"][data-step="nights"]')).toBeTruthy();
    }, { timeout: 5000 });
    fireEvent.click(document.querySelector('[data-testid="btn--ai-chat-booking-chip"][data-step="nights"]')!);

    await waitFor(() => {
      expect(document.querySelector('[data-testid="btn--ai-chat-booking-chip"][data-step="guests"]')).toBeTruthy();
    }, { timeout: 5000 });
    fireEvent.click(document.querySelector('[data-testid="btn--ai-chat-booking-chip"][data-step="guests"]')!);

    const confirmButton = await screen.findByTestId("btn--ai-chat-booking-confirm", {}, { timeout: 8000 });
    expect(confirmButton.getAttribute("data-auth")).toBe("guest");

    // Act — the guest tap.
    fireEvent.click(confirmButton);

    // System result — the flow serialized (never a network write for a
    // guest, CAM-703 AC-2).
    await waitFor(() => {
      expect(window.sessionStorage.getItem("ai-chat-booking-resume")).toBeTruthy();
    }, { timeout: 3000 });

    // Visible result — a REAL second dialog (the chat panel's own Content
    // also carries role="dialog", CAM-540/dialog.tsx — filtered out by text)
    // with the loginPrompt subtitle, verbatim, and a real Google button from
    // LoginModal itself (unambiguous — no other dialog in this tree carries
    // this copy or this control).
    await waitFor(() => {
      const dialogs = screen.getAllByRole("dialog");
      const loginDialog = dialogs.find((d) => d.textContent?.includes("เข้าสู่ระบบก่อน จะได้จองให้เสร็จในแชทนี้เลย"));
      expect(loginDialog, `expected a second dialog with the loginPrompt subtitle; found ${dialogs.length} dialog(s)`).toBeTruthy();
    }, { timeout: 5000 });

    const dialogs = screen.getAllByRole("dialog");
    const loginDialog = dialogs.find((d) => d.textContent?.includes("เข้าสู่ระบบก่อน จะได้จองให้เสร็จในแชทนี้เลย"))!;
    expect(loginDialog.querySelector('[data-testid="btn--login-google"]')).toBeTruthy();
  }, 20000);
});

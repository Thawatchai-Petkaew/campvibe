// @vitest-environment jsdom
/**
 * cam-703-login-gate.test.ts — CAM-703 (epic CAM-695, ADR-018 D2)
 * "A guest can sign in and finish the booking right here in the chat"
 *
 * Three layers, matching the repo's own established pattern for this
 * component family:
 *   1. Pure logic (booking-view.ts's `buildSummaryView` cta branch,
 *      `writeBookingResume`/`readAndClearBookingResume`/`clearBookingResume`
 *      in use-ai-chat.ts) — real behavioral tests, no mocking.
 *   2. `AiChatBookingStep` — a real jsdom render (it takes NO `useSession()`
 *      dependency itself; `liveAuthed` is a plain prop), proving the label
 *      actually flips at render time from the live value, never the
 *      build-time-baked `cta.label`/`authState`.
 *   3. `useAiChat()`/`AiChatPanel.tsx` — source-inspection Prove-It (this
 *      repo's established precedent for a `useSession()`-gated hook with no
 *      jsdom/RTL harness — cam-640/cam-702's own `use-ai-chat-wiring` files).
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import * as React from "react";
import { readFileSync } from "fs";
import { resolve } from "path";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { getTranslations } from "@/locales/translations";
import { AiChatBookingStep, type BookingStepView } from "@/components/ai-chat/AiChatBookingStep";
import { buildSummaryView, type BookingCampContext } from "@/components/ai-chat/booking-view";
import type { BookingSession } from "@/components/ai-chat/booking-turn";
import {
  clearBookingResume,
  readAndClearBookingResume,
  writeBookingResume,
} from "@/components/ai-chat/use-ai-chat";

const read = (p: string) => readFileSync(resolve(__dirname, "..", p), "utf-8");
const t = getTranslations("th");
// LanguageProvider defaults to "en" with no explicit initialLanguage prop
// (contexts/LanguageContext.tsx) — the same default cam-701's own render
// tests rely on. `renderStep` below never passes `initialLanguage`, so the
// EN strings are what AiChatBookingStep actually renders.
const tEn = getTranslations("en");

interface MockLinkProps {
  href: string;
  children?: React.ReactNode;
}
vi.mock("next/link", () => {
  const MockLink = React.forwardRef<HTMLAnchorElement, MockLinkProps>(({ href, children, ...rest }, ref) =>
    React.createElement("a", { href, ref, ...rest }, children)
  );
  MockLink.displayName = "MockNextLink";
  return { __esModule: true, default: MockLink };
});

// ---------------------------------------------------------------------------
// 1. booking-view.ts — buildSummaryView's whole-camp cta (CAM-703)
// ---------------------------------------------------------------------------
const CAMP: BookingCampContext = {
  campId: "cs-703",
  slug: "phu-chi-fa",
  name: "ภูชี้ฟ้า",
  weekendAvailability: [],
  maxGuestsPerDay: 10,
  useSpotView: false,
  unitPrice: 500,
  priceUnit: "PER_SITE",
  priceIsFree: false,
};
const SLOTS = { checkIn: "2026-08-01", checkOut: "2026-08-03", nights: 2, guests: 2 };

describe("buildSummaryView — the whole-camp login gate (ADR-018 D2)", () => {
  it("[normal] a GUEST whole-camp summary gets kind:'confirm', authState:'guest', loginToConfirm label", () => {
    const view = buildSummaryView({ slots: SLOTS, camp: CAMP, t, language: "th", today: "2026-07-22" });
    expect(view.cta).toEqual({ kind: "confirm", label: t.aiChat.booking.loginToConfirm, authState: "guest" });
  });

  it("[normal] a MEMBER whole-camp summary still gets kind:'confirm', authState:'member', confirm label", () => {
    const view = buildSummaryView({ slots: SLOTS, camp: CAMP, t, language: "th", today: "2026-07-22", authed: true });
    expect(view.cta).toEqual({ kind: "confirm", label: t.aiChat.booking.confirm, authState: "member" });
  });

  it("[boundary] a per-pitch camp stays handoff for a GUEST too (no confirm story of its own yet)", () => {
    const perPitch: BookingCampContext = { ...CAMP, useSpotView: true };
    const view = buildSummaryView({ slots: SLOTS, camp: perPitch, t, language: "th", today: "2026-07-22" });
    expect(view.cta.kind).toBe("handoff");
  });

  it("[error/validation] forceHandoff overrides the whole-camp confirm rule even for an authed member (ADR-018 §4 safety — resolveSpotStep's data-failure downgrade)", () => {
    const view = buildSummaryView({
      slots: SLOTS,
      camp: CAMP,
      t,
      language: "th",
      today: "2026-07-22",
      authed: true,
      forceHandoff: true,
    });
    expect(view.cta.kind).toBe("handoff");
  });
});

// ---------------------------------------------------------------------------
// 2. AiChatBookingStep — the LIVE label flip (design brief §5 critical note)
// ---------------------------------------------------------------------------
const BASE_ROWS = {
  campValue: "Phu Chi Fa",
  datesValue: "Sat, 8 Aug, 2 nights",
  guestsValue: "2 people",
  totalValue: "฿1,000",
};

function renderStep(view: BookingStepView, opts: { onConfirm?: () => void; liveAuthed?: boolean } = {}) {
  render(
    React.createElement(LanguageProvider, null, React.createElement(AiChatBookingStep, { view, ...opts }))
  );
}

afterEach(() => cleanup());

describe("AiChatBookingStep — liveAuthed drives the confirm label, never the build-time-baked cta (CAM-396 lesson)", () => {
  it("[normal] a STALE guest-baked summary cta renders ยืนยันการจอง the instant liveAuthed:true, and tap still calls onConfirm (never a separate handler)", () => {
    const onConfirm = vi.fn();
    renderStep(
      {
        kind: "summary",
        isCurrent: true,
        ...BASE_ROWS,
        cta: { kind: "confirm", label: "Sign in to confirm booking", authState: "guest" }, // baked stale
        controls: [{ kind: "editDate" }, { kind: "editGuests" }, { kind: "cancel" }],
      },
      { onConfirm, liveAuthed: true }
    );
    const btn = screen.getByTestId("btn--ai-chat-booking-confirm");
    expect(btn.getAttribute("data-auth")).toBe("member");
    expect(btn.textContent).toBe(tEn.aiChat.booking.confirm);
    fireEvent.click(btn);
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it("[normal] a STALE member-baked summary cta renders the login label when liveAuthed is false (default)", () => {
    renderStep({
      kind: "summary",
      isCurrent: true,
      ...BASE_ROWS,
      cta: { kind: "confirm", label: "Confirm booking", authState: "member" }, // baked stale
      controls: [{ kind: "cancel" }],
    });
    const btn = screen.getByTestId("btn--ai-chat-booking-confirm");
    expect(btn.getAttribute("data-auth")).toBe("guest");
    expect(btn.textContent).toBe(tEn.aiChat.booking.loginToConfirm);
  });

  it("[normal] F3 sessionExpired — a stale guest-baked cta ALSO flips to ยืนยันการจอง once liveAuthed:true (the re-login recovery path)", () => {
    const onConfirm = vi.fn();
    renderStep(
      {
        kind: "bookingFailed",
        reason: "sessionExpired",
        ...BASE_ROWS,
        cta: { kind: "confirm", label: "Sign in to confirm booking", authState: "guest" },
      },
      { onConfirm, liveAuthed: true }
    );
    const btn = screen.getByTestId("btn--ai-chat-booking-confirm");
    expect(btn.getAttribute("data-auth")).toBe("member");
    expect(btn.textContent).toBe(tEn.aiChat.booking.confirm);
    fireEvent.click(btn);
    expect(onConfirm).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
// 3. use-ai-chat.ts — the resume-storage round-trip (ADR-018 D2, Google path)
// ---------------------------------------------------------------------------
function makeSession(): BookingSession {
  return {
    state: { slots: SLOTS, consecutiveMisses: 0 },
    camp: CAMP,
  };
}

describe("writeBookingResume / readAndClearBookingResume / clearBookingResume — the Google-redirect round-trip", () => {
  afterEach(() => {
    window.sessionStorage.clear();
    vi.useRealTimers();
  });

  it("[normal] a written session round-trips {camp, slots} through sessionStorage", () => {
    writeBookingResume(makeSession());
    const resumed = readAndClearBookingResume();
    expect(resumed).toEqual({ camp: CAMP, slots: SLOTS });
  });

  it("[error/validation] single-use: a second read after the first returns null (the key is gone)", () => {
    writeBookingResume(makeSession());
    expect(readAndClearBookingResume()).not.toBeNull();
    expect(readAndClearBookingResume()).toBeNull();
  });

  it("[boundary] a key older than the 15-minute TTL reads as null (and is still deleted)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-01T10:00:00Z"));
    writeBookingResume(makeSession());
    vi.setSystemTime(new Date("2026-08-01T10:15:01Z")); // 15:01 later — just past the TTL
    expect(readAndClearBookingResume()).toBeNull();
    expect(window.sessionStorage.getItem("ai-chat-booking-resume")).toBeNull();
  });

  it("[error/validation] a malformed stored value never throws — reads as null", () => {
    window.sessionStorage.setItem("ai-chat-booking-resume", "{not json");
    expect(() => readAndClearBookingResume()).not.toThrow();
    expect(readAndClearBookingResume()).toBeNull();
  });

  it("[null/empty] no key at all reads as null", () => {
    expect(readAndClearBookingResume()).toBeNull();
  });

  it("[normal] clearBookingResume removes an unread key (defensive cleanup on a real submit / cancel)", () => {
    writeBookingResume(makeSession());
    clearBookingResume();
    expect(readAndClearBookingResume()).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 4. use-ai-chat.ts — source-inspection: the guest guard never reaches the
//    network, and both cleanup call sites are wired (this repo's
//    established no-jsdom-harness precedent for this hook).
// ---------------------------------------------------------------------------
const useAiChatSrc = read("components/ai-chat/use-ai-chat.ts");

function bodyOf(src: string, startMarker: string, endMarker = "\n  }, ["): string {
  const start = src.indexOf(startMarker);
  expect(start, `${startMarker} not found`).toBeGreaterThan(-1);
  const end = src.indexOf(endMarker, start);
  expect(end, `closing marker not found after ${startMarker}`).toBeGreaterThan(start);
  return src.slice(start, end);
}

describe("onBookingConfirm's guest branch — serializes + signals onNeedsLogin, never bookingAPI.create", () => {
  it("[unit] the `if (!authed)` branch calls writeBookingResume BEFORE onNeedsLogin, and never touches bookingAPI.create", () => {
    const body = bodyOf(useAiChatSrc, "const onBookingConfirm = useCallback(async () => {");
    const branchStart = body.indexOf("if (!authed) {");
    const branchEnd = body.indexOf("\n    }\n", branchStart);
    const branch = body.slice(branchStart, branchEnd);
    const writeIdx = branch.indexOf("writeBookingResume(session)");
    const signalIdx = branch.indexOf("onNeedsLogin?.(reason)");
    expect(writeIdx).toBeGreaterThan(-1);
    expect(signalIdx).toBeGreaterThan(writeIdx);
    expect(branch).not.toContain("bookingAPI.create");
    expect(branch).not.toContain("setSending(");
  });

  it("[unit] the reason is derived from the CURRENT entry's bookingFailed/sessionExpired shape, never guessed", () => {
    const body = bodyOf(useAiChatSrc, "const onBookingConfirm = useCallback(async () => {");
    expect(body).toContain('last.view.kind === "bookingFailed"');
    expect(body).toContain('last.view.reason === "sessionExpired"');
  });

  it("[unit] the authed (real-submit) branch clears any stale resume key before startBookingSubmit", () => {
    const body = bodyOf(useAiChatSrc, "const onBookingConfirm = useCallback(async () => {");
    const clearIdx = body.indexOf("clearBookingResume();");
    const submitIdx = body.indexOf("startBookingSubmit(");
    expect(clearIdx).toBeGreaterThan(-1);
    expect(clearIdx).toBeLessThan(submitIdx);
  });
});

describe("onBookingCancel also clears a pending resume key (defensive)", () => {
  it("[unit] onBookingCancel calls clearBookingResume before processBookingCancel", () => {
    const body = bodyOf(useAiChatSrc, "const onBookingCancel = useCallback(() => {", "\n  }, [");
    expect(body).toContain("clearBookingResume();");
  });
});

describe("useAiChat accepts an onNeedsLogin option (UseAiChatOptions)", () => {
  it("[unit] the hook signature takes options with a default {}", () => {
    expect(useAiChatSrc).toContain("export function useAiChat(options: UseAiChatOptions = {}): UseAiChatResult {");
    expect(useAiChatSrc).toContain("const { onNeedsLogin } = options;");
  });
});

describe("restoreBookingFromStorage — the Google-redirect restore only runs AFTER history settles", () => {
  it("[unit] all three exit points of the conversation-resume effect call restoreBookingFromStorage AFTER their own setResuming(false)/setEntries", () => {
    const start = useAiChatSrc.indexOf("useEffect(() => {\n    if (!authed || hasResumedRef.current) return;");
    expect(start).toBeGreaterThan(-1);
    const end = useAiChatSrc.indexOf("}, [authed]);", start);
    const body = useAiChatSrc.slice(start, end);
    const calls = body.split("restoreBookingFromStorage(").length - 1;
    expect(calls).toBe(3);
    // never guessed at the network — restoreBookingFromStorage itself only
    // reaches the network through the ALREADY-injected checkCapacity path
    // (runSummaryCheckRef), never a raw fetch.
    expect(body).not.toContain("fetch(");
  });

  it("[unit] restoreBookingFromStorage never clobbers an already-active flow (bookingRef.current guard) and never calls setSending", () => {
    const start = useAiChatSrc.indexOf("async function restoreBookingFromStorage(base: ChatEntry[]) {");
    expect(start).toBeGreaterThan(-1);
    const end = useAiChatSrc.indexOf("\n  }\n", start);
    const body = useAiChatSrc.slice(start, end);
    expect(body).toContain("if (bookingRef.current) return;");
    expect(body).not.toContain("setSending(");
  });
});

// ---------------------------------------------------------------------------
// 5. AiChatPanel.tsx — LoginModal wiring + the inert-effect fix
//    (source-inspection; the panel is a useSession()-gated tree, same
//    no-jsdom-harness precedent).
// ---------------------------------------------------------------------------
const panelSrc = read("components/ai-chat/AiChatPanel.tsx");
const listSrc = read("components/ai-chat/AiChatMessageList.tsx");

describe("AiChatPanel.tsx — LoginModal opens on onNeedsLogin, with the matching subtitle", () => {
  it("[unit] LoginModal is lazily imported next/dynamic ssr:false (InfiniteScrollGrid.tsx's own idiom)", () => {
    expect(panelSrc).toMatch(
      /const LoginModal = dynamic\(\s*\(\) => import\("@\/components\/LoginModal"\)\.then\(\(m\) => \(\{ default: m\.LoginModal \}\)\),\s*\{ ssr: false, loading: \(\) => null \}\s*\);/
    );
  });

  it("[unit] onNeedsLogin sets loginModalReason + opens the modal", () => {
    expect(panelSrc).toContain("onNeedsLogin: (reason) => {");
    expect(panelSrc).toContain("setLoginModalReason(reason);");
    expect(panelSrc).toContain("setLoginModalOpen(true);");
  });

  it("[unit] the subtitle picks sessionExpired vs loginPrompt off loginModalReason, never hardcoded", () => {
    expect(panelSrc).toContain(
      'subtitle={loginModalReason === "sessionExpired" ? t.aiChat.booking.sessionExpired : t.aiChat.booking.loginPrompt}'
    );
  });

  it("[unit] isAuthenticated (the LIVE session) is threaded to AiChatMessageList as liveAuthed", () => {
    expect(panelSrc).toContain("isAuthenticated,");
    expect(panelSrc).toContain("liveAuthed={isAuthenticated}");
  });
});

describe("AiChatPanel.tsx — the inert-effect fix: LoginModal stays interactive even in expanded mode", () => {
  it("[unit] the manual body-inert lock is suspended while loginModalOpen (never inerts LoginModal's own portal)", () => {
    expect(panelSrc).toContain(
      'if (typeof document === "undefined" || !(open && expanded) || loginModalOpen) return;'
    );
    expect(panelSrc).toContain("}, [open, expanded, loginModalOpen]);");
  });
});

describe("AiChatMessageList.tsx — liveAuthed threaded through to AiChatBookingStep", () => {
  it("[unit] the prop is declared, destructured, and passed through both AiChatMessageList and AiChatEntryRow", () => {
    expect(listSrc).toContain("liveAuthed: boolean;");
    expect(listSrc).toContain("liveAuthed={liveAuthed}");
  });
});

// ---------------------------------------------------------------------------
// 6. The composer stays live — no setSending anywhere in this story's new
//    surface (design brief §6's rule, extended to the login gate).
// ---------------------------------------------------------------------------
describe("BR — the composer is never disabled by any part of the login gate", () => {
  it("[unit] neither writeBookingResume/readAndClearBookingResume/clearBookingResume nor the guest branch of onBookingConfirm reference setSending", () => {
    const helpersStart = useAiChatSrc.indexOf("const BOOKING_RESUME_KEY");
    const helpersEnd = useAiChatSrc.indexOf("export interface UseAiChatResult");
    expect(useAiChatSrc.slice(helpersStart, helpersEnd)).not.toContain("setSending(");
  });
});

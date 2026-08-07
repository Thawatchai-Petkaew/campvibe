/**
 * cam-702-use-ai-chat-confirm.test.ts — CAM-702 (epic CAM-695, ADR-018)
 * "The chat actually books"
 *
 * Source-inspection Prove-It coverage for the confirm-tap wiring inside
 * `use-ai-chat.ts` — this repo's established precedent for a
 * `useSession()`-gated hook with no jsdom/RTL harness (cam-640/cam-700's own
 * `use-ai-chat-wiring` test files; the real write-orchestration logic
 * already has full DI-fake coverage with no React at all in
 * `cam-702-booking-turn-submit.test.ts`).
 *
 * Four structural guarantees proved here:
 *   1. `onBookingConfirm`/`onBookingCheckAndRetry` never call `setSending`
 *      (BR-2/design brief §6 — the composer is never disabled during submit)
 *   2. guard 1 (the synchronous `bookingSubmitInFlightRef` check) sits
 *      BEFORE the first `await` in each handler — the double-tap guard
 *   3. the write orchestration is imported from the pure/DI `booking-turn.ts`
 *      module (no inline re-implementation of the POST/reconcile logic)
 *   4. `AiChatMessageList`/`AiChatPanel` actually wire the two new handlers
 *      through to the rendered button, gated on `isCurrent` like every
 *      other booking handler
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const read = (p: string) => readFileSync(resolve(__dirname, "..", p), "utf-8");

const useAiChatSrc = read("components/ai-chat/use-ai-chat.ts");
const listSrc = read("components/ai-chat/AiChatMessageList.tsx");
const panelSrc = read("components/ai-chat/AiChatPanel.tsx");

function bodyOf(src: string, startMarker: string, endMarker = "\n  }, ["): string {
  const start = src.indexOf(startMarker);
  expect(start, `${startMarker} not found`).toBeGreaterThan(-1);
  const end = src.indexOf(endMarker, start);
  expect(end, `closing marker not found after ${startMarker}`).toBeGreaterThan(start);
  return src.slice(start, end);
}

describe("BR-2 — onBookingConfirm/onBookingCheckAndRetry never touch `sending`", () => {
  it("[unit] onBookingConfirm's body never calls setSending", () => {
    expect(bodyOf(useAiChatSrc, "const onBookingConfirm = useCallback(async () => {")).not.toContain("setSending(");
  });

  it("[unit] onBookingCheckAndRetry's body never calls setSending", () => {
    expect(bodyOf(useAiChatSrc, "const onBookingCheckAndRetry = useCallback(async () => {")).not.toContain("setSending(");
  });
});

describe("guard 1 — the synchronous in-flight ref check sits BEFORE the first `await`", () => {
  it("[unit] onBookingConfirm checks bookingSubmitInFlightRef.current before any await", () => {
    const body = bodyOf(useAiChatSrc, "const onBookingConfirm = useCallback(async () => {");
    const guardIdx = body.indexOf("if (bookingSubmitInFlightRef.current) return;");
    const firstAwaitIdx = body.indexOf("await ");
    expect(guardIdx).toBeGreaterThan(-1);
    expect(firstAwaitIdx).toBeGreaterThan(-1);
    expect(guardIdx).toBeLessThan(firstAwaitIdx);
  });

  it("[unit] onBookingCheckAndRetry checks bookingSubmitInFlightRef.current before any await", () => {
    const body = bodyOf(useAiChatSrc, "const onBookingCheckAndRetry = useCallback(async () => {");
    const guardIdx = body.indexOf("if (bookingSubmitInFlightRef.current) return;");
    const firstAwaitIdx = body.indexOf("await ");
    expect(guardIdx).toBeGreaterThan(-1);
    expect(firstAwaitIdx).toBeGreaterThan(-1);
    expect(guardIdx).toBeLessThan(firstAwaitIdx);
  });

  it("[unit] the ref is set true immediately after the guard, before startBookingSubmit is called", () => {
    const body = bodyOf(useAiChatSrc, "const onBookingConfirm = useCallback(async () => {");
    const setTrueIdx = body.indexOf("bookingSubmitInFlightRef.current = true;");
    const submitIdx = body.indexOf("startBookingSubmit(");
    expect(setTrueIdx).toBeGreaterThan(-1);
    expect(submitIdx).toBeGreaterThan(setTrueIdx);
  });
});

describe("the write orchestration is imported from booking-turn.ts (no inline re-implementation)", () => {
  it("[unit] use-ai-chat.ts imports startBookingSubmit/submitBookingWrite/findJustCreatedBooking/resolveBookingSubmitSuccess", () => {
    expect(useAiChatSrc).toMatch(/from "@\/components\/ai-chat\/booking-turn"/);
    expect(useAiChatSrc).toContain("startBookingSubmit(");
    expect(useAiChatSrc).toContain("submitBookingWrite(");
    expect(useAiChatSrc).toContain("findJustCreatedBooking(");
    expect(useAiChatSrc).toContain("resolveBookingSubmitSuccess(");
  });

  it("[unit] onBookingConfirm calls bookingAPI.create/bookingAPI.list via submitBookingWrite's injected params, never a raw fetch", () => {
    const body = bodyOf(useAiChatSrc, "const onBookingConfirm = useCallback(async () => {");
    expect(body).toContain("submitBookingWrite(started.entries, session, bookingAPI.create, bookingAPI.list");
    expect(body).not.toContain("fetch(");
  });
});

// CAM-703 (2026-08-06 dated supersede) — the guard used to be a bare
// `if (!authed) return;` no-op; it now serializes the flow + fires
// `onNeedsLogin` (the login gate) before returning. Still sits before the
// first `await` — that guarantee is re-asserted against the new shape.
describe("!authed guards onBookingConfirm before it ever reaches the network", () => {
  it("[unit] the `if (!authed) {` guard sits before the first await and never calls bookingAPI.create", () => {
    const body = bodyOf(useAiChatSrc, "const onBookingConfirm = useCallback(async () => {");
    const authGuardIdx = body.indexOf("if (!authed) {");
    const firstAwaitIdx = body.indexOf("await ");
    expect(authGuardIdx).toBeGreaterThan(-1);
    expect(authGuardIdx).toBeLessThan(firstAwaitIdx);
    const guardBlockEnd = body.indexOf("\n    }\n", authGuardIdx);
    const guardBlock = body.slice(authGuardIdx, guardBlockEnd);
    expect(guardBlock).not.toContain("bookingAPI.create");
    expect(guardBlock).toContain("onNeedsLogin?.(reason)");
  });
});

describe("authed is threaded into processBookingTurn so a whole-camp summary can offer the real confirm", () => {
  // CAM-647 SUPERSEDES (2026-08-06) — the original assertion counted ANY
  // `new Date(), authed)` shape file-wide, which coincidentally also matched
  // the new `resolveSummaryCheck(...)` call this story adds (a genuinely
  // separate authed-gated call, unrelated to this invariant). Scoped here to
  // each `processBookingTurn(` call's OWN argument list instead, so the
  // guarantee this test protects — every processBookingTurn call site passes
  // authed — stays precise regardless of what else the file calls.
  it("[unit] every processBookingTurn( call site inside use-ai-chat.ts passes authed as the trailing arg", () => {
    const calls = useAiChatSrc.split("processBookingTurn(").length - 1;
    // sendMessage's single-line call + onBookingChipSelect's 3 multi-line calls = 4 total.
    expect(calls).toBe(4);

    let searchFrom = 0;
    let scopedAuthedCalls = 0;
    for (let i = 0; i < calls; i++) {
      const start = useAiChatSrc.indexOf("processBookingTurn(", searchFrom);
      expect(start).toBeGreaterThan(-1);
      const end = useAiChatSrc.indexOf(");", start);
      expect(end).toBeGreaterThan(start);
      const callArgs = useAiChatSrc.slice(start, end);
      if (/new Date\(\),\s*\n?\s*authed\s*$/.test(callArgs)) scopedAuthedCalls++;
      searchFrom = end;
    }
    expect(scopedAuthedCalls).toBe(4);
  });
});

describe("AiChatMessageList wires onConfirm/onCheckAndRetry, gated on isCurrent like every other booking handler", () => {
  it("[unit] the props are threaded through AiChatMessageListProps and AiChatEntryRowProps", () => {
    expect(listSrc).toContain("onBookingConfirm: () => Promise<void>;");
    expect(listSrc).toContain("onBookingCheckAndRetry: () => Promise<void>;");
  });

  it("[unit] AiChatBookingStep receives onConfirm/onCheckAndRetry gated on the SAME isCurrent check as every other handler", () => {
    expect(listSrc).toContain('const isCurrent = entry.view.kind !== "checkFailed" && entry.view.isCurrent;');
    expect(listSrc).toContain("onConfirm={isCurrent ? onBookingConfirm : undefined}");
    expect(listSrc).toContain("onCheckAndRetry={isCurrent ? onBookingCheckAndRetry : undefined}");
  });
});

describe("AiChatPanel threads onBookingConfirm/onBookingCheckAndRetry from useAiChat() to AiChatMessageList", () => {
  it("[unit] both are destructured from useAiChat() and passed straight through unchanged — the login gate lives in onNeedsLogin, not a wrapper here", () => {
    expect(panelSrc).toContain("onBookingConfirm,");
    expect(panelSrc).toContain("onBookingCheckAndRetry,");
    expect(panelSrc).toContain("onBookingConfirm={onBookingConfirm}");
    expect(panelSrc).toContain("onBookingCheckAndRetry={onBookingCheckAndRetry}");
    // CAM-703 (2026-08-06 dated supersede) — LoginModal now lives here, per
    // this story's own file surface (see cam-703-login-gate.test.ts for the
    // full wiring proof). The invariant this test still protects — neither
    // handler is wrapped/reimplemented at the call site — holds unchanged.
    expect(panelSrc).toContain("LoginModal");
  });
});

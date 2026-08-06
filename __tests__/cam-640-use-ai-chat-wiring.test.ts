/**
 * cam-640-use-ai-chat-wiring.test.ts — CAM-640 (epic CAM-630, in-chat
 * guided booking) "Starting a booking from the chat runs the whole flow"
 *
 * Source-inspection Prove-It coverage for the `use-ai-chat.ts` wiring — this
 * repo's established precedent for a `useSession()`-gated hook with no
 * jsdom/RTL harness (cam-423-ui-resume.test.ts's own header comment; the
 * actual STATE-TRANSITION logic already has real unit coverage in
 * cam-640-booking-turn.test.ts, which needs no React at all).
 *
 * Two structural guarantees proved here:
 *   1. the booking intercept sits AFTER the existing sending guard in
 *      `sendMessage` (never before it)
 *   2. the booking-handling branch never calls `setSending` — the composer
 *      is never disabled mid-flow (BR-2)
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const read = (p: string) => readFileSync(resolve(__dirname, "..", p), "utf-8");

const useAiChatSrc = read("components/ai-chat/use-ai-chat.ts");
const panelSrc = read("components/ai-chat/AiChatPanel.tsx");
const detailSrc = read("components/ai-chat/AiChatDetailCard.tsx");
const listSrc = read("components/ai-chat/AiChatMessageList.tsx");

describe("sendMessage — the booking intercept sits AFTER the sending guard, never before it", () => {
  // CAM-700 SUPERSEDES the bare whole-file `indexOf("bookingRef.current")`
  // used here through CAM-640: `settleBookingTurn`/`handleSpotSelection`
  // (new helpers `sendMessage` itself depends on — declared ABOVE it so their
  // identifiers are defined before `sendMessage`'s own `useCallback` DEPS
  // ARRAY evaluates, avoiding a TDZ ReferenceError) legitimately reference
  // `bookingRef.current` earlier in the file now. Both assertions below are
  // rescoped to `sendMessage`'s OWN body (from its `const sendMessage =`
  // line onward) — the guarantee they prove is unchanged, only the search
  // window is now precise instead of accidentally whole-file.
  const sendMessageStart = useAiChatSrc.indexOf("const sendMessage = useCallback(");

  it("[unit] the sending/isSendableQuestion guard line appears before the bookingRef intercept line", () => {
    expect(sendMessageStart).toBeGreaterThan(-1);
    const guardIdx = useAiChatSrc.indexOf("if (sending || !isSendableQuestion(text)) return;", sendMessageStart);
    const interceptIdx = useAiChatSrc.indexOf("if (bookingRef.current) {", sendMessageStart);
    expect(guardIdx).toBeGreaterThan(-1);
    expect(interceptIdx).toBeGreaterThan(guardIdx);
  });

  it("[unit] a send while `sending` is true returns before ever reaching the booking branch (same guard, unchanged)", () => {
    // The guard is a single early-return covering BOTH conditions — proven
    // structurally: the booking branch is physically unreachable code before
    // that return statement executes for a truthy `sending`.
    const guardLine = "if (sending || !isSendableQuestion(text)) return;";
    const start = useAiChatSrc.indexOf(guardLine, sendMessageStart);
    expect(start).toBeGreaterThan(-1);
    expect(useAiChatSrc.indexOf("bookingRef.current", start)).toBeGreaterThan(start);
  });
});

describe("BR-2 — the composer is never disabled during a booking turn (`sending` never toggled by booking code)", () => {
  it("[unit] the booking-turn branch inside sendMessage never calls setSending", () => {
    const start = useAiChatSrc.indexOf("if (bookingRef.current) {");
    const end = useAiChatSrc.indexOf("const withUser = appendUserQuestion(entries, text);", start);
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    const branch = useAiChatSrc.slice(start, end);
    expect(branch).not.toContain("setSending(");
  });

  it("[unit] none of the booking handlers (chip/back/edit/cancel/start) ever call setSending", () => {
    for (const fn of [
      "const startBookingFlow = useCallback(",
      "const onBookingChipSelect = useCallback(",
      "const onBookingBack = useCallback(",
      "const onBookingCancel = useCallback(",
      // CAM-700 — the spot step's new async helpers.
      "const settleBookingTurn = useCallback(",
      "const handleSpotSelection = useCallback(",
    ]) {
      const start = useAiChatSrc.indexOf(fn);
      expect(start, `${fn} not found`).toBeGreaterThan(-1);
      const end = useAiChatSrc.indexOf("\n  );", start);
      expect(useAiChatSrc.slice(start, end)).not.toContain("setSending(");
    }
  });
});

describe("the flow's own reducer functions are imported from the pure booking-turn.ts module (no inline re-implementation)", () => {
  it("[unit] use-ai-chat.ts imports startBookingTurn/processBookingTurn/processBookingControl/processBookingCancel from booking-turn.ts", () => {
    expect(useAiChatSrc).toMatch(/from "@\/components\/ai-chat\/booking-turn"/);
    expect(useAiChatSrc).toContain("startBookingTurn(");
    expect(useAiChatSrc).toContain("processBookingTurn(");
    expect(useAiChatSrc).toContain("processBookingControl(");
    expect(useAiChatSrc).toContain("processBookingCancel(");
  });
});

describe("entry point — AiChatDetailCard's เริ่มจอง wires through AiChatPanel to startBookingFlow, and closes the detail pane", () => {
  it("[unit] AiChatDetailCard renders btn--ai-chat-booking-start calling onStartBooking", () => {
    expect(detailSrc).toContain('data-testid="btn--ai-chat-booking-start"');
    expect(detailSrc).toContain("onClick={handleStartBooking}");
    expect(detailSrc).toContain("onStartBooking(");
  });

  it("[unit] AiChatPanel's handleStartBooking calls BOTH startBookingFlow AND handleCloseDetail — the detail pane always closes when the flow starts", () => {
    const start = panelSrc.indexOf("function handleStartBooking(camp: BookingCampContext)");
    expect(start).toBeGreaterThan(-1);
    const end = panelSrc.indexOf("\n  }", start);
    const body = panelSrc.slice(start, end);
    expect(body).toContain("startBookingFlow(camp);");
    expect(body).toContain("handleCloseDetail();");
  });
});

describe("booking handlers are wired ONLY to the newest (isCurrent) entry — a superseded block cannot mutate the live flow", () => {
  it("[unit] AiChatMessageList gates every booking handler prop on `isCurrent`", () => {
    expect(listSrc).toContain('const isCurrent = entry.view.kind !== "checkFailed" && entry.view.isCurrent;');
    expect(listSrc).toContain("onChipSelect={isCurrent ? onBookingChipSelect : undefined}");
    expect(listSrc).toContain("onBack={isCurrent ? onBookingBack : undefined}");
    expect(listSrc).toContain("onCancel={isCurrent ? onBookingCancel : undefined}");
  });
});

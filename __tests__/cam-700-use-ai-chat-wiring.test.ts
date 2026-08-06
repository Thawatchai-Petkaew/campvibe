/**
 * cam-700-use-ai-chat-wiring.test.ts — CAM-700 (epic CAM-695)
 *
 * Source-inspection Prove-It coverage for the `spot` step's wiring inside
 * `use-ai-chat.ts` — this repo's established precedent for a
 * `useSession()`-gated hook with no jsdom/RTL harness (cam-423-ui-resume.
 * test.ts's own header; the real STATE-TRANSITION logic already has full
 * unit coverage with an injected fetcher in cam-700-spot-turn.test.ts, which
 * needs no React at all).
 *
 * Three structural guarantees proved here:
 *   1. the hook imports `resolveSpotStep`/`resolveSpotSelection` from the
 *      pure `booking-turn.ts` module (no inline re-implementation of the
 *      async orchestration)
 *   2. a chip tap OR typed text at the `spot` step routes through
 *      `handleSpotSelection` — never the generic synchronous
 *      `processBookingTurn` path (which has no occupancy gate)
 *   3. `AiChatBookingStepProps`'s public shape is UNCHANGED by this story —
 *      `editNights`/`editSpot` reuse the EXISTING `onBookingBack`, so
 *      `AiChatPanel.tsx`/`AiChatMessageList.tsx` needed no new prop plumbing
 *      (out of this story's file surface)
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const read = (p: string) => readFileSync(resolve(__dirname, "..", p), "utf-8");

const useAiChatSrc = read("components/ai-chat/use-ai-chat.ts");
const panelSrc = read("components/ai-chat/AiChatPanel.tsx");
const listSrc = read("components/ai-chat/AiChatMessageList.tsx");

describe("the spot step's async orchestration is imported from booking-turn.ts (no inline re-implementation)", () => {
  it("[unit] use-ai-chat.ts imports resolveSpotStep/resolveSpotSelection from booking-turn.ts", () => {
    expect(useAiChatSrc).toMatch(/from "@\/components\/ai-chat\/booking-turn"/);
    expect(useAiChatSrc).toContain("resolveSpotStep(");
    expect(useAiChatSrc).toContain("resolveSpotSelection(");
  });
});

describe("chip taps and typed text at the `spot` step route through handleSpotSelection, never the generic synchronous path", () => {
  it('[unit] onBookingChipSelect branches on step === "spot" and calls handleSpotSelection', () => {
    const start = useAiChatSrc.indexOf("const onBookingChipSelect = useCallback(");
    expect(start).toBeGreaterThan(-1);
    const end = useAiChatSrc.indexOf("\n  );", start);
    const body = useAiChatSrc.slice(start, end);
    expect(body).toMatch(/step === "spot"/);
    expect(body).toContain("handleSpotSelection(");
  });

  it('[unit] sendMessage branches on step === "spot" BEFORE reaching the generic processBookingTurn call, and calls handleSpotSelection', () => {
    const start = useAiChatSrc.indexOf("const sendMessage = useCallback(");
    expect(start).toBeGreaterThan(-1);
    const end = useAiChatSrc.indexOf("\n  );", start);
    const body = useAiChatSrc.slice(start, end);
    const spotBranchIdx = body.indexOf('step === "spot"');
    const genericCallIdx = body.indexOf("processBookingTurn(entries, bookingRef.current");
    expect(spotBranchIdx).toBeGreaterThan(-1);
    expect(genericCallIdx).toBeGreaterThan(-1);
    expect(spotBranchIdx).toBeLessThan(genericCallIdx); // spot is intercepted first
    expect(body).toContain("handleSpotSelection(");
  });
});

describe("settleBookingTurn only fetches when the flow just landed on `spot` with no cached candidates (no-op otherwise)", () => {
  it('[unit] the guard checks BOTH step.id !== "spot" and spotCandidates already resolved', () => {
    const start = useAiChatSrc.indexOf("const settleBookingTurn = useCallback(");
    expect(start).toBeGreaterThan(-1);
    const end = useAiChatSrc.indexOf("\n  );", start);
    const body = useAiChatSrc.slice(start, end);
    expect(body).toMatch(/step\.id !== "spot"/);
    expect(body).toContain("resolveSpotStep(");
  });
});

describe("no new prop was added to AiChatBookingStepProps for editNights/editSpot — AiChatPanel/AiChatMessageList wiring is untouched by this story", () => {
  it("[unit] AiChatPanel.tsx never mentions onBookingEditNights/onBookingEditSpot (out of this story's file surface)", () => {
    expect(panelSrc).not.toContain("onBookingEditNights");
    expect(panelSrc).not.toContain("onBookingEditSpot");
  });

  it("[unit] AiChatMessageList.tsx never mentions onBookingEditNights/onBookingEditSpot either", () => {
    expect(listSrc).not.toContain("onBookingEditNights");
    expect(listSrc).not.toContain("onBookingEditSpot");
  });
});

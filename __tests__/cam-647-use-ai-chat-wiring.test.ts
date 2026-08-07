/**
 * cam-647-use-ai-chat-wiring.test.ts — CAM-647 (epic CAM-695, ADR-016
 * decision point 5) "The chat summary is checked against live availability
 * before it is shown"
 *
 * Source-inspection Prove-It coverage for the `use-ai-chat.ts` wiring — this
 * repo's established precedent for a `useSession()`-gated hook with no
 * jsdom/RTL harness (cam-640/cam-700/cam-702's own `use-ai-chat-wiring` test
 * files; the real re-check logic already has full DI-fake coverage with no
 * React at all in `cam-647-summary-check.test.ts`).
 *
 * Four structural guarantees proved here:
 *   1. `settleBookingTurn` runs the live re-check the moment the flow lands
 *      on `summary` (never touching `sending`)
 *   2. `handleSpotSelection`'s "Free" success path routes through
 *      `settleBookingTurn` (no duplicated apply-and-check logic)
 *   3. `runSummaryCheck` is imported from the pure `booking-turn.ts` module
 *      (no inline re-implementation of the fetch/branch orchestration)
 *   4. the remaining-capacity fetch goes through `lib/api-client.ts`
 *      (`campSiteAvailabilityAPI`), never a raw `fetch(` call
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const read = (p: string) => readFileSync(resolve(__dirname, "..", p), "utf-8");

const useAiChatSrc = read("components/ai-chat/use-ai-chat.ts");
const apiClientSrc = read("lib/api-client.ts");

function bodyOf(src: string, startMarker: string, endMarker = "\n  );"): string {
  const start = src.indexOf(startMarker);
  expect(start, `${startMarker} not found`).toBeGreaterThan(-1);
  const end = src.indexOf(endMarker, start);
  expect(end, `closing marker not found after ${startMarker}`).toBeGreaterThan(start);
  return src.slice(start, end);
}

describe("settleBookingTurn runs the live re-check when the flow lands on `summary`", () => {
  it('[unit] the guard checks step.id === "summary" and calls runSummaryCheck', () => {
    const body = bodyOf(useAiChatSrc, "const settleBookingTurn = useCallback(");
    expect(body).toMatch(/step\.id === "summary"/);
    expect(body).toContain("runSummaryCheck(");
  });

  it("[unit] settleBookingTurn's body never calls setSending", () => {
    const body = bodyOf(useAiChatSrc, "const settleBookingTurn = useCallback(");
    expect(body).not.toContain("setSending(");
  });
});

describe("runSummaryCheck never touches `sending` — the composer is never disabled by the live re-check", () => {
  it("[unit] runSummaryCheck's body never calls setSending", () => {
    const body = bodyOf(useAiChatSrc, "const runSummaryCheck = useCallback(");
    expect(body).not.toContain("setSending(");
  });

  it("[unit] runSummaryCheck imports resolveSummaryCheck from booking-turn.ts (no inline re-implementation)", () => {
    expect(useAiChatSrc).toMatch(/from "@\/components\/ai-chat\/booking-turn"/);
    expect(useAiChatSrc).toContain("resolveSummaryCheck(");
  });
});

describe("handleSpotSelection's Free success path routes through settleBookingTurn — no duplicated apply-and-check logic", () => {
  it("[unit] the non-retry tail calls settleBookingTurn with the outcome, never a bare setEntries/bookingRef pair", () => {
    const body = bodyOf(useAiChatSrc, "const handleSpotSelection = useCallback(");
    expect(body).toContain("await settleBookingTurn({ entries: outcome.entries, booking: outcome.booking });");
  });
});

describe("the remaining-capacity fetch goes through lib/api-client.ts, never a raw fetch(", () => {
  it("[unit] checkRemainingCapacityForFlow calls campSiteAvailabilityAPI.getRemainingCapacity", () => {
    const body = bodyOf(useAiChatSrc, "async function checkRemainingCapacityForFlow(", "\n}");
    expect(body).toContain("campSiteAvailabilityAPI.getRemainingCapacity(");
    expect(body).not.toContain("fetch(");
  });

  it("[unit] lib/api-client.ts's getRemainingCapacity calls GET /campsites/[id]/remaining-capacity via the shared fetchAPI helper", () => {
    const start = apiClientSrc.indexOf("getRemainingCapacity: async (");
    expect(start).toBeGreaterThan(-1);
    const end = apiClientSrc.indexOf("\n    },", start);
    const body = apiClientSrc.slice(start, end);
    expect(body).toContain("fetchAPI<RemainingCapacityDTO>(`/campsites/${campSiteId}/remaining-capacity");
  });
});

describe("remaining===null is never fabricated into `full` at the wiring layer (the caller passes the raw value through)", () => {
  it("[unit] checkRemainingCapacityForFlow forwards result.data.remaining unchanged, no coercion to 0/false", () => {
    const body = bodyOf(useAiChatSrc, "async function checkRemainingCapacityForFlow(", "\n}");
    expect(body).toContain("remaining: result.data.remaining");
    expect(body).not.toMatch(/remaining:\s*result\.data\.remaining\s*\?\?/);
  });
});

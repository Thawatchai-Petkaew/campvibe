/**
 * cam-272-ai-chat-contract-reconciliation.test.ts — CAM-272
 *
 * QA CONTRACT RECONCILIATION (dispatch top priority): CAM-272's UI was built
 * against an ASSUMED shape for CAM-271's `200 { answer, cards }` response.
 * This file traces the REAL wire shape end to end —
 *   runAssistantTurn -> searchCampsites -> campCardSelect (Prisma.Decimal /
 *   Date columns) -> app/api/ai/chat/route.ts's NextResponse.json ->
 *   the client's AiChatCardResponse / isAiChatCardResponse (lib/api-client.ts)
 * — using the REAL `POST` handler with ONLY `runAssistantTurn` mocked (the
 * exact same outer-boundary-only mock CAM-271's own route test uses — no
 * live OpenRouter key/spend, no real HTTP call, matches the HARD RULE).
 *
 * FINDING (CRITICAL — filed as a defect, NOT fixed here; QA does not write
 * production code, .claude/rules/qa.md §5):
 *
 *   `campCardSelect` (lib/read-models/camp-card.ts) selects `priceLow` and
 *   `avgRating` as `Prisma.Decimal` columns (`prisma/schema.prisma`
 *   `Decimal(12,2)` / `Decimal(2,1)`). `app/api/ai/chat/route.ts` (CAM-271)
 *   forwards `result.cards` straight into `NextResponse.json` with NO
 *   `serializeDecimals()` call — the established convention every other
 *   route uses (`app/api/bookings/route.ts`, `app/api/campsites/route.ts`,
 *   `lib/serialize.ts`). `Prisma.Decimal`'s own `toJSON()` (decimal.js)
 *   returns a STRING, so the real wire response ships `priceLow`/`avgRating`
 *   as JSON STRINGS, never a `number`.
 *
 *   The client's `isAiChatCardResponse` (lib/api-client.ts) requires
 *   `typeof v.priceLow === 'number'`. Section A below proves the real wire
 *   value is a string; Section B proves the client-visible consequence:
 *   `parseAiChatSuccessBody` silently drops EVERY real campsite that has a
 *   price (i.e. effectively all real campsites) from `cards[]`, and the
 *   conversation then renders the AC-4 zero-result copy
 *   (`ยังไม่พบลานที่ตรงกับที่ค้นหา ลองปรับเงื่อนไขดูนะ`) even when the
 *   server found real matching campsites — breaking AC-2 (in-chat cards)
 *   for effectively every real search.
 *
 *   Only `priceLow: null` (a free camp) survives today, because `null`
 *   round-trips unchanged regardless of the Decimal bug — confirmed as a
 *   control case in both sections below, so the failure is proven to be
 *   price-specific, not a broken test harness.
 *
 * Prove-It semantics (.claude/rules/qa.md: "a test that cannot go red is
 * worthless"): Section B uses Vitest's `it.fails()` — the suite stays GREEN
 * today (the inner assertion's failure is EXPECTED because the fix has not
 * landed), but the moment route.ts or api-client.ts is fixed WITHOUT
 * updating this file, the inner assertion starts passing and `it.fails()`
 * flips the whole node to FAILED ("Expect test to fail") — the fix author
 * cannot silently walk past this guard; flip `it.fails` -> `it` there.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { _store } from "@/lib/rate-limit";
import { parseAiChatSuccessBody } from "@/lib/api-client";
import { appendOutcome } from "@/components/ai-chat/conversation";

const mockRunAssistantTurn = vi.fn();
vi.mock("@/lib/ai/openrouter-client", () => ({
  runAssistantTurn: (...args: unknown[]) => mockRunAssistantTurn(...args),
}));

const { POST } = await import("@/app/api/ai/chat/route");

function makeRequest(body: unknown, ip: string): NextRequest {
  return new NextRequest("http://localhost/api/ai/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify(body),
  });
}

/** Mirrors campCardSelect's exact field set (lib/read-models/camp-card.ts) with REAL Prisma.Decimal/Date instances — this is what executeSearchCampsites actually returns, never a plain `{id:'c1'}` stub. */
function realisticCard(overrides: Record<string, unknown> = {}) {
  return {
    id: "cs_1",
    nameTh: "ลานกางเต็นท์ริมน้ำ",
    nameEn: "Riverside Camp",
    nameThSlug: "riverside-camp-th",
    nameEnSlug: "riverside-camp-en",
    priceLow: new Prisma.Decimal("1500.00"),
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    avgRating: new Prisma.Decimal("4.5"),
    reviewCount: 12,
    location: { province: "เชียงใหม่" },
    images: [{ url: "/img/a.jpg", sortOrder: 0 }],
    ...overrides,
  };
}

let ipCounter = 200;
function freshIp(): string {
  ipCounter += 1;
  return `203.0.114.${ipCounter}`;
}

beforeEach(() => {
  vi.clearAllMocks();
  _store.clear();
});

afterEach(() => {
  _store.clear();
});

describe("Section A — ground truth: the REAL route.ts wire shape for a priced campsite card", () => {
  it("[integration] a real Prisma-shaped card (Decimal priceLow) ships priceLow as a STRING on the wire, never a number", async () => {
    mockRunAssistantTurn.mockResolvedValueOnce({ ok: true, answer: "พบแคมป์ริมน้ำ 1 แห่ง", cards: [realisticCard()] });

    const res = await POST(makeRequest({ messages: [{ role: "user", content: "หาแคมป์ริมน้ำ" }] }, freshIp()));
    const body = (await res.json()) as { cards: Array<Record<string, unknown>> };

    expect(res.status).toBe(200);
    expect(typeof body.cards[0].priceLow).toBe("string"); // NOT 'number' — this is the ground truth AiChatCardResponse assumes away
    expect(body.cards[0].priceLow).toBe("1500");
  });

  it("[boundary] a free camp (priceLow: null) still ships null — unaffected, control case for Section B", async () => {
    mockRunAssistantTurn.mockResolvedValueOnce({ ok: true, answer: "พบแคมป์ฟรี 1 แห่ง", cards: [realisticCard({ priceLow: null })] });

    const res = await POST(makeRequest({ messages: [{ role: "user", content: "หาแคมป์ฟรี" }] }, freshIp()));
    const body = (await res.json()) as { cards: Array<Record<string, unknown>> };

    expect(body.cards[0].priceLow).toBeNull();
  });

  it("[integration] avgRating (also Decimal) ships as a string too — an extra field AiChatCardResponse doesn't even declare", async () => {
    mockRunAssistantTurn.mockResolvedValueOnce({ ok: true, answer: "x", cards: [realisticCard()] });

    const res = await POST(makeRequest({ messages: [{ role: "user", content: "q" }] }, freshIp()));
    const body = (await res.json()) as { cards: Array<Record<string, unknown>> };

    expect(typeof body.cards[0].avgRating).toBe("string");
    expect(body.cards[0].reviewCount).toBe(12); // plain Int column — unaffected
  });

  it("[integration] createdAt (a Date instance) DOES already ship as an ISO string — Date.toJSON, unlike Decimal, matches the client's assumed shape", async () => {
    mockRunAssistantTurn.mockResolvedValueOnce({ ok: true, answer: "x", cards: [realisticCard()] });

    const res = await POST(makeRequest({ messages: [{ role: "user", content: "q" }] }, freshIp()));
    const body = (await res.json()) as { cards: Array<Record<string, unknown>> };

    expect(body.cards[0].createdAt).toBe("2026-01-01T00:00:00.000Z");
  });
});

describe("Section B — CRITICAL DEFECT (filed, NOT fixed here — see file header): the client silently drops every real priced card", () => {
  it.fails(
    "[DEFECT] parseAiChatSuccessBody should keep a real priced card parsed from the REAL route body (currently drops it — priceLow arrives as a string, isAiChatCardResponse requires typeof 'number')",
    async () => {
      mockRunAssistantTurn.mockResolvedValueOnce({ ok: true, answer: "พบแคมป์ริมน้ำ 1 แห่ง", cards: [realisticCard()] });
      const res = await POST(makeRequest({ messages: [{ role: "user", content: "หาแคมป์ริมน้ำ" }] }, freshIp()));
      const wireBody: unknown = await res.json(); // the EXACT body a real fetch() caller receives

      const outcome = parseAiChatSuccessBody(wireBody);
      expect(outcome.kind).toBe("ok"); // true today (answer is a valid string)
      if (outcome.kind === "ok") expect(outcome.cards).toHaveLength(1); // FALSE today — actual is 0, this line throws
    }
  );

  it.fails(
    "[DEFECT] AC-2/AC-4: a search that actually found 1 campsite must NOT render the AC-4 zero-result copy (currently does — the card was dropped upstream)",
    async () => {
      mockRunAssistantTurn.mockResolvedValueOnce({ ok: true, answer: "พบแคมป์ริมน้ำ 1 แห่ง", cards: [realisticCard()] });
      const res = await POST(makeRequest({ messages: [{ role: "user", content: "หาแคมป์ริมน้ำ" }] }, freshIp()));
      const wireBody: unknown = await res.json();

      const outcome = parseAiChatSuccessBody(wireBody);
      const entries = appendOutcome([], outcome, "หาแคมป์ริมน้ำ");
      const entry = entries[0];

      expect(entry).toMatchObject({ kind: "answer", zeroResult: false }); // actual: zeroResult:true — throws
      if (entry.role === "assistant" && entry.kind === "answer") {
        expect(entry.cards).toHaveLength(1);
      }
    }
  );

  it("[control] a free (priceLow: null) card DOES survive the full pipeline correctly today — proves the drop above is price-specific, not a broken test harness", async () => {
    mockRunAssistantTurn.mockResolvedValueOnce({ ok: true, answer: "พบแคมป์ฟรี 1 แห่ง", cards: [realisticCard({ priceLow: null })] });
    const res = await POST(makeRequest({ messages: [{ role: "user", content: "หาแคมป์ฟรี" }] }, freshIp()));
    const wireBody: unknown = await res.json();

    const outcome = parseAiChatSuccessBody(wireBody);
    expect(outcome.kind).toBe("ok");
    if (outcome.kind === "ok") expect(outcome.cards).toHaveLength(1);

    const entries = appendOutcome([], outcome, "หาแคมป์ฟรี");
    expect(entries[0]).toMatchObject({ kind: "answer", zeroResult: false });
  });
});

/**
 * cam-427-wire-options-trim.test.ts — CAM-427 QA gap fix.
 *
 * The `toWireCards` `options[]` trim branch (app/api/ai/chat/route.ts) shipped
 * with ZERO direct test — every existing route-level fixture
 * (`cam-272-ai-chat-contract-reconciliation.test.ts`'s `realisticCard()`)
 * omits `options` entirely, so `Array.isArray(c.options)` never evaluated
 * true anywhere in the suite (confirmed via `vitest --coverage`: route.ts
 * lines 120-126 uncovered). This file exercises the REAL POST handler with a
 * card carrying `options` end to end, proving:
 *   - AC-1's system effect: the card's "first tag" survives onto the wire
 *   - only `{nameTh, nameEn}` reach the client — `code`/`group` (server-
 *     internal taxonomy fields) never leak, per the route's own doc comment
 *   - an empty `options: []` (EC-1 — no Terrain row) survives as `[]`, not
 *     omitted/undefined
 *
 * Coverage matrix:
 *   - normal: options: [{code,nameTh,nameEn}] -> wire {nameTh,nameEn} only
 *   - null/empty: options: [] -> wire []
 *   - regression: existing images/priceLow trimming (CAM-272) unaffected
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { _store } from "@/lib/rate-limit";

const mockRunAssistantTurn = vi.fn();
vi.mock("@/lib/ai/openrouter-client", () => ({
  runAssistantTurnFromMessages: (...args: unknown[]) => mockRunAssistantTurn(...args),
}));

const { POST } = await import("@/app/api/ai/chat/route");

function makeRequest(body: unknown, ip: string): NextRequest {
  return new NextRequest("http://localhost/api/ai/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify(body),
  });
}

/** Mirrors aiCampCardSelect's exact field set (lib/read-models/ai-camp-card.ts). */
function realisticCardWithOptions(options: unknown[]) {
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
    options,
    hasReviews: true,
    remaining: null,
  };
}

let ipCounter = 500;
function freshIp(): string {
  ipCounter += 1;
  return `203.0.116.${ipCounter}`;
}

beforeEach(() => {
  vi.clearAllMocks();
  _store.clear();
});

afterEach(() => {
  _store.clear();
});

describe("toWireCards — CAM-427 options[] trim (normal)", () => {
  it("[normal] a card's options[] survives the wire trimmed to {nameTh, nameEn} only — code/group never leak", async () => {
    mockRunAssistantTurn.mockResolvedValueOnce({
      ok: true,
      answer: "พบแคมป์ริมน้ำ 1 แห่ง",
      cards: [
        realisticCardWithOptions([
          { code: "RIVE", nameTh: "แม่น้ำ ลำธาร คลองเล็ก", nameEn: "River, stream, or creek" },
        ]),
      ],
    });

    const res = await POST(makeRequest({ messages: [{ role: "user", content: "หาแคมป์ริมน้ำ" }] }, freshIp()));
    const body = (await res.json()) as { cards: Array<Record<string, unknown>> };

    expect(res.status).toBe(200);
    expect(body.cards[0].options).toEqual([
      { nameTh: "แม่น้ำ ลำธาร คลองเล็ก", nameEn: "River, stream, or creek" },
    ]);
    expect(body.cards[0].options as unknown[]).toHaveLength(1);
    const tag = (body.cards[0].options as Record<string, unknown>[])[0];
    expect(tag).not.toHaveProperty("code");
    expect(tag).not.toHaveProperty("group");
  });
});

describe("toWireCards — CAM-427 options[] trim (null/empty, EC-1)", () => {
  it("[null/empty] a camp with no Terrain-group row ships options: [] on the wire, never omitted/undefined", async () => {
    mockRunAssistantTurn.mockResolvedValueOnce({
      ok: true,
      answer: "พบแคมป์ 1 แห่ง",
      cards: [realisticCardWithOptions([])],
    });

    const res = await POST(makeRequest({ messages: [{ role: "user", content: "หาแคมป์" }] }, freshIp()));
    const body = (await res.json()) as { cards: Array<Record<string, unknown>> };

    expect(body.cards[0].options).toEqual([]);
  });
});

describe("toWireCards — CAM-427 regression (CAM-272 trimming still applies alongside options)", () => {
  it("[regression] priceLow ships as a number and images[].sortOrder is still dropped when options is also present", async () => {
    mockRunAssistantTurn.mockResolvedValueOnce({
      ok: true,
      answer: "x",
      cards: [realisticCardWithOptions([{ code: "MTNS", nameTh: "ภูเขา", nameEn: "Mountain" }])],
    });

    const res = await POST(makeRequest({ messages: [{ role: "user", content: "q" }] }, freshIp()));
    const body = (await res.json()) as { cards: Array<Record<string, unknown>> };

    expect(typeof body.cards[0].priceLow).toBe("number");
    expect(body.cards[0].images).toEqual([{ url: "/img/a.jpg" }]);
    expect(body.cards[0].hasReviews).toBe(true);
    expect(body.cards[0].remaining).toBeNull();
  });
});

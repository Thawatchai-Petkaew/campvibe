/**
 * cam-272-ai-chat-contract-reconciliation.test.ts — CAM-272
 *
 * QA CONTRACT RECONCILIATION: traces the REAL wire shape end to end —
 *   runAssistantTurn -> searchCampsites -> campCardSelect (Prisma.Decimal /
 *   Date columns) -> app/api/ai/chat/route.ts's NextResponse.json ->
 *   the client's AiChatCardResponse / isAiChatCardResponse (lib/api-client.ts)
 * — using the REAL `POST` handler with ONLY `runAssistantTurn` mocked (the
 * exact same outer-boundary-only mock CAM-271's own route test uses — no
 * live OpenRouter key/spend, no real HTTP call, matches the HARD RULE).
 *
 * FIX LANDED (was filed as a Critical defect in test.md, now closed):
 * `app/api/ai/chat/route.ts` now shapes `result.cards` through `toWireCards`
 * (serializeDecimals + drops images[].sortOrder + surfaces avgRating/
 * reviewCount) before `NextResponse.json` — the same convention every other
 * route uses (`app/api/bookings/route.ts`, `app/api/campsites/route.ts`,
 * `lib/serialize.ts`). `priceLow`/`avgRating` now ship as JSON NUMBERS, so
 * the client's `isAiChatCardResponse` (`typeof === 'number'`) accepts a real
 * priced card instead of silently dropping it.
 *
 * Section B previously carried `it.fails()` Prove-It reproductions (this
 * file's original form, see git history) — now converted to standard green
 * assertions of the FIXED behavior per the fix-author's own rule: "flip
 * `it.fails` -> `it` there." A regression here means the fix regressed.
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

let ipCounter = 300;
function freshIp(): string {
  ipCounter += 1;
  return `203.0.115.${ipCounter}`;
}

beforeEach(() => {
  vi.clearAllMocks();
  _store.clear();
});

afterEach(() => {
  _store.clear();
});

describe("Section A — ground truth: the FIXED route.ts wire shape for a priced campsite card", () => {
  it("[integration] a real Prisma-shaped card (Decimal priceLow) now ships priceLow as a NUMBER on the wire", async () => {
    mockRunAssistantTurn.mockResolvedValueOnce({ ok: true, answer: "พบแคมป์ริมน้ำ 1 แห่ง", cards: [realisticCard()] });

    const res = await POST(makeRequest({ messages: [{ role: "user", content: "หาแคมป์ริมน้ำ" }] }, freshIp()));
    const body = (await res.json()) as { cards: Array<Record<string, unknown>> };

    expect(res.status).toBe(200);
    expect(typeof body.cards[0].priceLow).toBe("number");
    expect(body.cards[0].priceLow).toBe(1500);
  });

  it("[boundary] a free camp (priceLow: null) still ships null — unaffected control case", async () => {
    mockRunAssistantTurn.mockResolvedValueOnce({ ok: true, answer: "พบแคมป์ฟรี 1 แห่ง", cards: [realisticCard({ priceLow: null })] });

    const res = await POST(makeRequest({ messages: [{ role: "user", content: "หาแคมป์ฟรี" }] }, freshIp()));
    const body = (await res.json()) as { cards: Array<Record<string, unknown>> };

    expect(body.cards[0].priceLow).toBeNull();
  });

  it("[integration] avgRating (also Decimal) now ships as a NUMBER too, and reviewCount is forwarded", async () => {
    mockRunAssistantTurn.mockResolvedValueOnce({ ok: true, answer: "x", cards: [realisticCard()] });

    const res = await POST(makeRequest({ messages: [{ role: "user", content: "q" }] }, freshIp()));
    const body = (await res.json()) as { cards: Array<Record<string, unknown>> };

    expect(typeof body.cards[0].avgRating).toBe("number");
    expect(body.cards[0].avgRating).toBe(4.5);
    expect(body.cards[0].reviewCount).toBe(12);
  });

  it("[integration] createdAt (a Date instance) ships as an ISO string — unchanged by the fix", async () => {
    mockRunAssistantTurn.mockResolvedValueOnce({ ok: true, answer: "x", cards: [realisticCard()] });

    const res = await POST(makeRequest({ messages: [{ role: "user", content: "q" }] }, freshIp()));
    const body = (await res.json()) as { cards: Array<Record<string, unknown>> };

    expect(body.cards[0].createdAt).toBe("2026-01-01T00:00:00.000Z");
  });

  it("[unit] images[].sortOrder is dropped from the wire (QA Info finding) — only {url} survives", async () => {
    mockRunAssistantTurn.mockResolvedValueOnce({ ok: true, answer: "x", cards: [realisticCard()] });

    const res = await POST(makeRequest({ messages: [{ role: "user", content: "q" }] }, freshIp()));
    const body = (await res.json()) as { cards: Array<{ images: Array<Record<string, unknown>> }> };

    expect(body.cards[0].images).toEqual([{ url: "/img/a.jpg" }]);
    expect(body.cards[0].images[0]).not.toHaveProperty("sortOrder");
  });
});

describe("Section B — the client no longer drops a real priced card (defect closed)", () => {
  it("[FIXED] parseAiChatSuccessBody keeps a real priced card parsed from the REAL route body", async () => {
    mockRunAssistantTurn.mockResolvedValueOnce({ ok: true, answer: "พบแคมป์ริมน้ำ 1 แห่ง", cards: [realisticCard()] });
    const res = await POST(makeRequest({ messages: [{ role: "user", content: "หาแคมป์ริมน้ำ" }] }, freshIp()));
    const wireBody: unknown = await res.json(); // the EXACT body a real fetch() caller receives

    const outcome = parseAiChatSuccessBody(wireBody);
    expect(outcome.kind).toBe("ok");
    if (outcome.kind === "ok") {
      expect(outcome.cards).toHaveLength(1);
      expect(outcome.cards[0].priceLow).toBe(1500);
      expect(outcome.cards[0].avgRating).toBe(4.5);
      expect(outcome.cards[0].reviewCount).toBe(12);
    }
  });

  it("[FIXED] AC-2/AC-4: a search that actually found 1 campsite renders it, NOT the AC-4 zero-result copy", async () => {
    mockRunAssistantTurn.mockResolvedValueOnce({ ok: true, answer: "พบแคมป์ริมน้ำ 1 แห่ง", cards: [realisticCard()] });
    const res = await POST(makeRequest({ messages: [{ role: "user", content: "หาแคมป์ริมน้ำ" }] }, freshIp()));
    const wireBody: unknown = await res.json();

    const outcome = parseAiChatSuccessBody(wireBody);
    const entries = appendOutcome([], outcome, "หาแคมป์ริมน้ำ");
    const entry = entries[0];

    expect(entry).toMatchObject({ kind: "answer", zeroResult: false });
    if (entry.role === "assistant" && entry.kind === "answer") {
      expect(entry.cards).toHaveLength(1);
    }
  });

  it("[control] a free (priceLow: null) card also survives the full pipeline correctly", async () => {
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

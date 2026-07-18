/**
 * cam-272-ai-chat-conversation.test.ts — CAM-272
 *
 * Real unit tests (not source-grep) for the pure conversation state machine
 * (components/ai-chat/conversation.ts) and the client-side response
 * validation in lib/api-client.ts (aiChatAPI). All fetch calls are mocked —
 * this suite NEVER calls the real /api/ai/chat endpoint (CAM-271 isn't live
 * yet, and a live key must never be hit from tests).
 *
 * AC coverage: AC-2 (history capping/building), AC-4/EC-2 (zero-result),
 * AC-5/EC-5 (error + retry), AC-6/EC-3 (rate-limited), AC-7/EC-4 (disabled,
 * persists), EC-1/BR-6 (empty/whitespace guard), EC-6 (malformed card
 * dropped, never crashes the turn).
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  appendOutcome,
  appendUserQuestion,
  buildOutgoingHistory,
  entriesBeforeRetry,
  isAssistantDisabled,
  isSendableQuestion,
  nextEntryId,
  type ChatEntry,
} from "../components/ai-chat/conversation";
import {
  aiChatAPI,
  isAiChatCardResponse,
  parseAiChatSuccessBody,
  AI_CHAT_MAX_MESSAGES,
  type AiChatCardResponse,
} from "../lib/api-client";

const card = (overrides: Partial<AiChatCardResponse> = {}): AiChatCardResponse => ({
  id: "c1",
  nameTh: "แคมป์ทดสอบ",
  nameEn: "Test Camp",
  nameThSlug: "camp-th",
  nameEnSlug: "camp-en",
  priceLow: 500,
  createdAt: "2026-01-01T00:00:00.000Z",
  location: { province: "เชียงใหม่" },
  images: [{ url: "/a.jpg" }],
  ...overrides,
});

describe("isSendableQuestion (BR-6/EC-1)", () => {
  it("[null/empty] rejects an empty string", () => expect(isSendableQuestion("")).toBe(false));
  it("[boundary] rejects whitespace-only", () => expect(isSendableQuestion("   \n\t")).toBe(false));
  it("[normal] accepts real text, trimming outer whitespace", () => expect(isSendableQuestion("  หาแคมป์  ")).toBe(true));
});

describe("nextEntryId — monotonic, unique", () => {
  it("[normal] never returns the same id twice", () => {
    const a = nextEntryId();
    const b = nextEntryId();
    expect(a).not.toBe(b);
  });
});

describe("appendUserQuestion / buildOutgoingHistory (AC-2)", () => {
  it("[normal] a fresh thread sends just the one new question", () => {
    const history = buildOutgoingHistory([], "หาที่แคมป์ติดน้ำ");
    expect(history).toEqual([{ role: "user", content: "หาที่แคมป์ติดน้ำ" }]);
  });

  it("[normal] prior user + assistant-answer turns are carried as context", () => {
    const entries: ChatEntry[] = [
      { id: "1", role: "user", text: "q1" },
      { id: "2", role: "assistant", kind: "answer", text: "a1", cards: [], zeroResult: true },
    ];
    const history = buildOutgoingHistory(entries, "q2");
    expect(history).toEqual([
      { role: "user", content: "q1" },
      { role: "assistant", content: "a1" },
      { role: "user", content: "q2" },
    ]);
  });

  it("[boundary] caps at AI_CHAT_MAX_MESSAGES, dropping the oldest first", () => {
    const entries: ChatEntry[] = [];
    for (let i = 0; i < 12; i++) entries.push({ id: `u${i}`, role: "user", text: `q${i}` });
    const history = buildOutgoingHistory(entries, "latest");
    expect(history).toHaveLength(AI_CHAT_MAX_MESSAGES);
    expect(history[history.length - 1]).toEqual({ role: "user", content: "latest" });
    expect(history[0].content).not.toBe("q0"); // the oldest entries were dropped
  });

  it("[null/empty] notice-only assistant turns (rate-limited/disabled/error) contribute no history entry", () => {
    const entries: ChatEntry[] = [
      { id: "1", role: "user", text: "q1" },
      { id: "2", role: "assistant", kind: "rate-limited" },
      { id: "3", role: "assistant", kind: "disabled" },
      { id: "4", role: "assistant", kind: "error", retryQuestion: "q1" },
    ];
    const history = buildOutgoingHistory(entries, "q2");
    expect(history).toEqual([
      { role: "user", content: "q1" },
      { role: "user", content: "q2" },
    ]);
  });

  it("[unit] appendUserQuestion appends a user entry with a fresh id", () => {
    const next = appendUserQuestion([], "hello");
    expect(next).toHaveLength(1);
    expect(next[0]).toMatchObject({ role: "user", text: "hello" });
  });
});

describe("appendOutcome (AC-4/EC-2 zero-result, AC-5, AC-6, AC-7)", () => {
  it("[normal] an ok outcome with cards renders zeroResult=false", () => {
    const next = appendOutcome([], { kind: "ok", answer: "here", cards: [card()] }, "q");
    expect(next[0]).toMatchObject({ kind: "answer", text: "here", zeroResult: false });
    expect((next[0] as any).cards).toHaveLength(1);
  });

  it("[null/empty] EC-2: an ok outcome with cards:[] renders zeroResult=true, no cards", () => {
    const next = appendOutcome([], { kind: "ok", answer: "no matches", cards: [] }, "q");
    expect(next[0]).toMatchObject({ kind: "answer", zeroResult: true });
    expect((next[0] as any).cards).toEqual([]);
  });

  it("[error/validation] EC-3: rate-limited maps to a rate-limited entry", () => {
    const next = appendOutcome([], { kind: "rate-limited" }, "q");
    expect(next[0]).toEqual({ id: expect.any(String), role: "assistant", kind: "rate-limited" });
  });

  it("[error/validation] EC-4: disabled maps to a disabled entry", () => {
    const next = appendOutcome([], { kind: "disabled" }, "q");
    expect(next[0]).toMatchObject({ kind: "disabled" });
  });

  it("[error/validation] EC-5: error carries the retryQuestion for AC-5's retry", () => {
    const next = appendOutcome([], { kind: "error" }, "หาแคมป์ริมน้ำ");
    expect(next[0]).toMatchObject({ kind: "error", retryQuestion: "หาแคมป์ริมน้ำ" });
  });
});

describe("entriesBeforeRetry (AC-5) — no duplicate user bubble on retry", () => {
  it("[normal] removes a trailing error notice before resend", () => {
    const entries: ChatEntry[] = [
      { id: "1", role: "user", text: "q" },
      { id: "2", role: "assistant", kind: "error", retryQuestion: "q" },
    ];
    expect(entriesBeforeRetry(entries)).toEqual([entries[0]]);
  });

  it("[boundary] a non-error trailing entry is left untouched", () => {
    const entries: ChatEntry[] = [{ id: "1", role: "user", text: "q" }];
    expect(entriesBeforeRetry(entries)).toEqual(entries);
  });

  it("[null/empty] an empty thread is a no-op", () => {
    expect(entriesBeforeRetry([])).toEqual([]);
  });
});

describe("isAssistantDisabled (EC-4) — persists once seen", () => {
  it("[normal] false on a thread with no disabled notice", () => {
    expect(isAssistantDisabled([{ id: "1", role: "user", text: "q" }])).toBe(false);
  });

  it("[normal] true once any disabled entry exists, even mid-thread", () => {
    const entries: ChatEntry[] = [
      { id: "1", role: "assistant", kind: "disabled" },
      { id: "2", role: "user", text: "q2" },
    ];
    expect(isAssistantDisabled(entries)).toBe(true);
  });
});

describe("isAiChatCardResponse — boundary validation (code.md CAM-305: network I/O is an input boundary)", () => {
  it("[normal] a well-formed card passes", () => expect(isAiChatCardResponse(card())).toBe(true));
  it("[error/validation] missing province fails", () => {
    const bad = { ...card(), location: {} };
    expect(isAiChatCardResponse(bad)).toBe(false);
  });
  it("[error/validation] priceLow as a string (Decimal never un-serialised) fails", () => {
    const bad = { ...card(), priceLow: "500.00" };
    expect(isAiChatCardResponse(bad)).toBe(false);
  });
  it("[boundary] priceLow: null is valid (free camp)", () => {
    expect(isAiChatCardResponse(card({ priceLow: null }))).toBe(true);
  });
  it("[null/empty] null/undefined/primitive values are rejected, not thrown", () => {
    expect(isAiChatCardResponse(null)).toBe(false);
    expect(isAiChatCardResponse(undefined)).toBe(false);
    expect(isAiChatCardResponse("card")).toBe(false);
  });
});

describe("parseAiChatSuccessBody (EC-6) — malformed cards dropped, never crash the turn", () => {
  it("[normal] valid answer + cards parses to kind ok", () => {
    const result = parseAiChatSuccessBody({ answer: "ok", cards: [card()] });
    expect(result).toMatchObject({ kind: "ok", answer: "ok" });
  });

  it("[error/validation] a malformed card entry is silently dropped, the turn still succeeds", () => {
    const result = parseAiChatSuccessBody({ answer: "ok", cards: [card(), { garbage: true }] });
    expect(result.kind).toBe("ok");
    if (result.kind === "ok") expect(result.cards).toHaveLength(1);
  });

  it("[error/validation] a missing `answer` field is an error outcome, not a crash", () => {
    expect(parseAiChatSuccessBody({ cards: [] })).toEqual({ kind: "error" });
  });

  it("[null/empty] a non-object body is an error outcome", () => {
    expect(parseAiChatSuccessBody(null)).toEqual({ kind: "error" });
    expect(parseAiChatSuccessBody("oops")).toEqual({ kind: "error" });
  });

  it("[null/empty] a missing cards[] defaults to an empty array (not a crash)", () => {
    const result = parseAiChatSuccessBody({ answer: "ok" });
    expect(result).toEqual({ kind: "ok", answer: "ok", cards: [] });
  });
});

describe("aiChatAPI.send — status-code mapping (BR-5), fetch always mocked", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function stubFetch(impl: (...args: unknown[]) => Promise<unknown>) {
    vi.stubGlobal("fetch", vi.fn(impl));
  }

  it("[normal] 200 with a valid body -> kind ok", async () => {
    stubFetch(async () => ({ ok: true, status: 200, json: async () => ({ answer: "hi", cards: [] }) }));
    const outcome = await aiChatAPI.send([{ role: "user", content: "q" }]);
    expect(outcome).toEqual({ kind: "ok", answer: "hi", cards: [] });
  });

  it("[error/validation] EC-3: 429 -> kind rate-limited", async () => {
    stubFetch(async () => ({ ok: false, status: 429, json: async () => ({}) }));
    const outcome = await aiChatAPI.send([{ role: "user", content: "q" }]);
    expect(outcome).toEqual({ kind: "rate-limited" });
  });

  it("[error/validation] EC-4: 503 -> kind disabled", async () => {
    stubFetch(async () => ({ ok: false, status: 503, json: async () => ({}) }));
    const outcome = await aiChatAPI.send([{ role: "user", content: "q" }]);
    expect(outcome).toEqual({ kind: "disabled" });
  });

  it("[error/validation] EC-5: any other non-2xx (400/502) -> kind error", async () => {
    stubFetch(async () => ({ ok: false, status: 400, json: async () => ({}) }));
    expect(await aiChatAPI.send([{ role: "user", content: "q" }])).toEqual({ kind: "error" });

    stubFetch(async () => ({ ok: false, status: 502, json: async () => ({}) }));
    expect(await aiChatAPI.send([{ role: "user", content: "q" }])).toEqual({ kind: "error" });
  });

  it("[error/validation] EC-5: a network failure (fetch throws) -> kind error, never crashes", async () => {
    stubFetch(async () => {
      throw new Error("network down");
    });
    const outcome = await aiChatAPI.send([{ role: "user", content: "q" }]);
    expect(outcome).toEqual({ kind: "error" });
  });

  it("[boundary] BR-2 sibling: only the last AI_CHAT_MAX_MESSAGES are sent in the request body", async () => {
    let sentBody = "";
    stubFetch(async (_url: unknown, init: unknown) => {
      sentBody = (init as { body: string }).body;
      return { ok: true, status: 200, json: async () => ({ answer: "ok", cards: [] }) };
    });
    const messages = Array.from({ length: 15 }, (_, i) => ({ role: "user" as const, content: `m${i}` }));
    await aiChatAPI.send(messages);
    const parsed = JSON.parse(sentBody);
    expect(parsed.messages).toHaveLength(AI_CHAT_MAX_MESSAGES);
    expect(parsed.messages[parsed.messages.length - 1].content).toBe("m14");
  });

  it("[security] never fetches OpenRouter directly — the URL always targets the internal facade route", async () => {
    let calledUrl = "";
    stubFetch(async (url: unknown) => {
      calledUrl = String(url);
      return { ok: true, status: 200, json: async () => ({ answer: "ok", cards: [] }) };
    });
    await aiChatAPI.send([{ role: "user", content: "q" }]);
    expect(calledUrl).toBe("/api/ai/chat");
    expect(calledUrl).not.toContain("openrouter");
  });
});

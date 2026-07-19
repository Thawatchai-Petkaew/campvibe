/**
 * cam-423-ui-resume.test.ts — CAM-423 (ADR-013 S9) "UI resume: login
 * re-opens the last chat + a 'start new' button".
 *
 * Pure logic (conversation.ts's `isAuthedSession`/`restoreEntriesFromMessages`,
 * lib/api-client.ts's new `aiChatAPI.sendTurn`/`listConversations`/
 * `getConversation`) gets REAL unit tests, fetch always mocked. The
 * `useSession()`-gated hook/panel wiring gets source-inspection Prove-It
 * tests — this repo's established precedent for a `useSession()` client
 * gate with no jsdom/RTL harness for this kind of component
 * (__tests__/cam-397-live-session-gate.test.ts, __tests__/cam-396-*).
 *
 * AC -> test matrix
 * ─────────────────────────────────────────────────────────────────────────────
 * AC-1/BR-1        resume effect: listConversations -> getConversation, once, authed-only
 * AC-2             welcome state still gates on entries.length===0 (now && !resuming)
 * AC-3/BR-4        startNewChat clears conversationId + entries; authed-only button
 * AC-4/BR-5/EC-3   guest path byte-stable: buildOutgoingHistory + aiChatAPI.send unchanged
 * AC-5/EC-1/EC-4   any resume-fetch failure (empty/401/404/500/network) -> graceful fallback
 * AC-6/BR-6/EC-2   restored blocks validated via normalizeBlocks; unknown/malformed -> skip
 * AC-7/BR-5        authed turns post the v2 {conversationId?, message} shape
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import { isAuthedSession, restoreEntriesFromMessages } from "@/components/ai-chat/conversation";
import { aiChatAPI, type AiConversationMessageView } from "@/lib/api-client";

const read = (p: string) => readFileSync(resolve(__dirname, "..", p), "utf-8");

// ---------------------------------------------------------------------------
// isAuthedSession (BR-1) — the ONE place guest-vs-authed is decided
// ---------------------------------------------------------------------------
describe("isAuthedSession (BR-1) — D1: only a resolved authenticated session resumes", () => {
  it("[normal] 'authenticated' -> true", () => expect(isAuthedSession("authenticated")).toBe(true));
  it("[error/validation] 'unauthenticated' -> false (guest, D1)", () =>
    expect(isAuthedSession("unauthenticated")).toBe(false));
  it("[boundary] the transient 'loading' status -> false (never treated as authed)", () =>
    expect(isAuthedSession("loading")).toBe(false));
});

// ---------------------------------------------------------------------------
// restoreEntriesFromMessages (AC-1, AC-6/BR-6/EC-2)
// ---------------------------------------------------------------------------
const msg = (overrides: Partial<AiConversationMessageView> = {}): AiConversationMessageView => ({
  id: "m1",
  role: "USER",
  seq: 1,
  contentText: "หาแคมป์ริมน้ำ",
  blocks: null,
  createdAt: "2026-07-19T00:00:00.000Z",
  ...overrides,
});

describe("restoreEntriesFromMessages (AC-1) — maps persisted history to ChatEntry[]", () => {
  it("[null/empty] an empty history restores to an empty thread", () => {
    expect(restoreEntriesFromMessages([])).toEqual([]);
  });

  it("[normal] USER -> role:'user' entry, contentText carried through verbatim", () => {
    const [entry] = restoreEntriesFromMessages([msg({ role: "USER", contentText: "มีแคมป์ใกล้เขาใหญ่ไหม" })]);
    expect(entry).toMatchObject({ role: "user", text: "มีแคมป์ใกล้เขาใหญ่ไหม" });
  });

  it("[normal] ASSISTANT -> role:'assistant' kind:'answer' entry, text carried through", () => {
    const [entry] = restoreEntriesFromMessages([
      msg({ id: "m2", role: "ASSISTANT", contentText: "นี่คือลานที่แนะนำ" }),
    ]);
    expect(entry).toMatchObject({ role: "assistant", kind: "answer", text: "นี่คือลานที่แนะนำ", cards: [], suggestions: [] });
  });

  it("[normal] alternating USER/ASSISTANT messages restore in the SAME order, each with a unique id", () => {
    const entries = restoreEntriesFromMessages([
      msg({ id: "m1", role: "USER", seq: 1, contentText: "q1" }),
      msg({ id: "m2", role: "ASSISTANT", seq: 2, contentText: "a1" }),
      msg({ id: "m3", role: "USER", seq: 3, contentText: "q2" }),
    ]);
    const texts = entries.map((e) => ("text" in e ? e.text : ""));
    expect(texts).toEqual(["q1", "a1", "q2"]);
    const ids = entries.map((e) => e.id);
    expect(new Set(ids).size).toBe(3); // every restored entry gets its own fresh id
  });

  it("[boundary] a null blocks value never throws (the common case — nothing populates blocks yet, ADR-013 D6)", () => {
    expect(() => restoreEntriesFromMessages([msg({ role: "ASSISTANT", blocks: null })])).not.toThrow();
  });

  it("[error/validation] EC-2: a malformed blocks entry (missing v) never throws; the answer still restores", () => {
    const entries = restoreEntriesFromMessages([
      msg({ role: "ASSISTANT", contentText: "ok", blocks: [{ type: "bad" }] }),
    ]);
    expect(entries[0]).toMatchObject({ kind: "answer", text: "ok", cards: [], suggestions: [] });
  });

  it("[error/validation] EC-2: an unrecognized-but-well-formed block type is skipped, never rendered/thrown", () => {
    const entries = restoreEntriesFromMessages([
      msg({ role: "ASSISTANT", contentText: "ok", blocks: [{ type: "trip_plan_v9_future", v: 1, data: {} }] }),
    ]);
    expect(entries[0]).toMatchObject({ cards: [], suggestions: [] });
  });

  it("[boundary] blocks present but not an array never throws (treated as no blocks)", () => {
    expect(() =>
      restoreEntriesFromMessages([msg({ role: "ASSISTANT", blocks: "not-an-array" })])
    ).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// aiChatAPI.sendTurn (AC-7/BR-5) — the v2 {conversationId?, message} shape
// ---------------------------------------------------------------------------
describe("aiChatAPI.sendTurn (AC-7/BR-5) — v2 request shape, fetch always mocked", () => {
  afterEach(() => vi.unstubAllGlobals());

  function stubFetch(impl: (...args: unknown[]) => Promise<unknown>) {
    vi.stubGlobal("fetch", vi.fn(impl));
  }

  it("[normal] posts { message } with NO conversationId key when omitted (a new conversation)", async () => {
    let sentBody = "";
    stubFetch(async (_url: unknown, init: unknown) => {
      sentBody = (init as { body: string }).body;
      return { ok: true, status: 200, json: async () => ({ answer: "ok", cards: [], conversationId: "c1" }) };
    });
    await aiChatAPI.sendTurn({ message: "หาแคมป์ริมน้ำ" });
    expect(JSON.parse(sentBody)).toEqual({ message: "หาแคมป์ริมน้ำ" });
  });

  it("[normal] posts { conversationId, message } when a conversation is already threaded", async () => {
    let sentBody = "";
    stubFetch(async (_url: unknown, init: unknown) => {
      sentBody = (init as { body: string }).body;
      return { ok: true, status: 200, json: async () => ({ answer: "ok", cards: [] }) };
    });
    await aiChatAPI.sendTurn({ conversationId: "conv-1", message: "q2" });
    expect(JSON.parse(sentBody)).toEqual({ conversationId: "conv-1", message: "q2" });
  });

  it("[normal] a returned conversationId surfaces on the outcome (threads the next turn)", async () => {
    stubFetch(async () => ({ ok: true, status: 200, json: async () => ({ answer: "ok", cards: [], conversationId: "conv-9" }) }));
    const outcome = await aiChatAPI.sendTurn({ message: "q" });
    expect(outcome).toMatchObject({ kind: "ok", conversationId: "conv-9" });
  });

  it("[error/validation] 429/503/other-non-2xx/network-throw map the SAME as the legacy send (BR-5 sibling)", async () => {
    stubFetch(async () => ({ ok: false, status: 429, json: async () => ({}) }));
    expect(await aiChatAPI.sendTurn({ message: "q" })).toEqual({ kind: "rate-limited" });

    stubFetch(async () => ({ ok: false, status: 503, json: async () => ({}) }));
    expect(await aiChatAPI.sendTurn({ message: "q" })).toEqual({ kind: "disabled" });

    stubFetch(async () => ({ ok: false, status: 401, json: async () => ({}) }));
    expect(await aiChatAPI.sendTurn({ message: "q" })).toEqual({ kind: "error" });

    stubFetch(async () => {
      throw new Error("network down");
    });
    expect(await aiChatAPI.sendTurn({ message: "q" })).toEqual({ kind: "error" });
  });

  it("[security] posts to the SAME internal facade route as the legacy guest send — no parallel endpoint", async () => {
    let calledUrl = "";
    stubFetch(async (url: unknown) => {
      calledUrl = String(url);
      return { ok: true, status: 200, json: async () => ({ answer: "ok", cards: [] }) };
    });
    await aiChatAPI.sendTurn({ message: "q" });
    expect(calledUrl).toBe("/api/ai/chat");
  });
});

// ---------------------------------------------------------------------------
// aiChatAPI.listConversations / getConversation (AC-1, EC-1, EC-4)
// ---------------------------------------------------------------------------
describe("aiChatAPI.listConversations / getConversation (AC-1) — fetch always mocked", () => {
  afterEach(() => vi.unstubAllGlobals());

  function stubFetch(impl: (...args: unknown[]) => Promise<unknown>) {
    vi.stubGlobal("fetch", vi.fn(impl));
  }

  it("[normal] listConversations GETs /ai/conversations and passes the body through", async () => {
    let calledUrl = "";
    stubFetch(async (url: unknown) => {
      calledUrl = String(url);
      return { ok: true, json: async () => ({ conversations: [{ id: "c1", title: "t", messageCount: 2, updatedAt: "2026-07-19T00:00:00.000Z" }] }) };
    });
    const result = await aiChatAPI.listConversations();
    expect(calledUrl).toBe("/api/ai/conversations");
    expect(result.data?.conversations).toHaveLength(1);
  });

  it("[error/validation] EC-1: a 401/500 list response resolves to {error}, never throws", async () => {
    stubFetch(async () => ({ ok: false, json: async () => ({ error: "Unauthorized" }) }));
    const result = await aiChatAPI.listConversations();
    expect(result.data).toBeUndefined();
    expect(result.error).toBeTruthy();
  });

  it("[error/validation] EC-1: a genuine network throw (not just a non-2xx status) resolves to {error}, never rejects the promise", async () => {
    stubFetch(async () => {
      throw new Error("network down");
    });
    const result = await aiChatAPI.listConversations();
    expect(result.data).toBeUndefined();
    expect(result.error).toBeTruthy();
  });

  it("[normal] getConversation GETs /ai/conversations/{id}", async () => {
    let calledUrl = "";
    stubFetch(async (url: unknown) => {
      calledUrl = String(url);
      return { ok: true, json: async () => ({ id: "conv-1", updatedAt: "2026-07-19T00:00:00.000Z", messages: [] }) };
    });
    const result = await aiChatAPI.getConversation("conv-1");
    expect(calledUrl).toBe("/api/ai/conversations/conv-1");
    expect(result.data?.id).toBe("conv-1");
  });

  it("[error/validation] EC-4: a 404 (deleted between list + detail) resolves to {error}, never throws", async () => {
    stubFetch(async () => ({ ok: false, json: async () => ({ error: "Conversation not found" }) }));
    const result = await aiChatAPI.getConversation("conv-deleted");
    expect(result.data).toBeUndefined();
    expect(result.error).toBeTruthy();
  });

  it("[error/validation] EC-1: a genuine network throw on the detail fetch resolves to {error}, never rejects", async () => {
    stubFetch(async () => {
      throw new Error("network down");
    });
    const result = await aiChatAPI.getConversation("conv-1");
    expect(result.data).toBeUndefined();
    expect(result.error).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Source-inspection — useSession()-gated wiring (no jsdom/RTL harness for
// this class of component in this repo; precedent: cam-397-live-session-gate)
// ---------------------------------------------------------------------------
const useAiChatSrc = read("components/ai-chat/use-ai-chat.ts");
const panelSrc = read("components/ai-chat/AiChatPanel.tsx");
const listSrc = read("components/ai-chat/AiChatMessageList.tsx");
const apiClientSrc = read("lib/api-client.ts");

describe("BR-1 — the resume effect is authed-only, runs once per open", () => {
  it("[unit] imports useSession from next-auth/react and derives `authed` via isAuthedSession(status)", () => {
    expect(useAiChatSrc).toMatch(/import\s*\{\s*useSession\s*\}\s*from\s*["']next-auth\/react["']/);
    expect(useAiChatSrc).toContain("const authed = isAuthedSession(status);");
  });

  it("[unit] the resume effect guards on `!authed || hasResumedRef.current` before ever calling the API", () => {
    expect(useAiChatSrc).toContain("if (!authed || hasResumedRef.current) return;");
    expect(useAiChatSrc).toContain("hasResumedRef.current = true;");
  });

  it("[unit] resume calls listConversations then getConversation, then restoreEntriesFromMessages", () => {
    const listIdx = useAiChatSrc.indexOf("aiChatAPI.listConversations()");
    const getIdx = useAiChatSrc.indexOf("aiChatAPI.getConversation(");
    const restoreIdx = useAiChatSrc.indexOf("restoreEntriesFromMessages(");
    expect(listIdx).toBeGreaterThan(-1);
    expect(getIdx).toBeGreaterThan(listIdx);
    expect(restoreIdx).toBeGreaterThan(getIdx);
  });
});

describe("AC-5/EC-1/EC-4 — any resume-fetch failure falls back to the fresh welcome state", () => {
  it("[unit] an empty/failed list response sets resuming=false and returns before any detail fetch", () => {
    expect(useAiChatSrc).toContain("if (conversations.length === 0) {");
    expect(useAiChatSrc).toContain("setResuming(false); // EC: no saved conversation (or the list fetch failed) -> stay on the fresh welcome state");
  });

  it("[unit] a failed detail fetch (e.g. EC-4 deleted mid-flight) also falls back gracefully, never throws", () => {
    expect(useAiChatSrc).toContain("if (!detail.data) {");
    expect(useAiChatSrc).toContain("setResuming(false); // EC: detail fetch failed (e.g. deleted between the two calls) -> graceful fallback, never a crash");
  });
});

describe("AC-4/BR-5/EC-3 — guest path stays byte-stable (D1)", () => {
  it("[unit] the guest branch still calls buildOutgoingHistory + aiChatAPI.send (CAM-412: now with a streaming options arg — signal + onDelta — appended, guest call SHAPE otherwise unchanged)", () => {
    expect(useAiChatSrc).toContain("aiChatAPI.send(buildOutgoingHistory(base, questionText), {");
  });

  it("[unit] EC-3: runTurn branches on the LIVE `authed` value (useCallback dep [authed]) — a mid-session logout falls to the guest branch on the NEXT call, never a stale branch", () => {
    const start = useAiChatSrc.indexOf("const runTurn = useCallback(");
    const end = useAiChatSrc.indexOf("[authed]\n  );", start);
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    const body = useAiChatSrc.slice(start, end);
    // CAM-412: restructured from a ternary to an early-return guard (needed
    // room for the guest branch's own streaming-specific logic) — still
    // branches on the SAME live `authed` closure variable, still returns
    // early for the authed/v2 branch before ever reaching the guest path.
    expect(body).toContain("if (authed) {");
    expect(body).toContain("return;");
  });

  it("[unit] pre-existing exported guest functions are untouched call sites (byte-stable): aiChatAPI.send is still present unmodified in the api-client facade", () => {
    expect(apiClientSrc).toContain(
      "body: JSON.stringify({ messages: messages.slice(-AI_CHAT_MAX_MESSAGES) }),"
    );
  });

  it("[unit] the guest send() function body is unchanged from pre-CAM-423 (status mapping untouched)", () => {
    expect(apiClientSrc).toContain("response.status === 429) return { kind: 'rate-limited' }");
    expect(apiClientSrc).toContain("response.status === 503) return { kind: 'disabled' }");
    expect(apiClientSrc).toContain("!response.ok) return { kind: 'error' }");
  });
});

describe("AC-3/BR-4 — startNewChat hook logic (UI entry point hidden by CAM-425, single-thread)", () => {
  it("[unit] startNewChat resets conversationIdRef and entries — kept in the hook, exported-but-unreferenced (a later conversation switcher reuses it)", () => {
    expect(useAiChatSrc).toContain("const startNewChat = useCallback(() => {");
    expect(useAiChatSrc).toContain("conversationIdRef.current = undefined;");
    expect(useAiChatSrc).toContain("setEntries([]);");
  });

  // CAM-425 supersedes the CAM-423 new-chat button render — see
  // cam-425-single-thread-and-centered-loading.test.ts for the absence assertions.
});

describe("AC-1/AC-2/BR-3 — resuming indicator: loading.md indicator, never a new skeleton", () => {
  it("[unit] AiChatMessageList accepts + forwards a `resuming` prop from the panel", () => {
    expect(panelSrc).toContain("resuming={resuming}");
    expect(listSrc).toContain("resuming: boolean");
  });

  it("[unit] the welcome state now also gates on !resuming (no flash before the restored thread renders)", () => {
    expect(listSrc).toContain("{!resuming && entries.length === 0 && (");
  });

  it("[unit] the resuming indicator renders (data-testid present) — CAM-425 replaced the bare LoadingSpinner with a centered avatar treatment, see cam-425 test file", () => {
    expect(listSrc).toContain('data-testid="status--ai-chat-resuming"');
  });

  it("[unit] a11y: the resuming region carries its own aria-busy + role=status/aria-live=polite + the loading label (loading.md §5); the outer log's aria-busy stays tied to `sending` (unchanged)", () => {
    expect(listSrc).toContain("aria-busy={sending}");
    expect(listSrc).toContain("aria-busy={resuming}");
    expect(listSrc).toContain('role="status"');
    expect(listSrc).toContain("{t.aiChat.loading}");
  });

  it("[unit] the composer's canSend gate also blocks sending while resuming (no message during an in-flight resume)", () => {
    expect(panelSrc).toContain("!sending && !disabled && !resuming && isSendableQuestion(draft)");
  });

  it("[unit] BR-3: the welcome-state suggestion pills are also gated on `resuming` (tapping one during an in-flight resume no-ops)", () => {
    expect(panelSrc).toContain("if (sending || disabled || resuming) return;");
  });
});

// ---------------------------------------------------------------------------
// i18n — aiChat.newChat (TH verbatim + EN, per qa.md/DESIGN.md copy rules)
// ---------------------------------------------------------------------------
describe("locales/translations.json — aiChat.newChat (CAM-423)", () => {
  it("TH copy verbatim", async () => {
    const translations = (await import("../locales/translations.json")).default;
    expect(translations.th.aiChat.newChat).toBe("เริ่มแชทใหม่");
  });

  it("EN copy present, non-empty", async () => {
    const translations = (await import("../locales/translations.json")).default;
    expect(translations.en.aiChat.newChat).toBe("Start new chat");
  });
});

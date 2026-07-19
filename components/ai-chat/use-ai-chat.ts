"use client";

/**
 * components/ai-chat/use-ai-chat.ts — CAM-272 (session resume: CAM-423, ADR-013 S9)
 *
 * Client glue between the pure conversation state machine (conversation.ts)
 * and the `lib/api-client` facade. BR-3: this hook is the ONLY place that
 * calls `aiChatAPI.send`/`sendTurn` — the panel/composer components never
 * touch `fetch` directly, and neither ever imports the model/OpenRouter
 * client.
 *
 * CAM-423 session branch (D1: guest stays stateless, byte-stable):
 *  - guest (`isAuthedSession(status)` false) — `buildOutgoingHistory` +
 *    `aiChatAPI.send` (legacy `{messages}` body), nothing ever loaded or
 *    persisted. CAM-412: this is the ONLY path that streams (guest Discover
 *    funnel scope, ADR-015) — a transient `kind:"streaming"` entry grows via
 *    `onDelta` and settles into the normal `kind:"answer"` entry once the
 *    turn resolves; a client-supported-but-server-fallback turn (or the
 *    server's own pre-delta JSON fallback) resolves identically either way.
 *  - authed — on first open, loads the camper's latest conversation
 *    (`aiChatAPI.listConversations` -> `aiChatAPI.getConversation`) and
 *    restores it via `restoreEntriesFromMessages`; every history-fetch
 *    failure (no conversations, a 401/404/500, or a network error) falls
 *    back to the fresh welcome state, never a crash (EC). Sends thread
 *    through the v2 shape (`aiChatAPI.sendTurn({conversationId, message})`);
 *    the returned `conversationId` (new or unchanged) threads the next turn.
 *    This path never streams (ADR-015 scope note — the persisted/tiered v2
 *    route branch does not honor `Accept: text/event-stream`).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { aiChatAPI } from "@/lib/api-client";
import {
  appendOutcome,
  appendOrStartStreamingDelta,
  appendUserQuestion,
  buildOutgoingHistory,
  entriesBeforeRetry,
  isAssistantDisabled,
  isAuthedSession,
  isSendableQuestion,
  replaceStreamingWithOutcome,
  restoreEntriesFromMessages,
  type ChatEntry,
} from "@/components/ai-chat/conversation";

export interface UseAiChatResult {
  entries: ChatEntry[];
  /** True while a turn is in flight — gates the composer/send + shows the typing indicator (BR-3). */
  sending: boolean;
  /** True once the assistant has been seen disabled this session — composer stays disabled (EC-4). */
  disabled: boolean;
  /** CAM-423 — true while the camper's latest conversation is being fetched on open; loading.md's inline indicator, never a skeleton. */
  resuming: boolean;
  /** CAM-423 — true for a signed-in camper (gates the "เริ่มแชทใหม่" control; guest UI is unaffected). */
  isAuthenticated: boolean;
  sendMessage: (text: string) => Promise<void>;
  retryLast: () => Promise<void>;
  /** CAM-423 — 'เริ่มแชทใหม่': clears the thread + conversationId; the next authed send creates a fresh conversation. */
  startNewChat: () => void;
  /** CAM-412 (BR-6/AC-7/EC-6) — aborts the in-flight guest stream, if any; a no-op otherwise (idempotent). Called by AiChatPanel on close. */
  abortActiveStream: () => void;
}

export function useAiChat(): UseAiChatResult {
  const { status } = useSession();
  const authed = isAuthedSession(status);
  const [entries, setEntries] = useState<ChatEntry[]>([]);
  const [sending, setSending] = useState(false);
  const [resuming, setResuming] = useState(false);
  const conversationIdRef = useRef<string | undefined>(undefined);
  const hasResumedRef = useRef(false);
  /** CAM-412 BR-6 — the guest stream's own AbortController, live only while a guest turn is in flight. */
  const streamAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!authed || hasResumedRef.current) return;
    hasResumedRef.current = true;

    (async () => {
      setResuming(true);
      const list = await aiChatAPI.listConversations();
      const conversations = list.data?.conversations ?? [];
      if (conversations.length === 0) {
        setResuming(false); // EC: no saved conversation (or the list fetch failed) -> stay on the fresh welcome state
        return;
      }
      const detail = await aiChatAPI.getConversation(conversations[0].id);
      if (!detail.data) {
        setResuming(false); // EC: detail fetch failed (e.g. deleted between the two calls) -> graceful fallback, never a crash
        return;
      }
      conversationIdRef.current = detail.data.id;
      setEntries(restoreEntriesFromMessages(detail.data.messages));
      setResuming(false);
    })();
  }, [authed]);

  const runTurn = useCallback(
    async (base: ChatEntry[], questionText: string) => {
      setSending(true);

      if (authed) {
        // v2 (session-bound, persisted) — unchanged, never streams (ADR-015).
        const outcome = await aiChatAPI.sendTurn({ conversationId: conversationIdRef.current, message: questionText });
        if (outcome.kind === "ok" && outcome.conversationId) {
          conversationIdRef.current = outcome.conversationId;
        }
        setEntries(appendOutcome(base, outcome, questionText));
        setSending(false);
        return;
      }

      // Guest — streaming-capable path (BR-1..BR-8). The in-flight guard
      // (`sending`) already covers the whole call below (BR-7).
      const controller = new AbortController();
      streamAbortRef.current = controller;

      const outcome = await aiChatAPI.send(buildOutgoingHistory(base, questionText), {
        signal: controller.signal,
        onDelta: (text) => setEntries((prev) => appendOrStartStreamingDelta(prev, text)),
      });

      streamAbortRef.current = null;
      // AC-7/EC-6 — `outcome.kind === "aborted"` falls through `appendOutcome`'s
      // `default` (a no-op) here, so an aborted turn just discards the
      // partial streaming entry silently, no error notice.
      setEntries((prev) => replaceStreamingWithOutcome(prev, outcome, questionText));
      setSending(false);
    },
    [authed]
  );

  const sendMessage = useCallback(
    async (text: string) => {
      if (sending || !isSendableQuestion(text)) return; // BR-6/EC-1
      const withUser = appendUserQuestion(entries, text);
      setEntries(withUser);
      await runTurn(withUser, text);
    },
    [entries, sending, runTurn]
  );

  const retryLast = useCallback(async () => {
    if (sending) return;
    const last = entries[entries.length - 1];
    if (!last || last.role !== "assistant" || last.kind !== "error") return;
    const question = last.retryQuestion;
    const base = entriesBeforeRetry(entries);
    setEntries(base);
    await runTurn(base, question);
  }, [entries, sending, runTurn]);

  const startNewChat = useCallback(() => {
    conversationIdRef.current = undefined;
    setEntries([]);
  }, []);

  /** CAM-412 BR-6 — idempotent: aborting an already-settled/absent controller is a safe no-op. */
  const abortActiveStream = useCallback(() => {
    streamAbortRef.current?.abort();
  }, []);

  return {
    entries,
    sending,
    disabled: isAssistantDisabled(entries),
    resuming,
    isAuthenticated: authed,
    sendMessage,
    retryLast,
    startNewChat,
    abortActiveStream,
  };
}

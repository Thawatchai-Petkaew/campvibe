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
 *  - guest (`isAuthedSession(status)` false) — UNCHANGED: `buildOutgoingHistory`
 *    + `aiChatAPI.send` (legacy `{messages}` body), nothing ever loaded or
 *    persisted.
 *  - authed — on first open, loads the camper's latest conversation
 *    (`aiChatAPI.listConversations` -> `aiChatAPI.getConversation`) and
 *    restores it via `restoreEntriesFromMessages`; every history-fetch
 *    failure (no conversations, a 401/404/500, or a network error) falls
 *    back to the fresh welcome state, never a crash (EC). Sends thread
 *    through the v2 shape (`aiChatAPI.sendTurn({conversationId, message})`);
 *    the returned `conversationId` (new or unchanged) threads the next turn.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { aiChatAPI } from "@/lib/api-client";
import {
  appendOutcome,
  appendUserQuestion,
  buildOutgoingHistory,
  entriesBeforeRetry,
  isAssistantDisabled,
  isAuthedSession,
  isSendableQuestion,
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
}

export function useAiChat(): UseAiChatResult {
  const { status } = useSession();
  const authed = isAuthedSession(status);
  const [entries, setEntries] = useState<ChatEntry[]>([]);
  const [sending, setSending] = useState(false);
  const [resuming, setResuming] = useState(false);
  const conversationIdRef = useRef<string | undefined>(undefined);
  const hasResumedRef = useRef(false);

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
      const outcome = authed
        ? await aiChatAPI.sendTurn({ conversationId: conversationIdRef.current, message: questionText })
        : await aiChatAPI.send(buildOutgoingHistory(base, questionText));
      if (outcome.kind === "ok" && outcome.conversationId) {
        conversationIdRef.current = outcome.conversationId;
      }
      setEntries(appendOutcome(base, outcome, questionText));
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

  return {
    entries,
    sending,
    disabled: isAssistantDisabled(entries),
    resuming,
    isAuthenticated: authed,
    sendMessage,
    retryLast,
    startNewChat,
  };
}

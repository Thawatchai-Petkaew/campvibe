"use client";

/**
 * components/ai-chat/use-ai-chat.ts — CAM-272
 *
 * Client glue between the pure conversation state machine (conversation.ts)
 * and the `lib/api-client` facade. BR-3: this hook is the ONLY place that
 * calls `aiChatAPI.send` — the panel/composer components never touch
 * `fetch` directly, and neither ever imports the model/OpenRouter client.
 */
import { useCallback, useState } from "react";
import { aiChatAPI } from "@/lib/api-client";
import {
  appendOutcome,
  appendUserQuestion,
  buildOutgoingHistory,
  entriesBeforeRetry,
  isAssistantDisabled,
  isSendableQuestion,
  type ChatEntry,
} from "@/components/ai-chat/conversation";

export interface UseAiChatResult {
  entries: ChatEntry[];
  /** True while a turn is in flight — gates the composer/send + shows the typing indicator (BR-3). */
  sending: boolean;
  /** True once the assistant has been seen disabled this session — composer stays disabled (EC-4). */
  disabled: boolean;
  sendMessage: (text: string) => Promise<void>;
  retryLast: () => Promise<void>;
}

export function useAiChat(): UseAiChatResult {
  const [entries, setEntries] = useState<ChatEntry[]>([]);
  const [sending, setSending] = useState(false);

  const runTurn = useCallback(async (base: ChatEntry[], questionText: string) => {
    setSending(true);
    const history = buildOutgoingHistory(base, questionText);
    const outcome = await aiChatAPI.send(history);
    setEntries(appendOutcome(base, outcome, questionText));
    setSending(false);
  }, []);

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

  return { entries, sending, disabled: isAssistantDisabled(entries), sendMessage, retryLast };
}

/**
 * components/ai-chat/conversation.ts — CAM-272
 *
 * Pure, framework-free conversation state machine for the AI chat panel.
 * Kept separate from `use-ai-chat.ts` (the "use client" glue) so the real
 * transition logic is unit-testable directly (repo convention — see
 * lib/hooks/use-modal-a11y.ts's pure helpers + __tests__/cam-368-*).
 *
 * BR-4 (Critical): an assistant `answer` is always rendered as data (plain
 * text), never HTML — nothing here ever builds/returns markup, only plain
 * strings + the structured `cards[]` array from the endpoint response.
 */
import type { AiChatCardResponse, AiChatOutcome, AiChatRequestMessage } from "@/lib/api-client";
import { AI_CHAT_MAX_MESSAGES } from "@/lib/api-client";

export type ChatEntry =
  | { id: string; role: "user"; text: string }
  | { id: string; role: "assistant"; kind: "answer"; text: string; cards: AiChatCardResponse[]; zeroResult: boolean }
  | { id: string; role: "assistant"; kind: "rate-limited" }
  | { id: string; role: "assistant"; kind: "disabled" }
  | { id: string; role: "assistant"; kind: "error"; retryQuestion: string };

let seq = 0;
/** Monotonic id generator — stable React `key`s, no dependency on `crypto.randomUUID` (jsdom-less test env). */
export function nextEntryId(): string {
  seq += 1;
  return `ai-chat-entry-${seq}`;
}

/** BR-6: a whitespace-only (or empty) question is never sent. */
export function isSendableQuestion(text: string): boolean {
  return text.trim().length > 0;
}

/**
 * The recent thread, mapped to the wire shape + capped to the endpoint's
 * documented limit (AI_CHAT_MAX_MESSAGES) — oldest entries dropped first.
 * Notice-only assistant turns (rate-limited/disabled/error) carry no
 * displayable text and are excluded from the outgoing history.
 */
export function buildOutgoingHistory(entries: ChatEntry[], newQuestion: string): AiChatRequestMessage[] {
  const history: AiChatRequestMessage[] = [];
  for (const entry of entries) {
    if (entry.role === "user") {
      history.push({ role: "user", content: entry.text });
    } else if (entry.kind === "answer") {
      history.push({ role: "assistant", content: entry.text });
    }
  }
  history.push({ role: "user", content: newQuestion });
  return history.slice(-AI_CHAT_MAX_MESSAGES);
}

/** Appends the user's question as a new entry. */
export function appendUserQuestion(entries: ChatEntry[], text: string): ChatEntry[] {
  return [...entries, { id: nextEntryId(), role: "user", text }];
}

/** AC-2/AC-4/AC-5/AC-6/AC-7 + BR-5: maps one API outcome to the next entries list. */
export function appendOutcome(entries: ChatEntry[], outcome: AiChatOutcome, questionText: string): ChatEntry[] {
  switch (outcome.kind) {
    case "ok":
      return [
        ...entries,
        {
          id: nextEntryId(),
          role: "assistant",
          kind: "answer",
          text: outcome.answer,
          cards: outcome.cards,
          zeroResult: outcome.cards.length === 0,
        },
      ];
    case "rate-limited":
      return [...entries, { id: nextEntryId(), role: "assistant", kind: "rate-limited" }];
    case "disabled":
      return [...entries, { id: nextEntryId(), role: "assistant", kind: "disabled" }];
    case "error":
      return [...entries, { id: nextEntryId(), role: "assistant", kind: "error", retryQuestion: questionText }];
    default:
      return entries;
  }
}

/** AC-5: `ลองใหม่` removes the trailing error notice before the question is resent (no duplicate user bubble). */
export function entriesBeforeRetry(entries: ChatEntry[]): ChatEntry[] {
  const last = entries[entries.length - 1];
  if (last && last.role === "assistant" && last.kind === "error") {
    return entries.slice(0, -1);
  }
  return entries;
}

/** BR-5/EC-4: once the assistant is seen disabled, the composer stays disabled for the rest of the session. */
export function isAssistantDisabled(entries: ChatEntry[]): boolean {
  return entries.some((e) => e.role === "assistant" && e.kind === "disabled");
}

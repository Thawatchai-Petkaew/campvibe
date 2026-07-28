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
 *
 * CAM-639 (epic CAM-630, in-chat guided booking) added the `kind:"booking"`
 * `ChatEntry` arm below — presentation + entry-type only, nothing in this
 * file constructs one yet. See that union member's own doc comment for the
 * two invariants (`buildOutgoingHistory` exclusion, `restoreEntriesFromMessages`
 * never resurrecting one) this file must keep holding.
 */
import type { AiChatCardResponse, AiChatOutcome, AiChatRequestMessage, AiConversationMessageView } from "@/lib/api-client";
import { AI_CHAT_MAX_MESSAGES, extractCardsBlock, normalizeBlocks } from "@/lib/api-client";
import type { BookingStepId } from "@/components/ai-chat/booking-flow";
import type { BookingStepView } from "@/components/ai-chat/AiChatBookingStep";

export type ChatEntry =
  | { id: string; role: "user"; text: string }
  | {
      id: string;
      role: "assistant";
      kind: "answer";
      text: string;
      cards: AiChatCardResponse[];
      zeroResult: boolean;
      /** CAM-410 AC-1/AC-4 — 0-3 sanitized follow-up-question chips for THIS answer only; optional on the type (a fixture built before CAM-410 still compiles) but `appendOutcome` always populates a concrete array (`[]` when the turn produced none). */
      suggestions?: string[];
    }
  | { id: string; role: "assistant"; kind: "rate-limited" }
  | { id: string; role: "assistant"; kind: "disabled" }
  | { id: string; role: "assistant"; kind: "error"; retryQuestion: string }
  /**
   * CAM-412 — a transient, in-flight streaming answer: grows as `delta`
   * events arrive, then is REPLACED (never both shown) by a settled
   * `kind:"answer"` entry once the turn's `meta`/`error` outcome resolves
   * (`replaceStreamingWithOutcome` below). Never persisted, never sent back
   * as history (`buildOutgoingHistory` only ever reads settled entries).
   */
  | { id: string; role: "assistant"; kind: "streaming"; text: string }
  /**
   * CAM-639 (epic CAM-630, in-chat guided booking) — one turn of the guided
   * booking flow (`booking-flow.ts`, CAM-633), rendered inline in the
   * transcript via the CAM-638 presentation (`AiChatBookingStep`).
   * PRESENTATION + ENTRY TYPE ONLY: nothing constructs this entry yet — no
   * `appendX` helper exists here and `use-ai-chat.ts` never imports this
   * `kind`. CAM-640 wires `advanceBookingFlow` in and starts producing these.
   *
   * `view` is an IMMUTABLE SNAPSHOT of the flow's presentation at the moment
   * this turn was appended — the SAME discipline `zeroResult` above already
   * uses on the `answer` entry: a live-turn-only signal recorded once, never
   * re-derived from a later, possibly-newer flow state. Scrollback must
   * never re-render a booking turn with newer slots (a stale card showing
   * yesterday's price/availability would be worse than showing nothing).
   * `step` rides alongside it as a stable identity for the turn, typed via
   * the registry-derived `BookingStepId` (`booking-flow.ts`'s own header
   * rule: no hand-copied step-id list anywhere).
   *
   * Two invariants this kind must never break, each pinned by a test in
   * `__tests__/cam-639-*`:
   *   - `buildOutgoingHistory` below already excludes it structurally — its
   *     `kind` is neither `"user"` nor `"answer"`. If booking copy ever
   *     reached model history, the model would start believing it produced
   *     a booking — the ADV-40 guardrail arriving through the back door.
   *   - `restoreEntriesFromMessages` never produces this kind — a resumed
   *     conversation shows the text but no live interactive block, because a
   *     restored flow would carry stale prices/availability.
   */
  | { id: string; role: "assistant"; kind: "booking"; step: BookingStepId; view: BookingStepView };

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
 * displayable text and are excluded from the outgoing history. CAM-639: a
 * `kind:"booking"` entry is excluded the SAME way — it matches neither
 * `role === "user"` nor `kind === "answer"` below, so no code change was
 * needed to keep it out of model history (see the `booking` union member's
 * own doc comment for why that must never change).
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
          // CAM-430: the "no match, refine your search" banner is a search-
          // specific failure state — it must NOT fire for a greeting/FAQ/
          // general-chat answer that legitimately has 0 cards. Gate on the
          // server's `searchAttempted` signal (was `searchCampsites` really
          // dispatched this turn) AND an empty result, never on
          // `cards.length === 0` alone.
          zeroResult: outcome.searchAttempted === true && outcome.cards.length === 0,
          // CAM-410 AC-4: always a concrete array on the entry, even when the
          // wire/outcome carried no `suggestions` key at all (BR-1 "absent
          // means no chips").
          suggestions: outcome.suggestions ?? [],
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

/**
 * CAM-412 AC-1 — appends one cleaned text delta to the in-flight streaming
 * entry, CREATING it on the first delta (pure/idempotent: derives everything
 * from `entries` itself, so a React Strict Mode double-invoked updater can
 * never create two placeholder entries for one turn).
 */
export function appendOrStartStreamingDelta(entries: ChatEntry[], delta: string): ChatEntry[] {
  const last = entries[entries.length - 1];
  if (last && last.role === "assistant" && last.kind === "streaming") {
    return [...entries.slice(0, -1), { ...last, text: last.text + delta }];
  }
  return [...entries, { id: nextEntryId(), role: "assistant", kind: "streaming", text: delta }];
}

/**
 * CAM-412 AC-1/AC-4 — settles the turn: drops the transient streaming entry
 * (if one exists — a zero-delta answer or a pre-first-delta JSON-fallback
 * turn never created one) and appends the final outcome via the SAME
 * `appendOutcome` every non-streaming turn already uses (no parallel finalize
 * path). AC-4: a mid-stream `error` outcome discards the partial answer this
 * way too — `entries.slice(0, -1)` drops it before the error entry is added.
 * CAM-639: the drop condition checks `last.kind === "streaming"` only, so a
 * trailing `kind:"booking"` entry never matches it and always falls through
 * to `appendOutcome`'s append — this function must not be changed to swallow
 * it.
 */
export function replaceStreamingWithOutcome(
  entries: ChatEntry[],
  outcome: AiChatOutcome,
  questionText: string
): ChatEntry[] {
  const last = entries[entries.length - 1];
  const base = last && last.role === "assistant" && last.kind === "streaming" ? entries.slice(0, -1) : entries;
  return appendOutcome(base, outcome, questionText);
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

/**
 * CAM-423 (ADR-013 S9) — the ONLY place `use-ai-chat.ts` decides guest vs
 * authed-resume branching, kept as a pure/testable predicate rather than an
 * inline session check scattered across the hook (D1: a guest session never
 * resumes/persists — this returns false for every status but `authenticated`,
 * including the transient NextAuth `loading` status).
 */
export function isAuthedSession(status: "loading" | "authenticated" | "unauthenticated"): boolean {
  return status === "authenticated";
}

/**
 * CAM-423 AC — restores a persisted conversation's ascending-order messages
 * (`GET /api/ai/conversations/[id]`) into the SAME `ChatEntry[]` shape a live
 * thread already renders through `AiChatMessageList`, so resume reuses the
 * existing renderers with no parallel display path.
 *
 * `blocks` is validated through the exported `normalizeBlocks` — the SAME
 * normalizer a live turn's wire response already uses (one normalizer, not a
 * parallel one) — so a malformed/unexpected `blocks` payload can never crash
 * a resume. A well-formed 'cards' block (CAM-445: now persisted by
 * `POST /api/ai/chat`'s v2 path) is mapped back into `entry.cards` via
 * `extractCardsBlock`, which RE-VALIDATES each card through
 * `isAiChatCardResponse` before it is trusted (stored JSON is an input
 * boundary, code.md CAM-305) — a malformed card is dropped, never thrown,
 * and `entry.cards` is the ONLY source the renderer reads (never parsed back
 * out of `contentText`, BR-4/CAM-439). An older message with no cards block
 * (or an unrecognized/absent block type) resolves to `cards: []`, same as
 * before this fix.
 *
 * `suggestions` stays `[]` on every restored answer — CAM-445 scoped the fix
 * to the reported symptoms (structure/cards/banner); follow-up-question
 * chips are not persisted and remain out of scope here.
 *
 * CAM-639: this function has no branch that ever produces a
 * `kind:"booking"` entry — every non-`USER` message restores as a plain
 * `kind:"answer"` entry, same as before this ticket. A resumed conversation
 * therefore shows the assistant's TEXT for a past booking turn but never a
 * live interactive step block — the flow's slots (prices, availability) are
 * never persisted, so resurrecting the block would show stale data.
 */
export function restoreEntriesFromMessages(messages: AiConversationMessageView[]): ChatEntry[] {
  return messages.map((message) => {
    if (message.role === "USER") {
      return { id: nextEntryId(), role: "user", text: message.contentText };
    }
    const blocks = normalizeBlocks(message.blocks);
    return {
      id: nextEntryId(),
      role: "assistant",
      kind: "answer",
      text: message.contentText,
      cards: extractCardsBlock(blocks),
      // CAM-445 (R3 owner feedback) — `zeroResult` is a LIVE-TURN-ONLY
      // search-failure signal (computed in `appendOutcome` from that turn's
      // own `searchAttempted` + `cards` result) and is never persisted; it
      // must NEVER be re-derived on restore (a restored `cards.length===0`
      // does not mean the original turn ran a search that came back empty —
      // it may never have searched at all). Always `false` here so the
      // "ยังไม่เจอที่ถูกใจเลย…" banner never falsely re-appears on a reopened
      // conversation.
      zeroResult: false,
      suggestions: [],
    };
  });
}

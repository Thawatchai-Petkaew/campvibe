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
 *
 * CAM-640 (epic CAM-630, in-chat guided booking) — holds the live
 * `BookingSession` in a ref (`bookingRef`, NEVER React state — a booking
 * turn resolves synchronously and is never itself "in flight", so there is
 * nothing to re-render on between the ref write and the `setEntries` call
 * right after it). `sendMessage`'s booking intercept sits AFTER the existing
 * `if (sending || !isSendableQuestion(text)) return;` guard (unchanged,
 * first) — never before it, or a chip tap arriving mid-stream could create a
 * booking entry that a still-in-flight guest turn's deltas then append onto.
 * Every actual state transition lives in the pure `booking-turn.ts` module;
 * this file only holds the ref and applies each call's `{entries, booking}`
 * result — see that file's header for why this split makes "the composer is
 * never disabled during a booking turn" structural rather than a rule to
 * remember.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { aiChatAPI } from "@/lib/api-client";
import { useLanguage } from "@/contexts/LanguageContext";
import { currentStep, type BookingStepId } from "@/components/ai-chat/booking-flow";
import {
  processBookingCancel,
  processBookingControl,
  processBookingTurn,
  startBookingTurn,
  type BookingSession,
} from "@/components/ai-chat/booking-turn";
import { addOneDayIso, formatDateEcho, formatGuestsEcho, type BookingCampContext } from "@/components/ai-chat/booking-view";
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
  /** CAM-640 — "เริ่มจอง" tapped (`AiChatDetailCard`): starts a fresh booking flow for `camp`. */
  startBookingFlow: (camp: BookingCampContext) => void;
  /** CAM-640 — a booking-step chip tap (date or guests, per the CURRENT step). */
  onBookingChipSelect: (value: string) => void;
  /** CAM-640 — `ย้อนกลับ` (guests -> date). */
  onBookingBack: (toStep: BookingStepId) => void;
  /** CAM-640 — `แก้วัน` (summary -> date). */
  onBookingEditDate: () => void;
  /** CAM-640 — `แก้จำนวนคน` (summary -> guests). */
  onBookingEditGuests: () => void;
  /** CAM-640 — `ยกเลิกการจอง`, from any step. */
  onBookingCancel: () => void;
}

export function useAiChat(): UseAiChatResult {
  const { status } = useSession();
  const authed = isAuthedSession(status);
  const { t, language } = useLanguage();
  const [entries, setEntries] = useState<ChatEntry[]>([]);
  const [sending, setSending] = useState(false);
  const [resuming, setResuming] = useState(false);
  const conversationIdRef = useRef<string | undefined>(undefined);
  const hasResumedRef = useRef(false);
  /** CAM-412 BR-6 — the guest stream's own AbortController, live only while a guest turn is in flight. */
  const streamAbortRef = useRef<AbortController | null>(null);
  /** CAM-640 — the live booking flow, `null` when no flow is active. React STATE never holds this (see file header) — only `sendMessage`'s branch and the handlers below ever read/write it. */
  const bookingRef = useRef<BookingSession | null>(null);

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
      if (sending || !isSendableQuestion(text)) return; // BR-6/EC-1 (unchanged, first)
      if (bookingRef.current) {
        // CAM-640 — a booking turn resolves LOCALLY, no network call: never
        // touches `sending` (the composer must stay live throughout, design
        // brief §4 "E"). Typed input goes through the SAME `processBookingTurn`
        // a chip tap uses, so it is validated identically (booking-flow.ts's
        // own parse/accept split).
        const result = processBookingTurn(entries, bookingRef.current, { kind: "text", text }, text, t, language, new Date());
        bookingRef.current = result.booking;
        setEntries(result.entries);
        return;
      }
      const withUser = appendUserQuestion(entries, text);
      setEntries(withUser);
      await runTurn(withUser, text);
    },
    [entries, sending, runTurn, t, language]
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

  // ---------------------------------------------------------------------------
  // CAM-640 — booking-flow handlers. Each one calls the pure booking-turn.ts
  // reducer, applies its `{entries, booking}` result, and never touches
  // `sending` (see file header).
  // ---------------------------------------------------------------------------

  const startBookingFlow = useCallback(
    (camp: BookingCampContext) => {
      const result = startBookingTurn(entries, camp, t, language);
      bookingRef.current = result.booking;
      setEntries(result.entries);
    },
    [entries, t, language]
  );

  const onBookingChipSelect = useCallback(
    (value: string) => {
      const session = bookingRef.current;
      if (!session) return;
      const step = currentStep(session.state.slots).id;
      if (step === "date") {
        const result = processBookingTurn(
          entries,
          session,
          { kind: "chip", slots: { checkIn: value, checkOut: addOneDayIso(value) } },
          formatDateEcho(value, session.camp, t, language),
          t,
          language,
          new Date()
        );
        bookingRef.current = result.booking;
        setEntries(result.entries);
      } else if (step === "guests") {
        const guests = Number(value);
        const result = processBookingTurn(
          entries,
          session,
          { kind: "chip", slots: { guests } },
          formatGuestsEcho(guests, t),
          t,
          language,
          new Date()
        );
        bookingRef.current = result.booking;
        setEntries(result.entries);
      }
    },
    [entries, t, language]
  );

  const onBookingBack = useCallback(
    (toStep: BookingStepId) => {
      const session = bookingRef.current;
      if (!session) return;
      const result = processBookingControl(entries, session, toStep, t, language);
      bookingRef.current = result.booking;
      setEntries(result.entries);
    },
    [entries, t, language]
  );

  const onBookingEditDate = useCallback(() => onBookingBack("date"), [onBookingBack]);
  const onBookingEditGuests = useCallback(() => onBookingBack("guests"), [onBookingBack]);

  const onBookingCancel = useCallback(() => {
    if (!bookingRef.current) return;
    const result = processBookingCancel(entries, t);
    bookingRef.current = result.booking;
    setEntries(result.entries);
  }, [entries, t]);

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
    startBookingFlow,
    onBookingChipSelect,
    onBookingBack,
    onBookingEditDate,
    onBookingEditGuests,
    onBookingCancel,
  };
}

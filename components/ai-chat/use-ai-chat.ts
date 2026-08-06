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
 *
 * CAM-702 (ADR-018) — `onBookingConfirm` is the ONE async booking-flow
 * handler that reaches `bookingAPI.create`, and it NEVER touches `sending`
 * either (the same rule, extended: a write in flight is not a `sendMessage`
 * turn, and disabling the composer to protect a one-second write would break
 * the panel's core promise for the one second the camper is most likely to
 * want to ask something — design brief §6). Three independent guards stop a
 * double-POST: (1) `bookingSubmitInFlightRef`, a synchronous ref check at
 * the very top of `onBookingConfirm`/`onBookingCheckAndRetry`, set BEFORE
 * the first `await`; (2) `startBookingSubmit` (booking-turn.ts) supersedes
 * the prior summary's `isCurrent`, so its confirm control renders real
 * `disabled`; (3) the rendered `submitting` view carries no `onClick` at all
 * on its own confirm button (`AiChatBookingStep.tsx`, CAM-701). The actual
 * POST + outcome branching is `submitBookingWrite` (booking-turn.ts) — this
 * hook's job is only to guard, apply `startBookingSubmit`'s result, call it
 * with `bookingAPI.create`/`bookingAPI.list` injected, and apply the result.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { aiChatAPI, bookingAPI, campSiteAvailabilityAPI } from "@/lib/api-client";
import { useLanguage } from "@/contexts/LanguageContext";
import { currentStep, type BookingFlowInput, type BookingSlots, type BookingStepId } from "@/components/ai-chat/booking-flow";
import {
  findJustCreatedBooking,
  processBookingCancel,
  processBookingControl,
  processBookingTurn,
  resolveBookingSubmitSuccess,
  resolveSpotSelection,
  resolveSpotStep,
  resolveSummaryCheck,
  startBookingSubmit,
  startBookingTurn,
  submitBookingWrite,
  type BookingSession,
  type BookingTurnResult,
  type RemainingCapacityFetchOutcome,
  type SpotFetchOutcome,
} from "@/components/ai-chat/booking-turn";
import { addOneDayIso, formatDateEcho, formatGuestsEcho, formatNightsEcho, formatSpotEcho, type BookingCampContext } from "@/components/ai-chat/booking-view";
import type { BookingCheckFailedView } from "@/components/ai-chat/AiChatBookingStep";
import {
  appendBookingEntry,
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

/**
 * CAM-700 — the `resolveSpotStep`/`resolveSpotSelection` injection point:
 * raw `/spots` fetch + guest-capacity filter (cheapest-first, the caller's
 * job per `booking-turn.ts`'s own doc), NEVER `/spots` occupancy itself —
 * that stays per-selection (`aiChatAPI.checkSpotAvailability`, passed
 * straight through, matching its own signature exactly).
 */
async function fetchSpotsForFlow(campId: string, guests: number): Promise<SpotFetchOutcome> {
  const spots = await aiChatAPI.getCampSpots(campId);
  if (!spots || spots.length === 0) return { ok: false };
  const candidates = spots
    .filter((s) => s.maxCampers === null || s.maxCampers >= guests)
    .map((s) => ({ id: s.id, name: s.name, pricePerNight: s.pricePerNight }))
    .sort((a, b) => a.pricePerNight - b.pricePerNight);
  return { ok: true, candidates };
}

/**
 * CAM-647 — the `resolveSummaryCheck` injection point: the ONE
 * GET remaining-capacity call for the chosen span, right before a summary
 * ever renders. `ok:false` covers BOTH a network/HTTP failure and an
 * off-contract body — `resolveSummaryCheck` treats either the same way
 * (E3, never a silent "assume it's fine").
 */
async function checkRemainingCapacityForFlow(campId: string, startDate: string, endDate: string): Promise<RemainingCapacityFetchOutcome> {
  const result = await campSiteAvailabilityAPI.getRemainingCapacity(campId, startDate, endDate);
  if (!result.data) return { ok: false };
  return { ok: true, remaining: result.data.remaining, blockedByHost: result.data.blockedByHost };
}

// ---------------------------------------------------------------------------
// CAM-703 (ADR-018 D2) — the guest login gate's Google-redirect round-trip.
// `signIn("google", …)` (lib/actions.ts) throws a real Next.js redirect —
// a FULL page navigation that destroys every in-memory React value,
// including `bookingRef`. A credentials login never navigates (LoginModal's
// own `signIn(redirect:false)` + `update()` + `router.refresh()`), so on
// that path this key is simply written and never read — cleared instead the
// moment a real submit starts through the still-live in-memory session
// (`onBookingConfirm` below). Single-use (removed on every read attempt,
// valid or not) + a 15-minute TTL. `BookingSlots` is flat/serialisable BY
// DESIGN for exactly this (`booking-flow.ts`'s own file-header rule #2).
// ---------------------------------------------------------------------------
const BOOKING_RESUME_KEY = "ai-chat-booking-resume";
const BOOKING_RESUME_TTL_MS = 15 * 60 * 1000;

interface BookingResumePayload {
  camp: BookingCampContext;
  slots: BookingSlots;
  savedAt: number;
}

/** Best-effort — `sessionStorage` can throw (privacy mode / quota); a failed write just means the camper re-answers after the redirect, never a crash. */
export function writeBookingResume(session: BookingSession): void {
  if (typeof window === "undefined") return;
  try {
    const payload: BookingResumePayload = { camp: session.camp, slots: session.state.slots, savedAt: Date.now() };
    window.sessionStorage.setItem(BOOKING_RESUME_KEY, JSON.stringify(payload));
  } catch {
    // ignore — see doc comment above
  }
}

/** Single-use: the key is removed on every read attempt, valid or not — a stale/malformed/expired payload can never be misread again later. */
export function readAndClearBookingResume(): { camp: BookingCampContext; slots: BookingSlots } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(BOOKING_RESUME_KEY);
    if (raw === null) return null;
    window.sessionStorage.removeItem(BOOKING_RESUME_KEY);
    const parsed = JSON.parse(raw) as Partial<BookingResumePayload>;
    if (!parsed.camp || !parsed.slots || typeof parsed.savedAt !== "number") return null;
    if (Date.now() - parsed.savedAt > BOOKING_RESUME_TTL_MS) return null;
    return { camp: parsed.camp, slots: parsed.slots };
  } catch {
    return null;
  }
}

/** Defensive cleanup — a real submit (the live in-memory session is now authoritative) or an explicit cancel both make an earlier resume key stale. */
export function clearBookingResume(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(BOOKING_RESUME_KEY);
  } catch {
    // ignore — see doc comment above
  }
}

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
  /** CAM-640/CAM-699 — a booking-step chip tap (date, nights, or guests, per the CURRENT step). */
  onBookingChipSelect: (value: string) => void;
  /** CAM-640/CAM-699 — `ย้อนกลับ` (nights -> date, or guests -> nights). */
  onBookingBack: (toStep: BookingStepId) => void;
  /** CAM-640 — `แก้วัน` (summary -> date). */
  onBookingEditDate: () => void;
  /** CAM-640 — `แก้จำนวนคน` (summary -> guests). */
  onBookingEditGuests: () => void;
  /** CAM-640 — `ยกเลิกการจอง`, from any step. */
  onBookingCancel: () => void;
  /** CAM-702/CAM-703 (ADR-018 D1/D2) — the camper's tap on ยืนยันการจอง (or F1/F3's re-armed confirm). The ONE async booking-flow handler; a guest (or a reverted F3 sessionExpired) tap never reaches the network — it serializes the flow and fires `options.onNeedsLogin` instead (CAM-703). */
  onBookingConfirm: () => Promise<void>;
  /** CAM-702 (ADR-018 D6, design brief §8 F2) — `ตรวจสอบแล้วลองใหม่`: checks for an already-created row BEFORE ever submitting again. */
  onBookingCheckAndRetry: () => Promise<void>;
}

export interface UseAiChatOptions {
  /**
   * CAM-703 (ADR-018 D2) — fired from `onBookingConfirm` the moment a guest
   * (or a reverted F3 `sessionExpired` cta) taps the confirm control. The
   * caller (`AiChatPanel`) opens `LoginModal` with the matching subtitle —
   * this hook never touches UI/modal state itself, only signals the need.
   * Never fired for an authed member; `onBookingConfirm` submits for real
   * instead.
   */
  onNeedsLogin?: (reason: "confirm" | "sessionExpired") => void;
}

export function useAiChat(options: UseAiChatOptions = {}): UseAiChatResult {
  const { onNeedsLogin } = options;
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
  /** CAM-702 (ADR-018 D2) — guard 1 of the three double-tap guards: a synchronous check, set BEFORE the first `await` in `onBookingConfirm`/`onBookingCheckAndRetry` and cleared on every exit path. Never React state (same reasoning as `bookingRef` — nothing here should trigger a re-render). */
  const bookingSubmitInFlightRef = useRef(false);

  /**
   * CAM-647 — runs the ONE live pre-summary re-check once the flow reaches
   * `summary` (an interim checking block, tagged `guests` for a whole-camp
   * flow or `spot` for a per-pitch one, is already on screen — see
   * `booking-turn.ts`'s `withChecking` call sites). `runSummaryCheckRef`
   * exists for the SAME reason `handleSpotSelectionRef` does (below): the
   * `checkFailed` block's own retry must call the LATEST version of this
   * function without a genuine TDZ self-reference inside its own
   * initializer. CAM-703 — declared ABOVE `restoreBookingFromStorage` (moved
   * up from its original post-`runTurn` position) so that function's own
   * direct (non-ref) call to `runSummaryCheck` never reads it before its
   * declaration — `eslint-plugin-react-hooks`'s `immutability` rule flags a
   * ref written in one effect and read via a plain forward-declared closure
   * in another as unsafe, even though the runtime timing is safe (effects
   * commit after the whole render function's `const`s have all run).
   */
  const runSummaryCheckRef = useRef<(checkEntries: ChatEntry[], booking: BookingSession) => Promise<void>>(async () => {});

  const runSummaryCheck = useCallback(
    async (checkEntries: ChatEntry[], booking: BookingSession) => {
      const originStep: "guests" | "spot" = booking.camp.useSpotView ? "spot" : "guests";
      const checked = await resolveSummaryCheck(checkEntries, booking, checkRemainingCapacityForFlow, t, language, new Date(), authed);
      // The flow may have moved on (cancelled, or a faster follow-up turn)
      // while the check was in flight — discard a now-orphaned result
      // rather than resurrect a stale/cancelled flow (code.md CAM-359 guard).
      if (!bookingRef.current || bookingRef.current.camp.campId !== booking.camp.campId) return;
      if (checked.retryNeeded) {
        const view: BookingCheckFailedView = {
          kind: "checkFailed",
          onRetry: () => {
            void runSummaryCheckRef.current(checkEntries, booking);
          },
        };
        bookingRef.current = checked.booking;
        setEntries(appendBookingEntry(checked.entries, originStep, view));
        return;
      }
      bookingRef.current = checked.booking;
      setEntries(checked.entries);
    },
    [t, language, authed]
  );
  useEffect(() => {
    runSummaryCheckRef.current = runSummaryCheck;
  }, [runSummaryCheck]);

  /**
   * CAM-703 (ADR-018 D2) — restores a resume payload written just before a
   * guest's full-page Google redirect. A hoisted function declaration (safe
   * to reference from the effect below, which is textually declared first —
   * `runSummaryCheck`, declared further down this file via `useCallback`, is
   * only ever INVOKED once React has already finished this render's
   * synchronous pass, never at define time — a plain closure read, never
   * `runSummaryCheckRef.current`: this function is never itself stored
   * anywhere long-lived, so it always closes over the CURRENT render's
   * `runSummaryCheck` with no staleness risk, and using the ref here would
   * make the ref both read AND written across two different effects, which
   * `eslint-plugin-react-hooks`'s `immutability` rule correctly rejects).
   * Called from all THREE exit points of the conversation-resume effect
   * below, always AFTER any persisted history has already been applied via
   * `setEntries` — a booking-resume attempted before that could be stomped
   * by a later `setEntries` call that replaces the whole array wholesale.
   */
  async function restoreBookingFromStorage(base: ChatEntry[]) {
    if (bookingRef.current) return; // an active flow already exists this mount — never clobber it
    const resume = readAndClearBookingResume();
    if (!resume) return;
    const session: BookingSession = { state: { slots: resume.slots, consecutiveMisses: 0 }, camp: resume.camp };
    bookingRef.current = session;
    await runSummaryCheck(base, session);
  }

  useEffect(() => {
    if (!authed || hasResumedRef.current) return;
    hasResumedRef.current = true;

    (async () => {
      setResuming(true);
      const list = await aiChatAPI.listConversations();
      const conversations = list.data?.conversations ?? [];
      if (conversations.length === 0) {
        setResuming(false); // EC: no saved conversation (or the list fetch failed) -> stay on the fresh welcome state
        await restoreBookingFromStorage([]); // CAM-703 — a Google-redirect resume can still land on an otherwise-empty thread
        return;
      }
      const detail = await aiChatAPI.getConversation(conversations[0].id);
      if (!detail.data) {
        setResuming(false); // EC: detail fetch failed (e.g. deleted between the two calls) -> graceful fallback, never a crash
        await restoreBookingFromStorage([]); // CAM-703 — same as above
        return;
      }
      conversationIdRef.current = detail.data.id;
      const restoredEntries = restoreEntriesFromMessages(detail.data.messages);
      setEntries(restoredEntries);
      setResuming(false);
      await restoreBookingFromStorage(restoredEntries); // CAM-703 — only after history has settled, never before
    })();
    // CAM-703 — `restoreBookingFromStorage` is intentionally omitted: it is
    // a plain (non-memoized) function declaration, always fresh per render,
    // called synchronously inside this SAME effect invocation — never
    // stored, never awaited-then-called-later against a stale closure.
    // Listing it would only make this effect re-run on every render
    // (harmless, since `hasResumedRef` already gates it to a no-op after
    // the first qualifying run, but noisy).
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  /**
   * CAM-700 — applies a synchronous `booking-turn.ts` result, THEN checks
   * whether it just landed on `spot` with no candidates cached yet (a fresh
   * `guests` → `spot` transition); if so, runs `resolveSpotStep` (the /spots
   * fetch + guest filter) and applies ITS result on top. CAM-647: the SAME
   * check also covers landing on `summary` (the live pre-summary re-check —
   * `runSummaryCheck`, above). Every existing date/nights/guests/back/cancel
   * call site routes through this so a future step insertion never needs its
   * own bespoke "did I just enter `spot`/`summary`" check — the guard here
   * is a no-op whenever it doesn't apply.
   */
  const settleBookingTurn = useCallback(
    async (result: BookingTurnResult) => {
      bookingRef.current = result.booking;
      setEntries(result.entries);
      if (!result.booking) return;
      const step = currentStep(result.booking.state.slots, result.booking.camp.useSpotView);
      if (step.id === "summary") {
        await runSummaryCheck(result.entries, result.booking);
        return;
      }
      if (step.id !== "spot" || (result.booking.spotCandidates ?? null) !== null) return;
      const resolved = await resolveSpotStep(result.entries, result.booking, fetchSpotsForFlow, t, language, new Date());
      // The flow may have moved on (cancelled, or a faster follow-up turn)
      // while the fetch was in flight — discard a now-orphaned result rather
      // than resurrect a stale/cancelled flow (code.md CAM-359 guard).
      if (!bookingRef.current || bookingRef.current.camp.campId !== result.booking.camp.campId) return;
      bookingRef.current = resolved.booking;
      setEntries(resolved.entries);
    },
    [t, language, runSummaryCheck]
  );

  /**
   * CAM-700 — a chip tap or typed answer at the `spot` step. Reuses
   * `resolveSpotSelection` (booking-turn.ts) for BOTH the miss/reject path
   * (no network) and the real occupancy check (one call) before a pitch is
   * ever committed — see that function's own doc for why a candidate can
   * never advance straight through the generic synchronous path.
   *
   * `handleSpotSelectionRef` exists ONLY so the `checkFailed` block's own
   * retry can call the LATEST version of this function (recreated whenever
   * `entries`/`t`/`language` change) without naming the `const` inside its
   * own initializer — a direct self-reference there is a genuine TDZ read
   * (flagged as a build error, not just a style nit). Synced via a plain
   * effect (never a direct render-time write — the React Compiler lint rule
   * forbids mutating a ref during render) — the "always latest callback"
   * idiom.
   */
  const handleSpotSelectionRef = useRef<(input: BookingFlowInput, echoText: string) => Promise<void>>(async () => {});

  const handleSpotSelection = useCallback(
    async (input: BookingFlowInput, echoText: string) => {
      const session = bookingRef.current;
      if (!session) return;
      const outcome = await resolveSpotSelection(
        entries,
        session,
        input,
        echoText,
        aiChatAPI.checkSpotAvailability,
        t,
        language,
        new Date()
      );
      if (!bookingRef.current) return; // cancelled while the check was in flight — discard
      if (outcome.retry) {
        const { input: retryInput, echoText: retryEcho } = outcome.retry;
        const view: BookingCheckFailedView = {
          kind: "checkFailed",
          onRetry: () => {
            void handleSpotSelectionRef.current(retryInput, retryEcho);
          },
        };
        bookingRef.current = outcome.booking;
        setEntries(appendBookingEntry(outcome.entries, "spot", view));
        return;
      }
      // CAM-647 — a freed pitch now lands on the interim summary-checking
      // state (`booking-turn.ts`'s own "Free — commit for real" branch),
      // so this routes through `settleBookingTurn` exactly like every other
      // booking turn — it applies the result AND notices the flow just
      // reached `summary`, running the live pre-summary re-check.
      await settleBookingTurn({ entries: outcome.entries, booking: outcome.booking });
    },
    [entries, t, language, settleBookingTurn]
  );
  useEffect(() => {
    handleSpotSelectionRef.current = handleSpotSelection;
  }, [handleSpotSelection]);

  const sendMessage = useCallback(
    async (text: string) => {
      if (sending || !isSendableQuestion(text)) return; // BR-6/EC-1 (unchanged, first)
      if (bookingRef.current) {
        // CAM-640 — a booking turn resolves LOCALLY (no `sending` toggle,
        // design brief §4 "E"). CAM-700: the `spot` step is the one
        // exception that DOES reach the network (an occupancy check), routed
        // through `handleSpotSelection` instead of the generic synchronous
        // path — every other step's typed input still goes through the SAME
        // `processBookingTurn` a chip tap uses (booking-flow.ts's own
        // parse/accept split).
        const step = currentStep(bookingRef.current.state.slots, bookingRef.current.camp.useSpotView).id;
        if (step === "spot") {
          await handleSpotSelection({ kind: "text", text }, text);
          return;
        }
        const result = processBookingTurn(entries, bookingRef.current, { kind: "text", text }, text, t, language, new Date(), authed);
        await settleBookingTurn(result);
        return;
      }
      const withUser = appendUserQuestion(entries, text);
      setEntries(withUser);
      await runTurn(withUser, text);
    },
    [entries, sending, runTurn, t, language, authed, handleSpotSelection, settleBookingTurn]
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
    async (value: string) => {
      const session = bookingRef.current;
      if (!session) return;
      const step = currentStep(session.state.slots, session.camp.useSpotView).id;
      if (step === "date") {
        // CAM-699 — `checkOut` here is a PROVISIONAL 1-night placeholder
        // only (required because `acceptDateCandidate` needs both fields to
        // even validate the candidate): the `nights` step that follows
        // always overwrites it with the camper's real answer, except for a
        // TYPED multi-night range, which a date CHIP can never produce
        // (every chip-offered day is single-day by construction, see
        // `buildDateChipSpecs`). This is what closes the "the chat books 1
        // night no matter what" defect on the chip path.
        const result = processBookingTurn(
          entries,
          session,
          { kind: "chip", slots: { checkIn: value, checkOut: addOneDayIso(value) } },
          formatDateEcho(value, session.camp, t, language),
          t,
          language,
          new Date(),
          authed
        );
        await settleBookingTurn(result);
      } else if (step === "nights") {
        const nights = Number(value);
        const result = processBookingTurn(
          entries,
          session,
          { kind: "chip", slots: { nights } },
          formatNightsEcho(nights, t),
          t,
          language,
          new Date(),
          authed
        );
        await settleBookingTurn(result);
      } else if (step === "guests") {
        const guests = Number(value);
        const result = processBookingTurn(
          entries,
          session,
          { kind: "chip", slots: { guests } },
          formatGuestsEcho(guests, t),
          t,
          language,
          new Date(),
          authed
        );
        await settleBookingTurn(result);
      } else if (step === "spot") {
        // CAM-700 — `value` is the tapped candidate's id; look up its name
        // from the session's own live list (never trust the DOM/echo alone).
        const candidate = session.spotCandidates?.find((c) => c.id === value);
        if (!candidate) return; // defensive — a chip can never carry an unknown id in practice
        await handleSpotSelection(
          { kind: "chip", slots: { spotId: candidate.id, spotName: candidate.name } },
          formatSpotEcho(candidate.name, candidate.pricePerNight, t)
        );
      }
    },
    [entries, t, language, authed, settleBookingTurn, handleSpotSelection]
  );

  const onBookingBack = useCallback(
    async (toStep: BookingStepId) => {
      const session = bookingRef.current;
      if (!session) return;
      const result = processBookingControl(entries, session, toStep, t, language);
      await settleBookingTurn(result);
    },
    [entries, t, language, settleBookingTurn]
  );

  const onBookingEditDate = useCallback(() => onBookingBack("date"), [onBookingBack]);
  const onBookingEditGuests = useCallback(() => onBookingBack("guests"), [onBookingBack]);

  const onBookingCancel = useCallback(() => {
    if (!bookingRef.current) return;
    clearBookingResume(); // CAM-703 — cancelling abandons any pending login-resume intent too
    const result = processBookingCancel(entries, t);
    bookingRef.current = result.booking;
    setEntries(result.entries);
  }, [entries, t]);

  /**
   * CAM-702/CAM-703 (ADR-018 D1/D2) — the confirm tap. Guard 1 (synchronous,
   * BEFORE the first `await`) + guard 2 (`startBookingSubmit` supersedes
   * the prior summary) are both here; guard 3 lives in the rendered
   * `submitting` view itself (AiChatBookingStep.tsx, no `onClick`). Never
   * touches `sending` — see this file's own header.
   */
  const onBookingConfirm = useCallback(async () => {
    const session = bookingRef.current;
    if (!session) return;
    if (bookingSubmitInFlightRef.current) return; // guard 1

    // CAM-703 (ADR-018 D2) — the login gate. A guest's tap (or a reverted
    // F3 sessionExpired tap, still guest-shaped by definition) never
    // reaches the network: serialize the flow — the Google-redirect path
    // needs it, a credentials login never navigates so the key just goes
    // unread — then hand off to the caller to open LoginModal. The reason
    // is read off the CURRENT entry, never guessed: a fresh guest tap on
    // the summary gets `confirm` (-> loginPrompt), a guest tap on F3's
    // reverted button gets `sessionExpired`.
    if (!authed) {
      writeBookingResume(session);
      const last = entries[entries.length - 1];
      const reason: "confirm" | "sessionExpired" =
        last?.role === "assistant" &&
        last.kind === "booking" &&
        last.view.kind === "bookingFailed" &&
        last.view.reason === "sessionExpired"
          ? "sessionExpired"
          : "confirm";
      onNeedsLogin?.(reason);
      return;
    }

    bookingSubmitInFlightRef.current = true;
    clearBookingResume(); // a real submit is starting through the LIVE session — any earlier resume key is now stale
    const now = new Date();
    const started = startBookingSubmit(entries, session, t, language, now); // guard 2
    bookingRef.current = started.booking;
    setEntries(started.entries);

    const result = await submitBookingWrite(started.entries, session, bookingAPI.create, bookingAPI.list, t, language, now);

    bookingSubmitInFlightRef.current = false;
    // The flow may have been cancelled while the write was in flight —
    // discard a now-orphaned result rather than resurrect it (code.md
    // CAM-359 guard, the same discipline `settleBookingTurn` already uses).
    if (!bookingRef.current) return;
    bookingRef.current = result.booking;
    setEntries(result.entries);
  }, [entries, authed, t, language, onNeedsLogin]);

  /**
   * CAM-702 (ADR-018 D6, design brief §8 F2) — `ตรวจสอบแล้วลองใหม่`: checks
   * for an already-created row BEFORE ever submitting again ("the button's
   * contract: look for a booking matching this camper, camp and span; if
   * one exists, render the `booked` card for it; only if none exists,
   * submit"). Self-contained (does not call `onBookingConfirm`) so it never
   * depends on the `!authed` guard there — F2 can only ever be reached from
   * an authed member's own failed submit in this story's scope.
   */
  const onBookingCheckAndRetry = useCallback(async () => {
    const session = bookingRef.current;
    if (!session) return;
    if (bookingSubmitInFlightRef.current) return; // guard 1
    bookingSubmitInFlightRef.current = true;
    const now = new Date();

    const list = await bookingAPI.list();
    // The flow may have been cancelled while the reconcile check itself was
    // in flight — never resurrect it into a fresh submit below.
    if (!bookingRef.current) {
      bookingSubmitInFlightRef.current = false;
      return;
    }
    const candidate = findJustCreatedBooking(session, list.data ?? [], now);
    if (candidate) {
      const result = resolveBookingSubmitSuccess(entries, session, candidate.id, candidate.totalPrice, t, language);
      bookingRef.current = result.booking;
      setEntries(result.entries);
      bookingSubmitInFlightRef.current = false;
      return;
    }

    // No matching row — design brief §8 F2: "only if none exists, submit".
    clearBookingResume(); // CAM-703 — a real submit is starting; any earlier resume key is now stale
    const started = startBookingSubmit(entries, session, t, language, now);
    bookingRef.current = started.booking;
    setEntries(started.entries);
    const result = await submitBookingWrite(started.entries, session, bookingAPI.create, bookingAPI.list, t, language, now);
    bookingSubmitInFlightRef.current = false;
    if (!bookingRef.current) return;
    bookingRef.current = result.booking;
    setEntries(result.entries);
  }, [entries, t, language]);

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
    onBookingConfirm,
    onBookingCheckAndRetry,
  };
}

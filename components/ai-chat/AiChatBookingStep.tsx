/**
 * components/ai-chat/AiChatBookingStep.tsx — CAM-638 (epic CAM-630, in-chat
 * guided booking, design brief CAM-637 §1-§7); `nights` step rendering added
 * by CAM-699 (epic CAM-695, ADR-018 D8 — see `booking-flow.ts`'s own header);
 * the real confirm CTA + `submitting`/`booked`/`bookingFailed` presentation
 * added by CAM-701 (epic CAM-695, design brief CAM-697 §5-§9) — PRESENTATION
 * ONLY, see this file's CAM-701 notes below; the actual POST is CAM-702.
 *
 * The step-state presentation for the in-chat booking flow
 * (date -> nights -> guests -> [spot] -> summary -> submitting ->
 * booked/bookingFailed). CAM-639 wires the question/summary states into
 * `AiChatMessageList`'s message stream and `booking-turn.ts`/`use-ai-chat.ts`
 * drive it from `advanceBookingFlow` (`booking-flow.ts`, CAM-633); CAM-702
 * wires `submitting`/`booked`/`bookingFailed` the same way next. This file
 * imports that module's types + its `BOOKING_STEPS` registry ONLY (never
 * re-declares the step-id list — booking-flow.ts's own header rule, enforced
 * by a source-inspection guard in `cam-633-booking-flow.test.ts`).
 *
 * The step-indicator verdict (design brief, "The step-indicator verdict"):
 * there is NO permanent step bar. The step lives in THIS block's own caption
 * (`aria-current="step"` on the newest block only) and scrolls away as
 * history with it — the message log's existing
 * `role="log" aria-live="polite" aria-relevant="additions"` announces a new
 * block once, for free; a second, mutating live region would double-announce.
 *
 * Scope split (why "questionText" is an opaque prop but chips/captions are
 * not): the assistant's SENTENCE varies by scenario (ask / askNoCap / full /
 * justFilled / unreadable / overCapacity — six different copy keys chosen
 * by whichever flow state produced this render) — picking among those is
 * state-machine wiring, CAM-640's job, out of this story's surface. The
 * CAPTION, chip labels, type-hint, controls, summary labels and the
 * checking/check-failed copy are all MECHANICAL (exactly one message per
 * step, never branching on scenario) so they are resolved here, matching
 * how every sibling ai-chat component already resolves its own copy
 * (`AiChatDetailCard.tsx`, `AiChatMessageList.tsx`).
 *
 * CAM-701 — the `cta` discriminator on `BookingSummaryView` (design brief
 * §5, §0): `kind:'handoff'` is the pre-confirm escape (what `buildSummaryView`
 * still produces today — it has no session parameter, so it cannot compute a
 * guest/member confirm label on its own) and `kind:'confirm'` is the real
 * write CTA, whose LABEL is resolved by the caller from live session and
 * handed in as a plain string — this component never imports `useSession`
 * and never decides guest vs member itself. Tapping either variant's CTA
 * calls the SAME `onConfirm` prop (undefined-safe: this story never wires
 * it to a network call; CAM-702 does). `submitting`/`booked`/`bookingFailed`
 * are new view kinds whose pure builders (`booking-view.ts`) are NOT yet
 * called by `booking-turn.ts` — they are proven here by direct render tests
 * only, matching the CAM-638 pattern ("build the views + the props, prove
 * them by rendering, leave the handlers as props the next story fills").
 *
 * BR-5/Motion (Critical) — no added-motion utility class (no CSS
 * transition/animate utility) anywhere in this file, and specifically this
 * block never carries the shared entrance-motion class every neighbouring
 * row in `AiChatMessageList.tsx` carries — CAM-627 removed continuous/added
 * motion from this panel; this design adds none. No success animation of any
 * kind (design brief §11 Motion — no confetti, no check-mark draw).
 */
"use client";

import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ErrorBanner } from "@/components/ui/error-banner";
import { ChatChipRow, type ChatChipItem } from "@/components/ai-chat/ChatChipRow";
import { useLanguage } from "@/contexts/LanguageContext";
import { resolveBookingSteps, type BookingStepId } from "@/components/ai-chat/booking-flow";

/** Hoisted once, matching every sibling ai-chat component's own THB formatter (AiChatDetailCard.tsx, booking-view.ts). */
const THB_FORMAT = new Intl.NumberFormat("th-TH");

/** 1-based position of a step in THIS camp's resolved list (never a hand-copied literal — `resolveBookingSteps` is the one place step ids are enumerated together). CAM-700: per-camp, since `spot` only exists for `useSpotView` camps. */
function stepPosition(step: BookingStepId, useSpotView: boolean): number {
  return resolveBookingSteps(useSpotView).findIndex((s) => s.id === step) + 1;
}

// ---------------------------------------------------------------------------
// Chip specs — the RAW capacity data; the copy formula (which key, which
// placeholders) is resolved inside this file, never by the caller (BR-3:
// never fabricate a number — the caller only ever hands over a real date +
// a real live `remaining`/count).
// ---------------------------------------------------------------------------

export type BookingDateChipSpec = { kind: "date"; date: string; remaining: number | null };
/** CAM-699 — the `nights` step's chip (design brief §3); inherits round 1's chip anatomy verbatim, no muted secondary content (same shape as `BookingGuestsChipSpec`). */
export type BookingNightsChipSpec = { kind: "nights"; count: number };
export type BookingGuestsChipSpec = { kind: "guests"; count: number };
/** The single E2 (over-capacity) offer chip — design brief §5 E2: "{count} คนก็ได้". */
export type BookingGuestsCapChipSpec = { kind: "guestsCap"; count: number };
/** CAM-700 — the `spot` step's chip: pitch name + per-night price (design brief §4, same anatomy as the `date` chip's date+remaining pair). */
export type BookingSpotChipSpec = { kind: "spot"; id: string; name: string; pricePerNight: number };
export type BookingChipSpec =
  | BookingDateChipSpec
  | BookingNightsChipSpec
  | BookingGuestsChipSpec
  | BookingGuestsCapChipSpec
  | BookingSpotChipSpec;

export type BookingControlSpec =
  | { kind: "back"; toStep: BookingStepId }
  | { kind: "editDate" }
  /** CAM-700 — rendered via the EXISTING generic `onBack` prop (`toStep:'nights'`), never a dedicated handler — keeps `AiChatBookingStepProps` unchanged. */
  | { kind: "editNights" }
  | { kind: "editGuests" }
  /** CAM-700 — same reuse as `editNights` (`onBack`, `toStep:'spot'`). */
  | { kind: "editSpot" }
  | { kind: "cancel" };

export interface BookingQuestionView {
  kind: "question";
  step: "date" | "nights" | "guests" | "spot";
  /** `aria-current="step"` on the caption only for the newest block (design brief §"The step-indicator verdict"). */
  isCurrent: boolean;
  /** Already-resolved assistant sentence — see file header "Scope split". */
  questionText: string;
  chips: readonly BookingChipSpec[];
  /** `guests`/`spot` — an async re-check in flight (design brief §4: chips disabled + a text status line, never a spinner). */
  isChecking?: boolean;
  controls: readonly BookingControlSpec[];
  /** CAM-700 — per-camp step total for the caption (`resolveBookingSteps(useSpotView).length`). Optional so every view literal written before this story keeps compiling + rendering unchanged (default `false` = whole-camp, byte-identical to the old `BOOKING_STEPS.length`). */
  useSpotView?: boolean;
}

/** CAM-701 (design brief §0, §5) — the pre-confirm escape: `buildSummaryView` still produces this today (it has no session param to compute a real confirm label from). Also the interim shape a per-spot summary renders (this story's own scope note — see `AiChatBookingStep.tsx`'s file header). */
export interface BookingHandoffCta {
  kind: "handoff";
  href: string;
}
/** CAM-701 (design brief §5) — "one control, two labels, distinguished by `authState`" (`data-auth="guest|member"`). `label` is resolved by the CALLER from live session (`aiChat.booking.confirm` / `loginToConfirm`) — this component only ever renders the string it is given. */
export interface BookingConfirmCta {
  kind: "confirm";
  label: string;
  authState: "guest" | "member";
}
export type BookingSummaryCta = BookingHandoffCta | BookingConfirmCta;

export interface BookingSummaryView {
  kind: "summary";
  isCurrent: boolean;
  campValue: string;
  datesValue: string;
  guestsValue: string;
  /** CAM-700 — the chosen pitch's name, per-pitch camps only; absent renders no row (never a `—`, design brief §5). */
  spotValue?: string;
  /** Pre-formatted (e.g. "฿500") by the caller via the shared `computeBookingPrice` + `THB_FORMAT` — this component never does money math (design brief §3 BR-7). */
  totalValue: string;
  /** CAM-701 — replaces the old bare `handoffHref` field (design brief §5, §0). See `BookingHandoffCta`/`BookingConfirmCta` for the two shapes. */
  cta: BookingSummaryCta;
  controls: readonly BookingControlSpec[];
  /** CAM-700 — same per-camp caption total as `BookingQuestionView.useSpotView`. */
  useSpotView?: boolean;
}

/** E3 — the pre-summary re-check itself failed. No step block at all: reuses the chat's existing error row verbatim (design brief §5 E3). */
export interface BookingCheckFailedView {
  kind: "checkFailed";
  onRetry: () => void;
}

/** CAM-701 (design brief §6) — the frozen row data every post-summary state re-displays: "the rows stay on screen, unchanged". */
export interface BookingSummaryRows {
  campValue: string;
  datesValue: string;
  guestsValue: string;
  spotValue?: string;
  totalValue: string;
}

/** CAM-701 (design brief §6) — the write in flight. The confirm button takes `aria-disabled` (never `disabled` — it holds focus at the moment of the tap); every OTHER control takes the real `disabled` attribute. `isCurrent` is unused by this component's own render (this state is inherently "now") — present only so `conversation.ts`'s `appendBookingEntry` (which supersedes across the WHOLE `BookingStepView` union) keeps typechecking; never read here. */
export interface BookingSubmittingView extends BookingSummaryRows {
  kind: "submitting";
  controls: readonly BookingControlSpec[];
  useSpotView?: boolean;
  isCurrent?: boolean;
}

/** CAM-701 (design brief §7) — the flow's terminal success state; no `msg--ai-chat-booking-step` framing (the flow has ended, no control row, no cancel). `isCurrent` — see `BookingSubmittingView`'s own note. */
export interface BookingBookedView extends BookingSummaryRows {
  kind: "booked";
  bookingId: string;
  isCurrent?: boolean;
}

export type BookingFailedReason = "rateLimited" | "uncertain" | "sessionExpired";

/** CAM-701 (design brief §8) — F1/F2/F3, the only failures that render an `ErrorBanner`. `cta` reuses `BookingConfirmCta` for F1 (re-enabled confirm) and F3 (reverted to `loginToConfirm`); absent for F2, whose actions are `ตรวจสอบแล้วลองใหม่` + `ดูการจองของฉัน` instead. `isCurrent` — see `BookingSubmittingView`'s own note. */
export interface BookingFailedView extends BookingSummaryRows {
  kind: "bookingFailed";
  reason: BookingFailedReason;
  cta?: BookingConfirmCta;
  isCurrent?: boolean;
}

export type BookingStepView =
  | BookingQuestionView
  | BookingSummaryView
  | BookingCheckFailedView
  | BookingSubmittingView
  | BookingBookedView
  | BookingFailedView;

export interface AiChatBookingStepProps {
  view: BookingStepView;
  onChipSelect?: (value: string) => void;
  onBack?: (toStep: BookingStepId) => void;
  onEditDate?: () => void;
  onEditGuests?: () => void;
  onCancel?: () => void;
  /** CAM-701 — the summary confirm CTA (member `ยืนยันการจอง` / guest `เข้าสู่ระบบเพื่อยืนยันการจอง`, design brief §5) and F1/F3's re-armed CTA (§8) all reuse this ONE prop; undefined-safe (this story never calls it), wired by CAM-702. */
  onConfirm?: () => void;
  /** CAM-701 — F2's `ตรวจสอบแล้วลองใหม่` (design brief §8, "must check before it writes"); undefined-safe, wired by CAM-702. */
  onCheckAndRetry?: () => void;
}

export function AiChatBookingStep({
  view,
  onChipSelect,
  onBack,
  onEditDate,
  onEditGuests,
  onCancel,
  onConfirm,
  onCheckAndRetry,
}: AiChatBookingStepProps) {
  const { t, language } = useLanguage();

  if (view.kind === "checkFailed") {
    // Same shape as AiChatMessageList.tsx:454-467 — no new pattern, no new
    // copy for the retry button (design brief §5 E3).
    return (
      <div className="flex w-full flex-col gap-2">
        <ErrorBanner
          message={t.aiChat.booking.checkFailed}
          className="rounded-2xl"
          data-testid="error--ai-chat-booking-check-failed"
        />
        <Button type="button" variant="outline" size="sm" data-testid="btn--ai-chat-retry" onClick={view.onRetry}>
          {t.aiChat.retry}
        </Button>
      </div>
    );
  }

  const dateFormatter = new Intl.DateTimeFormat(language === "en" ? "en" : "th-TH", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  const formatDate = (iso: string) => dateFormatter.format(new Date(`${iso}T00:00:00Z`));

  if (view.kind === "summary") {
    const step: BookingStepId = "summary";
    // CAM-701 (design brief §5 "the historical summary must go inert") — a
    // superseded summary's CTA + every control row button takes the REAL
    // `disabled` attribute (out of the tab order), not merely a missing
    // handler — a scrolled-back summary must not be a live double-submit
    // path. The IN-FLIGHT case (`aria-disabled`) is the separate
    // `submitting` view kind below, never this one.
    const controlsDisabled = !view.isCurrent;
    const introText = view.cta.kind === "confirm" ? t.aiChat.booking.summary.introConfirm : t.aiChat.booking.summary.intro;
    return (
      <div role="group" aria-label={t.aiChat.booking.groupLabel} data-testid="msg--ai-chat-booking-step" data-step={step} className="space-y-3">
        <StepCaption step={step} isCurrent={view.isCurrent} useSpotView={view.useSpotView ?? false} />
        <p className="text-sm leading-relaxed text-foreground">{introText}</p>

        <div
          role="group"
          aria-label={t.aiChat.booking.summary.label}
          data-testid="block--ai-chat-booking-summary"
          className="rounded-2xl border border-ai-tint/60 bg-muted/20 p-4"
        >
          <SummaryCardRows rows={view} totalLabel={t.aiChat.booking.summary.totalRow} note={t.aiChat.booking.summary.estimateNote} />
        </div>

        {view.cta.kind === "handoff" ? (
          controlsDisabled ? (
            <Button type="button" size="lg" className="w-full" disabled data-testid="btn--ai-chat-booking-handoff">
              {t.aiChat.booking.handoff}
            </Button>
          ) : (
            <Button asChild size="lg" className="w-full" data-testid="btn--ai-chat-booking-handoff">
              <Link href={view.cta.href}>{t.aiChat.booking.handoff}</Link>
            </Button>
          )
        ) : (
          <Button
            type="button"
            size="lg"
            className="w-full"
            data-testid="btn--ai-chat-booking-confirm"
            data-auth={view.cta.authState}
            disabled={controlsDisabled || undefined}
            onClick={controlsDisabled ? undefined : onConfirm}
          >
            {view.cta.label}
          </Button>
        )}

        <ControlsRow
          step={step}
          controls={view.controls}
          disabled={controlsDisabled}
          onBack={onBack}
          onEditDate={onEditDate}
          onEditGuests={onEditGuests}
          onCancel={onCancel}
        />
      </div>
    );
  }

  if (view.kind === "submitting") {
    const step: BookingStepId = "summary";
    return (
      <div role="group" aria-label={t.aiChat.booking.groupLabel} data-testid="msg--ai-chat-booking-step" data-step={step} className="space-y-3">
        <StepCaption step={step} isCurrent useSpotView={view.useSpotView ?? false} />

        <div
          role="group"
          aria-label={t.aiChat.booking.summary.label}
          data-testid="block--ai-chat-booking-summary"
          className="rounded-2xl border border-ai-tint/60 bg-muted/20 p-4"
        >
          <SummaryCardRows rows={view} totalLabel={t.aiChat.booking.summary.totalRow} note={t.aiChat.booking.summary.estimateNote} />
        </div>

        {/* CAM-701 (design brief §6 Critical) — aria-disabled, NEVER `disabled`: this is the element that has focus at the instant of the tap, and `disabled` would drop focus to <body>, stranding a keyboard camper with nothing to read the status line from. No onClick — a second tap is a silent no-op, satisfying "an onClick guard keeps the focus... and still refuses the second press". */}
        <Button
          type="button"
          size="lg"
          className="w-full"
          data-testid="btn--ai-chat-booking-confirm"
          data-auth="member"
          aria-disabled="true"
        >
          {t.aiChat.booking.confirm}
        </Button>

        <p role="status" aria-live="polite" data-testid="status--ai-chat-booking-submitting" className="text-xs text-foreground/70">
          {t.aiChat.booking.submitting}
        </p>

        <ControlsRow
          step={step}
          controls={view.controls}
          disabled
          onBack={onBack}
          onEditDate={onEditDate}
          onEditGuests={onEditGuests}
          onCancel={onCancel}
        />
      </div>
    );
  }

  if (view.kind === "booked") {
    return (
      <div className="space-y-3">
        <h3 tabIndex={-1} data-testid="text--ai-chat-booking-success-title" className="flex items-center gap-2 text-sm font-medium text-foreground">
          <CheckCircle2 className="size-4 shrink-0 text-success" aria-hidden="true" />
          {t.aiChat.booking.success.title}
        </h3>

        <div
          role="group"
          aria-label={t.aiChat.booking.success.label}
          data-testid="block--ai-chat-booking-success"
          className="rounded-2xl border border-ai-tint/60 bg-muted/20 p-4"
        >
          <SummaryCardRows
            rows={view}
            totalLabel={t.aiChat.booking.success.totalRow}
            note={t.aiChat.booking.success.pendingNote}
            testId="row--ai-chat-booking-success-line"
          />
        </div>

        <Button asChild size="lg" className="w-full" data-testid="btn--ai-chat-booking-view-confirmation">
          <Link href={`/bookings/${view.bookingId}/confirmation`}>{t.aiChat.booking.success.viewBooking}</Link>
        </Button>
        <Button asChild variant="outline" size="lg" className="w-full" data-testid="btn--ai-chat-booking-view-bookings">
          <Link href="/bookings">{t.aiChat.booking.success.viewAll}</Link>
        </Button>
      </div>
    );
  }

  if (view.kind === "bookingFailed") {
    const step: BookingStepId = "summary";
    const message =
      view.reason === "rateLimited"
        ? t.aiChat.booking.failed.rateLimited
        : view.reason === "uncertain"
          ? t.aiChat.booking.failed.uncertain
          : t.aiChat.booking.sessionExpired;
    return (
      <div role="group" aria-label={t.aiChat.booking.groupLabel} data-testid="msg--ai-chat-booking-step" data-step={step} className="space-y-3">
        <div tabIndex={-1} data-testid="error--ai-chat-booking-failed" data-reason={view.reason}>
          <ErrorBanner message={message} className="rounded-2xl" />
        </div>

        <div
          role="group"
          aria-label={t.aiChat.booking.summary.label}
          data-testid="block--ai-chat-booking-summary"
          className="rounded-2xl border border-ai-tint/60 bg-muted/20 p-4"
        >
          <SummaryCardRows rows={view} totalLabel={t.aiChat.booking.summary.totalRow} note={t.aiChat.booking.summary.estimateNote} />
        </div>

        {view.reason === "uncertain" ? (
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              className="h-11 rounded-full"
              data-testid="btn--ai-chat-booking-check-retry"
              onClick={onCheckAndRetry}
            >
              {t.aiChat.booking.failed.checkAndRetry}
            </Button>
            <Button
              asChild
              variant="outline"
              size="sm"
              className="h-11 rounded-full"
              data-testid="btn--ai-chat-booking-view-my-bookings"
            >
              <Link href="/bookings">{t.aiChat.booking.failed.viewMyBookings}</Link>
            </Button>
          </div>
        ) : view.cta ? (
          <Button
            type="button"
            size="lg"
            className="w-full"
            data-testid="btn--ai-chat-booking-confirm"
            data-auth={view.cta.authState}
            onClick={onConfirm}
          >
            {view.cta.label}
          </Button>
        ) : null}
      </div>
    );
  }

  // view.kind === "question"
  const step = view.step;
  // CAM-700 — a `spot` block with no chips WHILE loading (`isChecking`, the
  // step-entry /spots fetch) is not the "no offers fit" empty state; exclude
  // it so the fetch-in-flight moment never wears the empty-state testid/copy.
  const isEmpty = (step === "date" || step === "spot") && view.chips.length === 0 && !view.isChecking;
  const showTypeHint = !isEmpty;
  const chipItems: ChatChipItem[] = view.chips.map((chip) => resolveChip(chip, t, formatDate));
  const { chipsLabel, typeHint } = stepCopy(step, t);

  return (
    <div role="group" aria-label={t.aiChat.booking.groupLabel} data-testid="msg--ai-chat-booking-step" data-step={step} className="space-y-3">
      <StepCaption step={step} isCurrent={view.isCurrent} useSpotView={view.useSpotView ?? false} />
      <p
        className="text-sm leading-relaxed text-foreground"
        data-testid={isEmpty ? (step === "spot" ? "empty--ai-chat-booking-no-spots" : "empty--ai-chat-booking-no-dates") : undefined}
      >
        {view.questionText}
      </p>

      <ChatChipRow
        items={chipItems}
        groupLabel={chipsLabel}
        groupTestId="group--ai-chat-booking-chips"
        chipTestId="btn--ai-chat-booking-chip"
        dataStep={step}
        disabled={view.isChecking}
        onSelect={(value) => onChipSelect?.(value)}
      />

      {view.isChecking && (
        <p role="status" aria-live="polite" data-testid="status--ai-chat-booking-checking" className="text-xs text-foreground/70">
          {t.aiChat.booking.checking}
        </p>
      )}

      {showTypeHint && (
        <p data-testid="text--ai-chat-booking-type-hint" data-step={step} className="text-xs text-foreground/70">
          {typeHint}
        </p>
      )}

      <ControlsRow step={step} controls={view.controls} onBack={onBack} onEditDate={onEditDate} onEditGuests={onEditGuests} onCancel={onCancel} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Internal pieces
// ---------------------------------------------------------------------------

function StepCaption({ step, isCurrent, useSpotView }: { step: BookingStepId; isCurrent: boolean; useSpotView: boolean }) {
  const { t } = useLanguage();
  // CAM-700 — `{total}` now reads the step list RESOLVED FOR THIS CAMP
  // (`resolveBookingSteps(useSpotView)`), never the static whole-camp
  // constant: 4 for a whole-camp flow, 5 for a per-pitch one that has
  // reached/passed `spot` (design brief §2's critical note).
  const caption = t.aiChat.booking.stepCaption
    .replace("{current}", String(stepPosition(step, useSpotView)))
    .replace("{total}", String(resolveBookingSteps(useSpotView).length));
  const stepName = t.aiChat.booking.stepName[step];
  return (
    <p
      data-testid="text--ai-chat-booking-step-caption"
      data-step={step}
      aria-current={isCurrent ? "step" : undefined}
      tabIndex={-1}
      className="text-xs text-foreground/70"
    >
      {caption} · {stepName}
    </p>
  );
}

/** CAM-701 — a plain label/value pair, no `role="row"` (design brief §12 Important: an orphan `role="row"` with no `rowgroup`/`table`/`grid` ancestor is an axe `aria-required-parent` violation that shipped via CAM-639; dropped here, not repeated on the new success rows). */
function SummaryRow({
  field,
  label,
  value,
  testId = "row--ai-chat-booking-summary-line",
}: {
  field: "camp" | "dates" | "guests" | "spot" | "total";
  label: string;
  value: string;
  testId?: string;
}) {
  return (
    <div data-testid={testId} data-field={field} className="flex items-baseline justify-between gap-3">
      <span className="text-xs text-foreground/70">{label}</span>
      <span className="text-sm font-medium text-foreground tabular-nums">{value}</span>
    </div>
  );
}

/** CAM-701 — the row block shared by `summary`/`submitting`/`bookingFailed` (frozen, "ยอดรวมโดยประมาณ" + the estimate note) and `booked` (settled "ยอดรวม" + the pending-confirmation note, its own `row--ai-chat-booking-success-line` testid). */
function SummaryCardRows({
  rows,
  totalLabel,
  note,
  testId = "row--ai-chat-booking-summary-line",
}: {
  rows: BookingSummaryRows;
  totalLabel: string;
  note: string;
  testId?: string;
}) {
  const { t } = useLanguage();
  return (
    <>
      <SummaryRow testId={testId} field="camp" label={t.aiChat.booking.summary.campRow} value={rows.campValue} />
      <SummaryRow testId={testId} field="dates" label={t.aiChat.booking.summary.datesRow} value={rows.datesValue} />
      <SummaryRow testId={testId} field="guests" label={t.aiChat.booking.summary.guestsRow} value={rows.guestsValue} />
      {rows.spotValue && (
        <SummaryRow testId={testId} field="spot" label={t.aiChat.booking.summary.spotRow} value={rows.spotValue} />
      )}
      <div className="mt-3 border-t border-border/60 pt-3">
        <SummaryRow testId={testId} field="total" label={totalLabel} value={rows.totalValue} />
      </div>
      <p className="mt-2 text-xs text-foreground/70">{t.booking.notChargedYet}</p>
      <p className="text-xs text-foreground/70">{note}</p>
    </>
  );
}

function ControlsRow({
  step,
  controls,
  onBack,
  onEditDate,
  onEditGuests,
  onCancel,
  disabled = false,
}: {
  step: BookingStepId;
  controls: readonly BookingControlSpec[];
  onBack?: (toStep: BookingStepId) => void;
  onEditDate?: () => void;
  onEditGuests?: () => void;
  onCancel?: () => void;
  /** CAM-701 — real `disabled` on every control (design brief §5/§6: a superseded summary or a write in flight). Defaults `false`, unchanged for `question` steps (the pre-existing chip-tappable-when-superseded gap named in the brief §5 is explicitly out of this story's surface). */
  disabled?: boolean;
}) {
  const { t } = useLanguage();
  if (controls.length === 0) return null;

  return (
    <div
      role="group"
      aria-label={t.aiChat.booking.controlsLabel}
      data-testid="group--ai-chat-booking-controls"
      data-step={step}
      className="flex flex-wrap gap-2"
    >
      {controls.map((control) => {
        if (control.kind === "back") {
          return (
            <Button
              key="back"
              type="button"
              variant="ghost"
              size="sm"
              className="h-11 rounded-full"
              data-testid="btn--ai-chat-booking-back"
              data-step={control.toStep}
              disabled={disabled}
              onClick={disabled ? undefined : () => onBack?.(control.toStep)}
            >
              {t.aiChat.booking.back}
            </Button>
          );
        }
        if (control.kind === "editDate") {
          return (
            <Button
              key="editDate"
              type="button"
              variant="ghost"
              size="sm"
              className="h-11 rounded-full"
              data-testid="btn--ai-chat-booking-edit"
              data-step="date"
              disabled={disabled}
              onClick={disabled ? undefined : onEditDate}
            >
              {t.aiChat.booking.editDate}
            </Button>
          );
        }
        if (control.kind === "editGuests") {
          return (
            <Button
              key="editGuests"
              type="button"
              variant="ghost"
              size="sm"
              className="h-11 rounded-full"
              data-testid="btn--ai-chat-booking-edit"
              data-step="guests"
              disabled={disabled}
              onClick={disabled ? undefined : onEditGuests}
            >
              {t.aiChat.booking.editGuests}
            </Button>
          );
        }
        if (control.kind === "editNights") {
          // CAM-700 — reuses the EXISTING generic `onBack` handler (never a
          // dedicated prop, see `BookingControlSpec.editNights`'s own doc).
          return (
            <Button
              key="editNights"
              type="button"
              variant="ghost"
              size="sm"
              className="h-11 rounded-full"
              data-testid="btn--ai-chat-booking-edit"
              data-step="nights"
              disabled={disabled}
              onClick={disabled ? undefined : () => onBack?.("nights")}
            >
              {t.aiChat.booking.editNights}
            </Button>
          );
        }
        if (control.kind === "editSpot") {
          return (
            <Button
              key="editSpot"
              type="button"
              variant="ghost"
              size="sm"
              className="h-11 rounded-full"
              data-testid="btn--ai-chat-booking-edit"
              data-step="spot"
              disabled={disabled}
              onClick={disabled ? undefined : () => onBack?.("spot")}
            >
              {t.aiChat.booking.editSpot}
            </Button>
          );
        }
        return (
          <Button
            key="cancel"
            type="button"
            variant="ghost"
            size="sm"
            className="h-11 rounded-full"
            data-testid="btn--ai-chat-booking-cancel"
            data-step={step}
            disabled={disabled}
            onClick={disabled ? undefined : onCancel}
          >
            {t.aiChat.booking.cancel}
          </Button>
        );
      })}
    </div>
  );
}

/**
 * The chip-content FORMULA — mechanical, never a caller-supplied string
 * (BR-3: the caller only ever hands over live capacity data). Date chips
 * split into a formatted date + an `aria-hidden` middot + a muted remaining
 * count (design brief §1), with a single-string `aria-label` override built
 * from the new `aiChat.booking.date.chip`/`chipNoCap` templates "so the
 * announced name reads cleanly with no stray separator" (brief, verbatim).
 */
function resolveChip(
  chip: BookingChipSpec,
  t: ReturnType<typeof useLanguage>["t"],
  formatDate: (iso: string) => string
): ChatChipItem {
  if (chip.kind === "date") {
    const formatted = formatDate(chip.date);
    if (chip.remaining === null) {
      // EC-4 — no per-day cap set: never fabricate a ceiling.
      return {
        value: chip.date,
        label: `${formatted} ${t.aiChat.detail.openNoCap}`,
        ariaLabel: t.aiChat.booking.date.chipNoCap.replace("{date}", formatted),
        content: (
          <>
            <span>{formatted}</span>
            <span aria-hidden="true"> · </span>
            <span className="text-foreground/70 tabular-nums">{t.aiChat.detail.openNoCap}</span>
          </>
        ),
      };
    }
    const remainingText = t.aiChat.card.remaining.replace("{count}", String(chip.remaining));
    return {
      value: chip.date,
      label: `${formatted} ${remainingText}`,
      ariaLabel: t.aiChat.booking.date.chip.replace("{date}", formatted).replace("{count}", String(chip.remaining)),
      content: (
        <>
          <span>{formatted}</span>
          <span aria-hidden="true"> · </span>
          <span className="text-foreground/70 tabular-nums">{remainingText}</span>
        </>
      ),
    };
  }
  if (chip.kind === "guestsCap") {
    return { value: String(chip.count), label: t.aiChat.booking.guests.capChip.replace("{count}", String(chip.count)) };
  }
  // CAM-699 — `nights` chips inherit round 1's `guests` chip anatomy
  // verbatim: plain label, no muted secondary content (design brief §9).
  if (chip.kind === "nights") {
    return { value: String(chip.count), label: t.aiChat.booking.nights.chip.replace("{count}", String(chip.count)) };
  }
  // CAM-700 — `spot` chips inherit the `date` chip's anatomy (name + middot +
  // muted price), design brief §4. The accessible name is overridden with a
  // single string built from `spot.chip` so no stray separator is announced.
  if (chip.kind === "spot") {
    const priceText = `฿${THB_FORMAT.format(chip.pricePerNight)}`;
    return {
      value: chip.id,
      label: `${chip.name} ${priceText}`,
      ariaLabel: t.aiChat.booking.spot.chip.replace("{name}", chip.name).replace("{price}", priceText),
      content: (
        <>
          <span>{chip.name}</span>
          <span aria-hidden="true"> · </span>
          <span className="text-foreground/70 tabular-nums">{priceText}</span>
        </>
      ),
    };
  }
  return { value: String(chip.count), label: t.aiChat.booking.guests.chip.replace("{count}", String(chip.count)) };
}

/**
 * CAM-700 — the chips-label + type-hint copy pair for a `question` step.
 * `date`/`nights`/`guests`/`spot` are the only step ids `BookingQuestionView.step`
 * can carry (`summary` has its own render branch above).
 */
function stepCopy(
  step: "date" | "nights" | "guests" | "spot",
  t: ReturnType<typeof useLanguage>["t"]
): { chipsLabel: string; typeHint: string } {
  if (step === "date") return { chipsLabel: t.aiChat.booking.date.chipsLabel, typeHint: t.aiChat.booking.date.typeHint };
  if (step === "nights") return { chipsLabel: t.aiChat.booking.nights.chipsLabel, typeHint: t.aiChat.booking.nights.typeHint };
  if (step === "spot") return { chipsLabel: t.aiChat.booking.spot.chipsLabel, typeHint: t.aiChat.booking.spot.typeHint };
  return { chipsLabel: t.aiChat.booking.guests.chipsLabel, typeHint: t.aiChat.booking.guests.typeHint };
}

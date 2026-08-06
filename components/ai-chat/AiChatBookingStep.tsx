/**
 * components/ai-chat/AiChatBookingStep.tsx — CAM-638 (epic CAM-630, in-chat
 * guided booking, design brief CAM-637 §1-§7); `nights` step rendering added
 * by CAM-699 (epic CAM-695, ADR-018 D8 — see `booking-flow.ts`'s own header).
 *
 * The step-state presentation for the 4-step in-chat booking flow
 * (date -> nights -> guests -> summary). CAM-639 wires this into
 * `AiChatMessageList`'s message stream and `booking-turn.ts`/`use-ai-chat.ts`
 * drive it from `advanceBookingFlow` (`booking-flow.ts`, CAM-633). This
 * file imports that module's types + its `BOOKING_STEPS` registry ONLY
 * (never re-declares the step-id list — booking-flow.ts's own header rule,
 * enforced by a source-inspection guard in `cam-633-booking-flow.test.ts`).
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
 * BR-5/Motion (Critical) — no added-motion utility class (no CSS
 * transition/animate utility) anywhere in this file, and specifically this
 * block never carries the shared entrance-motion class every neighbouring
 * row in `AiChatMessageList.tsx` carries — CAM-627 removed continuous/added
 * motion from this panel; this design adds none.
 */
"use client";

import Link from "next/link";
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
  handoffHref: string;
  controls: readonly BookingControlSpec[];
  /** CAM-700 — same per-camp caption total as `BookingQuestionView.useSpotView`. */
  useSpotView?: boolean;
}

/** E3 — the pre-summary re-check itself failed. No step block at all: reuses the chat's existing error row verbatim (design brief §5 E3). */
export interface BookingCheckFailedView {
  kind: "checkFailed";
  onRetry: () => void;
}

export type BookingStepView = BookingQuestionView | BookingSummaryView | BookingCheckFailedView;

export interface AiChatBookingStepProps {
  view: BookingStepView;
  onChipSelect?: (value: string) => void;
  onBack?: (toStep: BookingStepId) => void;
  onEditDate?: () => void;
  onEditGuests?: () => void;
  onCancel?: () => void;
}

export function AiChatBookingStep({
  view,
  onChipSelect,
  onBack,
  onEditDate,
  onEditGuests,
  onCancel,
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
    return (
      <div role="group" aria-label={t.aiChat.booking.groupLabel} data-testid="msg--ai-chat-booking-step" data-step={step} className="space-y-3">
        <StepCaption step={step} isCurrent={view.isCurrent} useSpotView={view.useSpotView ?? false} />
        <p className="text-sm leading-relaxed text-foreground">{t.aiChat.booking.summary.intro}</p>

        <div
          role="group"
          aria-label={t.aiChat.booking.summary.label}
          data-testid="block--ai-chat-booking-summary"
          className="rounded-2xl border border-ai-tint/60 bg-muted/20 p-4"
        >
          <SummaryRow field="camp" label={t.aiChat.booking.summary.campRow} value={view.campValue} />
          <SummaryRow field="dates" label={t.aiChat.booking.summary.datesRow} value={view.datesValue} />
          <SummaryRow field="guests" label={t.aiChat.booking.summary.guestsRow} value={view.guestsValue} />
          {view.spotValue && (
            <SummaryRow field="spot" label={t.aiChat.booking.summary.spotRow} value={view.spotValue} />
          )}
          <div className="mt-3 border-t border-border/60 pt-3">
            <SummaryRow field="total" label={t.aiChat.booking.summary.totalRow} value={view.totalValue} />
          </div>
          <p className="mt-2 text-xs text-foreground/70">{t.booking.notChargedYet}</p>
          <p className="text-xs text-foreground/70">{t.aiChat.booking.summary.estimateNote}</p>
        </div>

        <Button asChild size="lg" className="w-full" data-testid="btn--ai-chat-booking-handoff">
          <Link href={view.handoffHref}>{t.aiChat.booking.handoff}</Link>
        </Button>

        <ControlsRow step={step} controls={view.controls} onBack={onBack} onEditDate={onEditDate} onEditGuests={onEditGuests} onCancel={onCancel} />
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

function SummaryRow({ field, label, value }: { field: "camp" | "dates" | "guests" | "spot" | "total"; label: string; value: string }) {
  return (
    <div role="row" data-testid="row--ai-chat-booking-summary-line" data-field={field} className="flex items-baseline justify-between gap-3">
      <span className="text-xs text-foreground/70">{label}</span>
      <span className="text-sm font-medium text-foreground tabular-nums">{value}</span>
    </div>
  );
}

function ControlsRow({
  step,
  controls,
  onBack,
  onEditDate,
  onEditGuests,
  onCancel,
}: {
  step: BookingStepId;
  controls: readonly BookingControlSpec[];
  onBack?: (toStep: BookingStepId) => void;
  onEditDate?: () => void;
  onEditGuests?: () => void;
  onCancel?: () => void;
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
              onClick={() => onBack?.(control.toStep)}
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
              onClick={onEditDate}
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
              onClick={onEditGuests}
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
              onClick={() => onBack?.("nights")}
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
              onClick={() => onBack?.("spot")}
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
            onClick={onCancel}
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

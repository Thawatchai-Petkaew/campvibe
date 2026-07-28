/**
 * components/ai-chat/ChatChipRow.tsx — CAM-638 (epic CAM-630, in-chat guided
 * booking, design brief CAM-637 §6)
 *
 * A generic "row of one-shot answer chips" — extracted so the in-chat
 * booking flow (`AiChatBookingStep`, this same story) and the EXISTING
 * follow-up-question chips (`AiChatMessageList.tsx:398-417`) can share one
 * chip treatment instead of two hand-rolled copies. Design brief §6: "an
 * internal extraction inside `components/ai-chat/`, shared with the
 * existing suggestion chips. Not a new design-system primitive, so no
 * `DESIGN.md` §3.1 entry."
 *
 * Wiring `AiChatMessageList.tsx`'s suggestion chips onto this component is
 * CAM-639's job (that file is out of this story's surface) — this file only
 * introduces the shared shape, with no consumer yet beyond the booking flow.
 *
 * BR-2/design brief "Alternatives considered" — deliberately NOT the
 * existing selectable/toggle pill primitive (`DESIGN.md:429`), whose
 * contract is `aria-pressed` + `onToggle` (a persisted TOGGLE state). A
 * booking answer is a one-shot command with no pressed state; giving it
 * `aria-pressed` would announce a toggle that does not exist. Each item here
 * renders as a real `<Button variant="outline" size="sm">` instead.
 *
 * BR-5 — no added-motion utility class (no CSS transition/animate utility,
 * no extra press-scale class) is added here (CAM-627: chat surfaces ship
 * with zero added motion). The primitive `<Button>` itself still carries
 * its own baseline press/hover motion classes — untouched, out of this
 * story's surface.
 */
"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

export interface ChatChipItem {
  /** Also used as the chip's `data-value` (BR-8 — the step lives in a sibling `data-step`, never inside a testid string). */
  value: string;
  /** Plain text shown when `content` is not supplied, and the accessible name when `ariaLabel` is not supplied. */
  label: string;
  /** Richer visible content (e.g. a formatted date + an aria-hidden separator + a muted count) — falls back to `label` when omitted. */
  content?: ReactNode;
  /** Overrides the accessible name when the visible content is split into decorative pieces (design brief §1: "built from one string, so the announced name reads cleanly with no stray separator"). */
  ariaLabel?: string;
}

export interface ChatChipRowProps {
  items: readonly ChatChipItem[];
  groupLabel: string;
  groupTestId: string;
  chipTestId: string;
  onSelect: (value: string) => void;
  /** Sibling attribute on both the group and every chip (BR-8) — omitted for a non-booking caller. */
  dataStep?: string;
  /** While true, every chip is disabled and the group is marked `aria-busy` (design brief §4 — the guests re-check). */
  disabled?: boolean;
}

/** Renders nothing for an empty list — the caller decides what an empty chip row means (e.g. the date-step empty state renders its own copy instead). */
export function ChatChipRow({
  items,
  groupLabel,
  groupTestId,
  chipTestId,
  onSelect,
  dataStep,
  disabled,
}: ChatChipRowProps) {
  if (items.length === 0) return null;

  return (
    <div
      role="group"
      aria-label={groupLabel}
      aria-busy={disabled || undefined}
      data-testid={groupTestId}
      data-step={dataStep}
      className="flex flex-wrap gap-2"
    >
      {items.map((item) => (
        <Button
          key={item.value}
          type="button"
          variant="outline"
          size="sm"
          className="h-11 rounded-full"
          data-testid={chipTestId}
          data-step={dataStep}
          data-value={item.value}
          aria-label={item.ariaLabel}
          disabled={disabled}
          onClick={() => onSelect(item.value)}
        >
          {item.content ?? item.label}
        </Button>
      ))}
    </div>
  );
}

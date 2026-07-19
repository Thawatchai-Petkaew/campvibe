/**
 * components/ai-chat/AiChatMessageList.tsx — CAM-272 (cards layout: CAM-409;
 * follow-up suggestion chips: CAM-410)
 *
 * Renders the welcome/empty state, the running thread (user + assistant
 * turns), the typing indicator, and every notice state (zero-result,
 * rate-limited, disabled, error+retry). All 8 interactive/conversation
 * states from design.md §States live here.
 *
 * BR-4 (Critical, security): an assistant `answer` is ALWAYS rendered from
 * plain text nodes — never `dangerouslySetInnerHTML`, never markdown-to-HTML.
 * Since CAM-439, `entry.text` is split into typed blocks by `parseAnswer()`
 * (./answer-format.ts, returns strings only) and mapped to real paragraph/
 * ordered-list/unordered-list elements, which React auto-escapes; see that
 * file's own header for the full security note. Cards render ONLY from the entry's own
 * `cards[]` (never parsed out of `text`).
 *
 * CAM-409: the cards render via `AiChatCardCarousel` (horizontal snap-scroll
 * with peek) instead of the CAM-272 vertical `space-y-3` stack — see
 * design.md's addendum, which SUPERSEDES that single-column layout rule.
 *
 * CAM-410 (BR-7): follow-up-question chips render under the LATEST
 * assistant `answer` entry only, and only once that turn is no longer in
 * flight — both conditions are enforced by `showSuggestions` computed in the
 * parent map (index === last && !sending), never inside the row itself.
 * Tapping a chip reuses the exact same `onSuggestion` -> `sendMessage` path
 * as the CAM-272 welcome pills (Seams & refs — no parallel send path).
 *
 * CAM-411: every turn (user + assistant) eases in once on mount via
 * ENTRANCE_MOTION_CLASS (motion-safe, EC-1 instant under reduced-motion).
 * The welcome/empty state gains a hero avatar + a labelled examples block;
 * the 3 pills bump from h-9 to h-11 (BR-5, 44px tap target).
 *
 * CAM-430 (message-layout follow-up, owner staging feedback — SUPERSEDES the
 * CAM-411 per-row avatar): the shared `AiChatAvatar` no longer renders next
 * to every individual assistant-side row (answer/typing/notices) — dropping
 * it gives the answer text the full row width instead of `[avatar][body]`.
 * The assistant identity still lives in the panel HEADER (AiChatPanel.tsx,
 * untouched here) plus the CAM-425 centered resuming avatar and the
 * welcome-state hero avatar below — both kept unchanged. Every bot-side
 * bubble/notice is now `w-full` (was capped to the narrower chat-bubble
 * width, sized to leave room for the avatar that no longer exists); the
 * USER bubble keeps its own narrower chat-bubble cap unchanged. User vs
 * assistant stays distinguished by side + fill (never hue alone —
 * DESIGN.md §color-rules).
 * The in-chat card carousel + follow-up chips get their own `pl-4` so their
 * left edge lines up with the bubble's own `px-4` text inset (was flush at
 * the row's true left edge, CAM-409's `-mx-4/px-4` panel-edge bleed on the
 * carousel's OWN track is untouched and still gives the peek/scroll clip its
 * edge-to-edge feel — only the SETTLED position moved right to align).
 * (CAM-439 SUPERSEDES this `pl-4`: once the bubble/its `px-4` inset is gone,
 * the `pl-4` is dropped too — see the CAM-439 note below.)
 *
 * CAM-425: the CAM-423 resuming indicator (a bare top-left inline spinner)
 * is replaced by a centered, on-brand treatment — the shared `AiChatAvatar`,
 * positioned as `absolute inset-0` centered inside the ScrollArea (which is
 * already `position: relative` — components/ui/scroll-area.tsx). An absolute
 * overlay sizes off the ScrollArea Root's actual rendered box regardless of
 * Radix's internal `display: table` Viewport wrapper, where a plain
 * percentage height (`h-full`) would not reliably resolve (same class of
 * issue as CAM-407). Same aria-busy/role=status/aria-live=polite contract.
 *
 * CAM-433 (owner staging feedback C, SUPERSEDES CAM-425's generic
 * `motion-safe:animate-pulse` wrapper + VISIBLE loading label): the centered
 * indicator is now the น้องกองไฟ flame itself flickering — `AiChatAvatar`
 * already carries its own on-brand `ai-flame-flicker` aura + `ai-flame-glow`
 * icon pulse internally (CAM-432), both already static under
 * `prefers-reduced-motion` (gated in globals.css), so no extra wrapper
 * animation is layered on top. The Thai `t.aiChat.loading` label is now
 * `sr-only` — still announced to screen readers via the unchanged
 * role=status/aria-live=polite/aria-busy contract, just no longer painted
 * on screen.
 *
 * CAM-435 (R2 owner staging feedback): this resuming avatar is the one
 * genuinely-loading surface, so it explicitly passes
 * `intensity="loading"` to keep the strong `ai-flame-flicker` aura here
 * (owner: intense flicker is fine while loading) — `AiChatAvatar` now
 * defaults to a gentler `ai-flame-glow` aura everywhere else (persistent
 * header/launcher marks).
 *
 * CAM-426 (DESIGN.md §2.1 sanctioned exception): every assistant-side bubble
 * (answer, typing, rate-limited, disabled) recolors `bg-muted` → `bg-ai-tint`
 * (still paired with `text-foreground`, AA by token parity — see design.md
 * §1 contrast honesty). The user bubble stays `bg-primary`/
 * `text-primary-foreground` — unchanged, still distinguished by side + fill,
 * never hue alone.
 *
 * CAM-439 (R2 owner staging feedback, SUPERSEDES the CAM-426 answer-row tint
 * + the CAM-430 cards/chips `pl-4`): the `bg-ai-tint` bubble is dropped for
 * the ANSWER text only — it read cluttered on staging. The answer now
 * renders as plain `text-foreground` directly on the panel's own
 * `bg-ai-surface` glass (DESIGN.md §2.1 item 5, amended — see this story's
 * design.md). `bg-ai-tint` is RETAINED on the typing/rate-limited/disabled
 * notice chips below (system notices still benefit from a container) and on
 * `ErrorBanner`. Answer text also now parses through `parseAnswer()`
 * (./answer-format.ts) into typed blocks so a numbered/bulleted answer
 * renders as a real ordered/unordered list instead of one run-on paragraph —
 * see BR-4 there for why this returns strings only, never markup. The cards
 * carousel + suggestion chips lose their CAM-430 `pl-4` (it only existed to
 * match the now-removed bubble's `px-4` inset) so everything left-aligns at
 * the log's own `p-4` edge.
 */
"use client";

import { Clock, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ErrorBanner } from "@/components/ui/error-banner";
import { useLanguage } from "@/contexts/LanguageContext";
import { AiChatCardCarousel } from "@/components/ai-chat/AiChatCardCarousel";
import { AiChatAvatar } from "@/components/ai-chat/AiChatAvatar";
import { parseAnswer } from "@/components/ai-chat/answer-format";
import type { ChatEntry } from "@/components/ai-chat/conversation";

const SUGGESTION_KEYS = ["suggestion1", "suggestion2", "suggestion3"] as const;

/** BR-3: transform+opacity only, ~200ms, motion-safe (EC-1 instant under prefers-reduced-motion). */
const ENTRANCE_MOTION_CLASS =
  "motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 motion-safe:duration-200";

interface AiChatMessageListProps {
  entries: ChatEntry[];
  sending: boolean;
  /** CAM-423 — the camper's latest conversation is being fetched on open (loading.md inline indicator, not a skeleton). */
  resuming: boolean;
  onSuggestion: (text: string) => void;
  onRetry: () => void;
}

export function AiChatMessageList({ entries, sending, resuming, onSuggestion, onRetry }: AiChatMessageListProps) {
  const { t } = useLanguage();
  const lastEntry = entries[entries.length - 1];
  // CAM-412 BR-8: once the streaming entry exists, IT is the in-flight
  // affordance (growing text + caret) — the generic typing dots below would
  // be redundant alongside it.
  const lastIsStreaming = lastEntry?.role === "assistant" && lastEntry.kind === "streaming";

  return (
    <div
      role="log"
      aria-live="polite"
      aria-relevant="additions"
      aria-busy={sending}
      data-testid="log--ai-chat-messages"
      className="flex flex-col gap-3 p-4"
    >
      {resuming && (
        // CAM-425 — fetching the camper's latest conversation on open; now
        // centered (not top-left) via an absolute overlay sized off the
        // ScrollArea's own box (which is `position: relative`). Its own
        // scoped aria-busy + role=status/aria-live=polite (loading.md §5) —
        // the outer log's aria-busy stays tied to `sending` only.
        <div
          role="status"
          aria-live="polite"
          aria-busy={resuming}
          data-testid="status--ai-chat-resuming"
          className="absolute inset-0 flex flex-col items-center justify-center"
        >
          <AiChatAvatar size="lg" intensity="loading" />
          <span className="sr-only">{t.aiChat.loading}</span>
        </div>
      )}

      {!resuming && entries.length === 0 && (
        <div data-testid="empty--ai-chat-welcome" className="space-y-4 py-2">
          <div className="flex flex-col items-start gap-3">
            <AiChatAvatar size="lg" />
            <p className="text-sm font-medium text-foreground">{t.aiChat.welcomeHeading}</p>
          </div>
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">{t.aiChat.welcomeExamplesLabel}</p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTION_KEYS.map((key) => (
                <Button
                  key={key}
                  type="button"
                  variant="outline"
                  size="default"
                  className="rounded-full motion-safe:active:scale-95"
                  data-testid="btn--ai-chat-suggestion"
                  onClick={() => onSuggestion(t.aiChat[key])}
                >
                  {t.aiChat[key]}
                </Button>
              ))}
            </div>
          </div>
        </div>
      )}

      {entries.map((entry, index) => (
        <AiChatEntryRow
          key={entry.id}
          entry={entry}
          onRetry={onRetry}
          onSuggestion={onSuggestion}
          showSuggestions={!sending && index === entries.length - 1}
        />
      ))}

      {sending && !lastIsStreaming && (
        <div
          data-testid="status--ai-chat-typing"
          className={`flex w-full items-center gap-1 rounded-2xl bg-ai-tint px-4 py-2.5 ${ENTRANCE_MOTION_CLASS}`}
        >
          <span className="sr-only">{t.aiChat.typing}</span>
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              aria-hidden="true"
              style={{ animationDelay: `${i * 150}ms` }}
              className="size-1.5 rounded-full bg-muted-foreground motion-safe:animate-pulse"
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface AiChatEntryRowProps {
  entry: ChatEntry;
  onRetry: () => void;
  onSuggestion: (text: string) => void;
  /** CAM-410 BR-7: true only for the newest entry while no turn is in flight. */
  showSuggestions: boolean;
}

function AiChatEntryRow({ entry, onRetry, onSuggestion, showSuggestions }: AiChatEntryRowProps) {
  const { t } = useLanguage();

  if (entry.role === "user") {
    return (
      <div
        data-testid="msg--ai-chat-user"
        className={`max-w-[85%] self-end rounded-2xl bg-primary px-4 py-2.5 text-sm text-primary-foreground ${ENTRANCE_MOTION_CLASS}`}
      >
        <p className="whitespace-pre-wrap">{entry.text}</p>
      </div>
    );
  }

  if (entry.kind === "streaming") {
    // CAM-412 (BR-8) — the growing answer text; a caret marks the in-flight
    // affordance until the turn settles (into a normal "answer" entry, which
    // is what actually renders cards/chips — never here). The whole row is
    // `aria-hidden` while growing so the shared `role="log" aria-live="polite"`
    // wrapper does NOT announce every delta mutation (BR-8: settled answer is
    // announced ONCE, as a normal DOM addition, the instant this row is
    // replaced by the finalized entry). The caret itself is decorative +
    // respects `prefers-reduced-motion` via the existing `motion-safe:` gate.
    const blocks = parseAnswer(entry.text);
    const lastBlockIndex = blocks.length - 1;
    const caret = (
      <span
        data-testid="caret--ai-chat-streaming"
        className="ml-0.5 inline-block h-4 w-0.5 align-middle bg-muted-foreground motion-safe:animate-pulse"
      />
    );
    return (
      <div
        aria-hidden="true"
        data-testid="msg--ai-chat-streaming"
        className={`w-full space-y-2 self-start text-sm leading-relaxed text-foreground ${ENTRANCE_MOTION_CLASS}`}
      >
        {blocks.length === 0 && <p className="whitespace-pre-wrap">{caret}</p>}
        {blocks.map((block, i) =>
          block.type === "ordered-list" ? (
            <ol key={i} className="list-decimal space-y-1 pl-5 marker:text-muted-foreground">
              {block.items.map((item, j) => (
                <li key={j}>
                  {item}
                  {i === lastBlockIndex && j === block.items.length - 1 && caret}
                </li>
              ))}
            </ol>
          ) : block.type === "unordered-list" ? (
            <ul key={i} className="list-disc space-y-1 pl-5 marker:text-muted-foreground">
              {block.items.map((item, j) => (
                <li key={j}>
                  {item}
                  {i === lastBlockIndex && j === block.items.length - 1 && caret}
                </li>
              ))}
            </ul>
          ) : (
            <p key={i} className="whitespace-pre-wrap">
              {block.text}
              {i === lastBlockIndex && caret}
            </p>
          )
        )}
      </div>
    );
  }

  if (entry.kind === "answer") {
    // CAM-410 AC-3/AC-4/AC-5/BR-7: only the newest, non-in-flight answer ever
    // shows its chips; every other answer's `suggestions[]` is ignored here.
    const suggestions = showSuggestions ? (entry.suggestions ?? []) : [];
    return (
      // CAM-430: the avatar is gone (BR-4/CAM-411 SUPERSEDED) so the answer
      // row is now w-full (was capped to the narrower chat-bubble width, a
      // cap sized to leave room for the avatar) — "more text space" per
      // owner staging feedback.
      // CAM-409: a single grid-cols-1 track (Tailwind's minmax(0,1fr)) — not
      // flex-col — stops the carousel's un-shrinkable track width from
      // forcing this row (and the panel) wider than the message column.
      // CAM-439: the bg-ai-tint bubble + its px-4 inset are gone (plain text
      // on the panel glass), so cards/chips drop their matching pl-4 too —
      // everything left-aligns at the log's own p-4 edge. gap-3 keeps clear
      // separation in the text -> cards -> chips stack.
      <div className={`grid w-full max-w-full min-w-0 grid-cols-1 gap-3 self-start ${ENTRANCE_MOTION_CLASS}`}>
        {/* CAM-439: bubble dropped — plain text on the panel glass (§2.1);
            list-shaped answers render as real semantic lists, never markup. */}
        <div data-testid="msg--ai-chat-assistant" className="space-y-2 text-sm leading-relaxed text-foreground">
          {/* BR-4/EC-6: parseAnswer returns strings only — mapped to React
              children, which auto-escape. No dangerouslySetInnerHTML, no
              markdown-to-HTML. */}
          {parseAnswer(entry.text).map((block, i) =>
            block.type === "ordered-list" ? (
              <ol key={i} className="list-decimal space-y-1 pl-5 marker:text-muted-foreground">
                {block.items.map((item, j) => (
                  <li key={j}>{item}</li>
                ))}
              </ol>
            ) : block.type === "unordered-list" ? (
              <ul key={i} className="list-disc space-y-1 pl-5 marker:text-muted-foreground">
                {block.items.map((item, j) => (
                  <li key={j}>{item}</li>
                ))}
              </ul>
            ) : (
              <p key={i} className="whitespace-pre-wrap">
                {block.text}
              </p>
            )
          )}
          {entry.zeroResult && (
            <p data-testid="empty--ai-chat-zero-result" className="text-muted-foreground">
              {t.aiChat.zeroResult}
            </p>
          )}
        </div>
        {entry.cards.length > 0 && <AiChatCardCarousel cards={entry.cards} />}
        {suggestions.length > 0 && (
          <div
            role="group"
            aria-label={t.aiChat.suggestedQuestionsLabel}
            data-testid="group--ai-chat-suggestion-chips"
            className="flex flex-wrap gap-2"
          >
            {suggestions.map((text) => (
              <Button
                key={text}
                type="button"
                variant="outline"
                size="sm"
                className="h-11 rounded-full motion-safe:active:scale-95"
                data-testid="btn--ai-chat-suggestion-chip"
                onClick={() => onSuggestion(text)}
              >
                {text}
              </Button>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (entry.kind === "rate-limited") {
    return (
      // CAM-430 (SUPERSEDES CAM-411 EC-2's per-notice avatar): the notice
      // fills the row now — assistant identity lives in the panel header.
      <div
        data-testid="error--ai-chat-ratelimited"
        className={`flex w-full items-center gap-2 rounded-2xl bg-ai-tint px-4 py-2.5 text-sm text-foreground ${ENTRANCE_MOTION_CLASS}`}
      >
        <Clock className="size-4 shrink-0 text-warning" aria-hidden="true" />
        <span>{t.aiChat.rateLimited}</span>
      </div>
    );
  }

  if (entry.kind === "disabled") {
    return (
      // CAM-430 (SUPERSEDES CAM-411 EC-2's per-notice avatar): same full-row
      // treatment as the rate-limited notice above.
      <div
        data-testid="info--ai-chat-disabled"
        className={`flex w-full items-center gap-2 rounded-2xl bg-ai-tint px-4 py-2.5 text-sm text-foreground ${ENTRANCE_MOTION_CLASS}`}
      >
        <Info className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span>{t.aiChat.disabled}</span>
      </div>
    );
  }

  // entry.kind === "error" — reuse ErrorBanner (destructive tone) rather than
  // re-implementing its tint inline (CAM-272 design-gate Important finding).
  // CAM-430: no more per-notice avatar wrapper — ErrorBanner + retry fill the row.
  return (
    <div className={`flex w-full flex-col gap-2 ${ENTRANCE_MOTION_CLASS}`}>
      <ErrorBanner message={t.aiChat.error} className="rounded-2xl" data-testid="error--ai-chat" />
      <Button
        type="button"
        variant="outline"
        size="sm"
        data-testid="btn--ai-chat-retry"
        onClick={onRetry}
      >
        {t.aiChat.retry}
      </Button>
    </div>
  );
}

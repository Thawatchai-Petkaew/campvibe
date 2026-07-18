/**
 * components/ai-chat/AiChatMessageList.tsx — CAM-272 (cards layout: CAM-409;
 * follow-up suggestion chips: CAM-410)
 *
 * Renders the welcome/empty state, the running thread (user + assistant
 * turns), the typing indicator, and every notice state (zero-result,
 * rate-limited, disabled, error+retry). All 8 interactive/conversation
 * states from design.md §States live here.
 *
 * BR-4 (Critical, security): an assistant `answer` is ALWAYS a plain text
 * node (`whitespace-pre-wrap`) — never `dangerouslySetInnerHTML`, never
 * markdown-to-HTML. Cards render ONLY from the entry's own `cards[]`
 * (never parsed out of `text`).
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
 * CAM-411: every assistant-side row (answer, typing, notices) now shows the
 * shared `AiChatAvatar` (size="sm") to its left via `flex items-start
 * gap-2`, and every turn (user + assistant) eases in once on mount via
 * ENTRANCE_MOTION_CLASS (motion-safe, EC-1 instant under reduced-motion).
 * The in-chat card block stays a sibling of the avatar+bubble row (never
 * indented under the avatar) — preserves CAM-407/CAM-409's full-width fix.
 * The welcome/empty state gains a hero avatar + a labelled examples block;
 * the 3 pills bump from h-9 to h-11 (BR-5, 44px tap target).
 */
"use client";

import { Clock, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ErrorBanner } from "@/components/ui/error-banner";
import { useLanguage } from "@/contexts/LanguageContext";
import { AiChatCardCarousel } from "@/components/ai-chat/AiChatCardCarousel";
import { AiChatAvatar } from "@/components/ai-chat/AiChatAvatar";
import type { ChatEntry } from "@/components/ai-chat/conversation";

const SUGGESTION_KEYS = ["suggestion1", "suggestion2", "suggestion3"] as const;

/** BR-3: transform+opacity only, ~200ms, motion-safe (EC-1 instant under prefers-reduced-motion). */
const ENTRANCE_MOTION_CLASS =
  "motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 motion-safe:duration-200";

interface AiChatMessageListProps {
  entries: ChatEntry[];
  sending: boolean;
  onSuggestion: (text: string) => void;
  onRetry: () => void;
}

export function AiChatMessageList({ entries, sending, onSuggestion, onRetry }: AiChatMessageListProps) {
  const { t } = useLanguage();

  return (
    <div
      role="log"
      aria-live="polite"
      aria-relevant="additions"
      aria-busy={sending}
      data-testid="log--ai-chat-messages"
      className="flex flex-col gap-3 p-4"
    >
      {entries.length === 0 && (
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

      {sending && (
        <div className={`flex items-start gap-2 self-start ${ENTRANCE_MOTION_CLASS}`}>
          <AiChatAvatar size="sm" />
          <div
            data-testid="status--ai-chat-typing"
            className="flex max-w-[85%] items-center gap-1 rounded-2xl bg-muted px-4 py-2.5"
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

  if (entry.kind === "answer") {
    // CAM-410 AC-3/AC-4/AC-5/BR-7: only the newest, non-in-flight answer ever
    // shows its chips; every other answer's `suggestions[]` is ignored here.
    const suggestions = showSuggestions ? (entry.suggestions ?? []) : [];
    return (
      // CAM-407: only the text bubble is a chat-bubble width (max-w-[85%]);
      // the row itself + the cards stay w-full max-w-full so an in-chat
      // campsite card is never squeezed narrower than the panel/list column.
      // CAM-409: a single grid-cols-1 track (Tailwind's minmax(0,1fr)) — not
      // flex-col — stops the carousel's un-shrinkable track width from
      // forcing this row (and the panel) wider than the message column.
      <div className={`grid w-full max-w-full min-w-0 grid-cols-1 gap-2 self-start ${ENTRANCE_MOTION_CLASS}`}>
        <div className="flex items-start gap-2">
          <AiChatAvatar size="sm" />
          <div
            data-testid="msg--ai-chat-assistant"
            className="max-w-[85%] rounded-2xl bg-muted px-4 py-2.5 text-sm text-foreground"
          >
            {/* BR-4/EC-6: plain text node only — no dangerouslySetInnerHTML, no markdown-to-HTML. */}
            <p className="whitespace-pre-wrap">{entry.text}</p>
            {entry.zeroResult && (
              <p data-testid="empty--ai-chat-zero-result" className="mt-1 text-muted-foreground">
                {t.aiChat.zeroResult}
              </p>
            )}
          </div>
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
      // CAM-411 EC-2: every notice bubble carries the avatar for identity consistency.
      <div className={`flex items-start gap-2 self-start ${ENTRANCE_MOTION_CLASS}`}>
        <AiChatAvatar size="sm" />
        <div
          data-testid="error--ai-chat-ratelimited"
          className="flex max-w-[85%] items-center gap-2 rounded-2xl bg-muted px-4 py-2.5 text-sm text-foreground"
        >
          <Clock className="size-4 shrink-0 text-warning" aria-hidden="true" />
          <span>{t.aiChat.rateLimited}</span>
        </div>
      </div>
    );
  }

  if (entry.kind === "disabled") {
    return (
      // CAM-411 EC-2: name-voiced disabled copy still shows the avatar.
      <div className={`flex items-start gap-2 self-start ${ENTRANCE_MOTION_CLASS}`}>
        <AiChatAvatar size="sm" />
        <div
          data-testid="info--ai-chat-disabled"
          className="flex max-w-[85%] items-center gap-2 rounded-2xl bg-muted px-4 py-2.5 text-sm text-foreground"
        >
          <Info className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span>{t.aiChat.disabled}</span>
        </div>
      </div>
    );
  }

  // entry.kind === "error" — reuse ErrorBanner (destructive tone) rather than
  // re-implementing its tint inline (CAM-272 design-gate Important finding).
  return (
    <div className={`flex items-start gap-2 self-start ${ENTRANCE_MOTION_CLASS}`}>
      <AiChatAvatar size="sm" />
      <div className="flex max-w-[85%] flex-col gap-2">
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
    </div>
  );
}

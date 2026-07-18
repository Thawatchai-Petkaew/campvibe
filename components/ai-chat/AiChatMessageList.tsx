/**
 * components/ai-chat/AiChatMessageList.tsx — CAM-272 (cards layout: CAM-409)
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
 */
"use client";

import { Clock, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ErrorBanner } from "@/components/ui/error-banner";
import { useLanguage } from "@/contexts/LanguageContext";
import { AiChatCardCarousel } from "@/components/ai-chat/AiChatCardCarousel";
import type { ChatEntry } from "@/components/ai-chat/conversation";

const SUGGESTION_KEYS = ["suggestion1", "suggestion2", "suggestion3"] as const;

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
        <div data-testid="empty--ai-chat-welcome" className="space-y-3 py-2">
          <p className="text-sm font-medium text-foreground">{t.aiChat.welcomeHeading}</p>
          <div className="flex flex-wrap gap-2">
            {SUGGESTION_KEYS.map((key) => (
              <Button
                key={key}
                type="button"
                variant="outline"
                size="sm"
                className="rounded-full motion-safe:active:scale-95"
                data-testid="btn--ai-chat-suggestion"
                onClick={() => onSuggestion(t.aiChat[key])}
              >
                {t.aiChat[key]}
              </Button>
            ))}
          </div>
        </div>
      )}

      {entries.map((entry) => (
        <AiChatEntryRow key={entry.id} entry={entry} onRetry={onRetry} />
      ))}

      {sending && (
        <div
          data-testid="status--ai-chat-typing"
          className="flex max-w-[85%] items-center gap-1 self-start rounded-2xl bg-muted px-4 py-2.5"
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

function AiChatEntryRow({ entry, onRetry }: { entry: ChatEntry; onRetry: () => void }) {
  const { t } = useLanguage();

  if (entry.role === "user") {
    return (
      <div
        data-testid="msg--ai-chat-user"
        className="max-w-[85%] self-end rounded-2xl bg-primary px-4 py-2.5 text-sm text-primary-foreground"
      >
        <p className="whitespace-pre-wrap">{entry.text}</p>
      </div>
    );
  }

  if (entry.kind === "answer") {
    return (
      // CAM-407: only the text bubble is a chat-bubble width (max-w-[85%]);
      // the row itself + the cards stay w-full max-w-full so an in-chat
      // campsite card is never squeezed narrower than the panel/list column.
      // CAM-409: a single grid-cols-1 track (Tailwind's minmax(0,1fr)) — not
      // flex-col — stops the carousel's un-shrinkable track width from
      // forcing this row (and the panel) wider than the message column.
      <div className="grid w-full max-w-full min-w-0 grid-cols-1 gap-2 self-start">
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
        {entry.cards.length > 0 && <AiChatCardCarousel cards={entry.cards} />}
      </div>
    );
  }

  if (entry.kind === "rate-limited") {
    return (
      <div
        data-testid="error--ai-chat-ratelimited"
        className="flex max-w-[85%] items-center gap-2 self-start rounded-2xl bg-muted px-4 py-2.5 text-sm text-foreground"
      >
        <Clock className="size-4 shrink-0 text-warning" aria-hidden="true" />
        <span>{t.aiChat.rateLimited}</span>
      </div>
    );
  }

  if (entry.kind === "disabled") {
    return (
      <div
        data-testid="info--ai-chat-disabled"
        className="flex max-w-[85%] items-center gap-2 self-start rounded-2xl bg-muted px-4 py-2.5 text-sm text-foreground"
      >
        <Info className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span>{t.aiChat.disabled}</span>
      </div>
    );
  }

  // entry.kind === "error" — reuse ErrorBanner (destructive tone) rather than
  // re-implementing its tint inline (CAM-272 design-gate Important finding).
  return (
    <div className="flex max-w-[85%] flex-col gap-2 self-start">
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

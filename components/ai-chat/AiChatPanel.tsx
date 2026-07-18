/**
 * components/ai-chat/AiChatPanel.tsx — CAM-272
 *
 * The chat overlay itself — mobile: a full-width bottom sheet (~85dvh);
 * desktop (sm:+): an anchored bottom-right floating card (~384px, viewport-
 * bounded height). One Radix Dialog tree, responsive via Tailwind `sm:`
 * only (no separate mobile/desktop mount, no media-query hook) — see
 * design.md §Components ("Mobile overlay: Sheet" / "Desktop overlay:
 * anchored Card panel via Dialog"). Built on `Dialog`/`DialogPortal`/
 * `DialogOverlay` (components/ui/dialog.tsx) + a bespoke `Content` (the
 * shared `DialogContent`'s baked centered/`sm:max-w-md` classes don't fit a
 * bottom-anchored responsive panel; `components/ui/sheet.tsx`'s `Portal`/
 * `Overlay` aren't exported) — both wrap the identical radix `Dialog`
 * primitive, so this is the same underlying component, not a new one.
 *
 * a11y (BR-7): Radix `Dialog.Content` already provides the focus trap, Esc
 * close, outside-dismiss, and focus-restore-to-trigger natively — CAM-368's
 * `useModalA11y` hook (built for the hand-rolled, non-Radix photo modals) is
 * intentionally NOT layered on top here; doing so would double-handle the
 * same Tab/Escape behaviour Radix already owns.
 */
"use client";

import { useRef, useState } from "react";
import { Dialog as PanelPrimitive } from "radix-ui";
import { Send, X } from "lucide-react";
import { Dialog, DialogPortal, DialogOverlay } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAiChat } from "@/components/ai-chat/use-ai-chat";
import { AiChatMessageList } from "@/components/ai-chat/AiChatMessageList";
import { isSendableQuestion } from "@/components/ai-chat/conversation";

interface AiChatPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AiChatPanel({ open, onOpenChange }: AiChatPanelProps) {
  const { t } = useLanguage();
  const { entries, sending, disabled, sendMessage, retryLast } = useAiChat();
  const [draft, setDraft] = useState("");
  const composerRef = useRef<HTMLTextAreaElement>(null);

  const canSend = !sending && !disabled && isSendableQuestion(draft);

  function handleSend() {
    if (!canSend) return;
    const text = draft;
    setDraft("");
    void sendMessage(text);
  }

  function handleSuggestion(text: string) {
    if (sending || disabled) return;
    setDraft("");
    void sendMessage(text);
  }

  function handleComposerKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay />
        <PanelPrimitive.Content
          data-slot="ai-chat-panel"
          data-testid="dialog--ai-chat-panel"
          aria-label={t.aiChat.title}
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            composerRef.current?.focus();
          }}
          className={cn(
            "fixed inset-x-0 bottom-0 z-50 flex h-[85dvh] max-h-[85dvh] flex-col overflow-hidden rounded-t-3xl border-t border-border bg-popover shadow-2xl outline-none",
            "duration-200 data-open:animate-in data-open:slide-in-from-bottom-10 data-closed:animate-out data-closed:slide-out-to-bottom-10",
            "motion-reduce:data-open:animate-none motion-reduce:data-closed:animate-none",
            "sm:inset-x-auto sm:inset-y-auto sm:left-auto sm:top-auto sm:right-6 sm:bottom-24 sm:h-auto sm:max-h-[min(37.5rem,80dvh)] sm:w-96 sm:rounded-3xl sm:border sm:border-border/60"
          )}
        >
          <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
            <p className="font-heading text-base font-medium text-foreground">{t.aiChat.title}</p>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={t.aiChat.close}
              data-testid="btn--ai-chat-close"
              onClick={() => onOpenChange(false)}
            >
              <X className="size-5" aria-hidden="true" />
            </Button>
          </div>

          <ScrollArea className="min-h-0 flex-1">
            <AiChatMessageList entries={entries} sending={sending} onSuggestion={handleSuggestion} onRetry={retryLast} />
          </ScrollArea>

          <div className="border-t border-border/60 p-4">
            <div className="flex items-end gap-2">
              <Textarea
                ref={composerRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={handleComposerKeyDown}
                placeholder={t.aiChat.composerPlaceholder}
                aria-label={t.aiChat.composerPlaceholder}
                disabled={sending || disabled}
                rows={1}
                className="max-h-32"
                data-testid="input--ai-chat-composer"
              />
              <Button
                type="button"
                size="icon"
                className="h-11 w-11 shrink-0 rounded-full motion-safe:active:scale-95"
                aria-label={t.aiChat.send}
                data-testid="btn--ai-chat-send"
                disabled={!canSend}
                onClick={handleSend}
              >
                {sending ? (
                  <LoadingSpinner size="sm" className="h-auto w-auto gap-0" />
                ) : (
                  <Send className="size-4" aria-hidden="true" />
                )}
              </Button>
            </div>
          </div>
        </PanelPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}

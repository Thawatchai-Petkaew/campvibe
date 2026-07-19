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
 *
 * CAM-411: the header title paragraph becomes an identity cluster
 * (`AiChatAvatar` + a two-line name/role stack, design.md §Visual polish);
 * the panel `aria-label` composes `{name} {role}` so a screen reader
 * announces the full identity on open (BR-1, a11y).
 *
 * CAM-425: the CAM-423 '+' new-chat button is hidden (single-thread) — a
 * camper always resumes/continues the ONE thread; a conversation switcher
 * lands in a later story. `startNewChat` stays in `use-ai-chat.ts`
 * (unreferenced here) so that later story can wire it back in.
 *
 * CAM-426 (DESIGN.md §2.1 sanctioned exception): the panel becomes the
 * น้องกองไฟ glass surface — `bg-ai-surface backdrop-blur-xl shadow-ai-glow`
 * (replacing the flat `bg-popover shadow-2xl`) with a campfire-night ambient
 * backdrop (`.ai-aurora` + `AiAmbientCanvas`, both `aria-hidden` +
 * `pointer-events-none`, stacked `-z-10`) behind a `relative z-10` readable
 * wrapper. Readability is the hard constraint (design.md §6): every existing
 * child (header/list/composer) still renders on its own opaque/tokened
 * surface, so this only changes the panel's own shell, never the content.
 * `AiAmbientCanvas` is `next/dynamic(ssr:false)` — same lazy idiom as this
 * panel's own mount in `AiChatLauncher.tsx` — so it never enters the
 * critical first-load chunk.
 *
 * CAM-429 (owner staging feedback): three shell fixes.
 *  1. No background dim — `DialogOverlay` renders `bg-transparent` (kept in
 *     the tree, not removed) so Radix's modal internals — RemoveScroll body
 *     scroll-lock, `hideOthers` aria-hiding of siblings — stay wired; the
 *     focus trap, outside-pointer dismiss, and Esc dismiss are already driven
 *     by `Dialog.Content`'s own `DismissableLayer`/`FocusScope` independent of
 *     the Overlay's visual style (verified against `@radix-ui/react-dialog`
 *     source: `disableOutsidePointerEvents`/`trapFocus`/`onDismiss` all live
 *     on Content, not Overlay) — only the visible scrim disappears.
 *  2. Expand-to-full-page — a header toggle (`Maximize2`/`Minimize2`) grows
 *     the panel to a near-full-page centered surface (`inset-2`/`sm:inset-6`,
 *     still `rounded-3xl` + the glass shell) or restores the bottom-sheet/
 *     anchored-card size. `expanded` persists in `sessionStorage` so the next
 *     open (same tab) restores the last size; the message list, composer, and
 *     `useAiChat` state are untouched by the toggle (no remount).
 *  3. Desktop anchor resets from `sm:bottom-24` to `sm:bottom-6` — matching
 *     `AiChatLauncher`'s own reset back to its natural `bottom-6 right-6`
 *     (the FAB collision is now resolved by moving `HostOnboardingFab` to the
 *     left instead, so the launcher no longer needs to dodge upward).
 */
"use client";

import { useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Dialog as PanelPrimitive } from "radix-ui";
import { Maximize2, Minimize2, Send, X } from "lucide-react";
import { Dialog, DialogPortal, DialogOverlay } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAiChat } from "@/components/ai-chat/use-ai-chat";
import { AiChatMessageList } from "@/components/ai-chat/AiChatMessageList";
import { AiChatAvatar } from "@/components/ai-chat/AiChatAvatar";
import { isSendableQuestion } from "@/components/ai-chat/conversation";

const AiAmbientCanvas = dynamic(
  () => import("@/components/ai-chat/AiAmbientCanvas").then((m) => ({ default: m.AiAmbientCanvas })),
  { ssr: false, loading: () => null }
);

interface AiChatPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// CAM-429: "persist within the session" = this browser tab's sessionStorage —
// survives close/reopen (and a reload) without carrying the choice across a
// brand-new visit. Read/write never throw (privacy mode / quota): a failure
// just falls back to in-memory-only for the current open, per EC-1.
const EXPANDED_STORAGE_KEY = "ai-chat-expanded";

function readExpandedFromStorage(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.sessionStorage.getItem(EXPANDED_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function writeExpandedToStorage(value: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(EXPANDED_STORAGE_KEY, value ? "1" : "0");
  } catch {
    // ignore — expand/collapse still works for this open, just not persisted
  }
}

export function AiChatPanel({ open, onOpenChange }: AiChatPanelProps) {
  const { t } = useLanguage();
  const { entries, sending, disabled, resuming, sendMessage, retryLast } = useAiChat();
  const [draft, setDraft] = useState("");
  const [expanded, setExpanded] = useState(() => readExpandedFromStorage());
  const composerRef = useRef<HTMLTextAreaElement>(null);

  // CAM-423: the composer stays disabled while `resuming` too — a message
  // sent before the resumed conversationId lands would create a stray NEW
  // conversation instead of continuing the one being restored.
  const canSend = !sending && !disabled && !resuming && isSendableQuestion(draft);

  function handleSend() {
    if (!canSend) return;
    const text = draft;
    setDraft("");
    void sendMessage(text);
  }

  function toggleExpanded() {
    setExpanded((prev) => {
      const next = !prev;
      writeExpandedToStorage(next);
      return next;
    });
  }

  function handleSuggestion(text: string) {
    if (sending || disabled || resuming) return;
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
        {/* CAM-429: transparent, not removed — Radix's RemoveScroll/hideOthers/
            focus-trap/outside-dismiss/Esc-dismiss all stay wired (they live on
            Dialog.Content's DismissableLayer, independent of the Overlay's
            visual style); only the dark scrim over the page disappears. */}
        <DialogOverlay className="bg-transparent" />
        <PanelPrimitive.Content
          data-slot="ai-chat-panel"
          data-testid="dialog--ai-chat-panel"
          aria-label={`${t.aiChat.name} ${t.aiChat.role}`}
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            composerRef.current?.focus();
          }}
          className={cn(
            "fixed z-50 flex flex-col overflow-hidden bg-ai-surface shadow-ai-glow outline-none backdrop-blur-xl",
            "motion-reduce:data-open:animate-none motion-reduce:data-closed:animate-none",
            // CAM-429: expanded = a near-full-page centered surface (safe
            // insets on every side, still rounded + glass); collapsed = the
            // CAM-407 fixed-size bottom-sheet/anchored-card (unchanged sizing,
            // only the desktop anchor moved sm:bottom-24 -> sm:bottom-6 to
            // match AiChatLauncher's reset position).
            expanded
              ? "inset-2 rounded-3xl border border-border/60 duration-200 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 sm:inset-6"
              : cn(
                  "inset-x-0 bottom-0 h-[85dvh] max-h-[85dvh] rounded-t-3xl border-t border-border",
                  "duration-200 data-open:animate-in data-open:slide-in-from-bottom-10 data-closed:animate-out data-closed:slide-out-to-bottom-10",
                  // CAM-407: the previous desktop height was auto + capped by a
                  // max-height only — a flex item's height that comes purely
                  // from flex-grow (no CSS `height` length) is NOT a "definite
                  // size" per the CSS spec, so ScrollArea's inner Viewport
                  // (`height: 100%`) failed to resolve against it and grew to
                  // fit content instead of scrolling, spilling messages under
                  // the pinned composer (proved via Playwright: Viewport
                  // measured 4463px tall vs. its 432px flex box). A single
                  // fixed `h-[...]` gives every descendant a definite height
                  // to resolve percentages against.
                  "sm:inset-x-auto sm:inset-y-auto sm:left-auto sm:top-auto sm:right-6 sm:bottom-6 sm:h-[min(37.5rem,80dvh)] sm:w-96 sm:rounded-3xl sm:border sm:border-border/60"
                )
          )}
        >
          {/* CAM-426: campfire-night ambient backdrop — decorative, behind every
              reading region (DESIGN.md §2.1). The glass shell above
              (bg-ai-surface + backdrop-blur-xl) plus each child's own opaque
              surface keep text legible over it; never a wash over content. */}
          <div className="ai-aurora ai-aurora-drift pointer-events-none absolute inset-0 -z-10" aria-hidden="true" />
          <AiAmbientCanvas />

          <div className="relative z-10 flex h-full min-h-0 flex-col">
            <div className="flex shrink-0 items-center justify-between border-b border-border/60 px-4 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <AiChatAvatar size="md" />
                <div className="min-w-0">
                  <p className="truncate font-heading text-base font-medium leading-tight text-foreground">
                    {t.aiChat.name}
                  </p>
                  <p className="truncate text-xs leading-tight text-muted-foreground">{t.aiChat.role}</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={expanded ? t.aiChat.collapse : t.aiChat.expand}
                  data-testid="btn--ai-chat-expand-toggle"
                  onClick={toggleExpanded}
                >
                  {expanded ? (
                    <Minimize2 className="size-5" aria-hidden="true" />
                  ) : (
                    <Maximize2 className="size-5" aria-hidden="true" />
                  )}
                </Button>
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
            </div>

            <ScrollArea className="min-h-0 flex-1">
              <AiChatMessageList
                entries={entries}
                sending={sending}
                resuming={resuming}
                onSuggestion={handleSuggestion}
                onRetry={retryLast}
              />
            </ScrollArea>

            <div className="shrink-0 border-t border-border/60 p-4">
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
          </div>
        </PanelPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}

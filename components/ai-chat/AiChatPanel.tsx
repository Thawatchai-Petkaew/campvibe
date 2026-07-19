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
 *     the tree, not removed) — only the visible scrim disappears; the
 *     dismiss/focus wiring is unaffected by the Overlay's visual style
 *     either way (see CAM-440 below for how it's actually driven now).
 *  2. Expand-to-full-page — a header toggle (`Maximize2`/`Minimize2`) grows
 *     the panel; the full-screen shape itself is CAM-431 (below). `expanded`
 *     persists in `sessionStorage` so the next open (same tab) restores the
 *     last size; the message list, composer, and `useAiChat` state are
 *     untouched by the toggle (no remount).
 *  3. Desktop anchor resets from `sm:bottom-24` to `sm:bottom-6` — matching
 *     `AiChatLauncher`'s own reset back to its natural `bottom-6 right-6`
 *     (the FAB collision is now resolved by moving `HostOnboardingFab` to the
 *     left instead, so the launcher no longer needs to dodge upward).
 *
 * CAM-431 (owner staging feedback): the CAM-429 `expanded` state becomes a
 * TRUE full-screen immersive surface instead of a near-full-page card.
 *  - `inset-0`, no `rounded-3xl`/border at the outer edge — the campfire-night
 *    ambient (`.ai-aurora` + `AiAmbientCanvas`, already mounted below) fills
 *    edge-to-edge as the backdrop; the glass shell itself (`bg-ai-surface` +
 *    `backdrop-blur-xl` + `shadow-ai-glow`) still applies (DESIGN.md §2.1
 *    items 3-4 bind regardless of geometry).
 *  - Reading + composing centers in a `max-w-2xl`/`sm:max-w-3xl` column with
 *    side gutters (room reserved for a future side panel, owner note) instead
 *    of stretching edge-to-edge.
 *  - The composer becomes a floating `rounded-full` glass dock (glow + a
 *    subtle teal→sky gradient accent) instead of the collapsed bordered
 *    full-width bar; the header loses its border and the expand/close
 *    buttons group into a soft floating pill.
 *  - Every element below is the SAME node in both branches — only
 *    `className` forks on `expanded` (no conditional mount/unmount) — so the
 *    toggle still never remounts `useAiChat`, the thread, or the composer
 *    draft (extends the CAM-429 no-remount guarantee). Collapsed is
 *    byte-for-byte the pre-CAM-431 layout.
 *
 * CAM-440 (BUG, owner report): "a big sidebar suddenly appeared on the right
 * of the whole website". Root cause — this Dialog was a default-MODAL Radix
 * dialog, so opening it mounted `RemoveScroll`, which locks body scroll by
 * injecting `body{padding-right + margin-right:<scrollbarWidth>px !important}`
 * — a blank band down the right edge of the ENTIRE page + all content
 * shifting left, independent of the CAM-429 transparent overlay above.
 * CAM-434 (launcher mounted on every page) made it a site-wide symptom.
 * Fix: `<Dialog modal={false}>` below. This is a floating, non-intrusive
 * assistant — it must never lock page scroll or shift layout. Trade-off
 * (intentional): no focus TRAP (Tab can leave the panel) and no background
 * `hideOthers` aria-hiding; Esc-dismiss, outside-pointer-dismiss, and
 * `onOpenChange(false)` all keep working unchanged (Radix's
 * `DismissableLayer`/`FocusScope` on `Dialog.Content` don't depend on `modal`).
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
    <Dialog open={open} onOpenChange={onOpenChange} modal={false}>
      <DialogPortal>
        {/* CAM-429: transparent, not removed — only the dark scrim over the
            page disappears; the Esc-dismiss/outside-dismiss/focus-on-open
            wiring below lives on Dialog.Content's DismissableLayer/FocusScope,
            independent of the Overlay's visual style either way.
            CAM-440 (BUG): `modal={false}` above is the actual fix — a default
            MODAL Radix Dialog mounts RemoveScroll, which injects
            `body{padding-right + margin-right:<scrollbarWidth>px !important}`
            on open (Radix's own scroll-lock, unrelated to this Overlay's
            opacity) — that's the blank band down the right edge of the WHOLE
            page + content shift the owner reported. CAM-434 (launcher on
            every page) made the site-wide symptom visible everywhere, not
            just this panel. `modal={false}` removes RemoveScroll + `hideOthers`
            entirely: no body scroll-lock, no aria-hiding of siblings, no
            focus TRAP (focus can leave the panel via Tab) — a deliberate
            trade-off for a non-intrusive floating assistant that must never
            perturb the rest of the page (matches the owner's "no overlay"
            intent from CAM-429). Esc-dismiss, outside-pointer-dismiss, and
            onOpenChange(false) are unaffected — verified against
            @radix-ui/react-dialog source: those live on Content's
            DismissableLayer regardless of `modal`. */}
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
            // CAM-431: expanded = TRUE full-screen (inset-0, no rounded/
            // border — no card frame, the ambient fills edge-to-edge);
            // collapsed = the CAM-407 fixed-size bottom-sheet/anchored-card
            // (unchanged sizing, only the desktop anchor moved
            // sm:bottom-24 -> sm:bottom-6 to match AiChatLauncher's reset
            // position).
            expanded
              ? "inset-0 duration-200 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95"
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
            {/* CAM-431: fullscreen drops the bordered bar — identity cluster
                + expand/close buttons sit lighter, directly on the ambient
                (buttons grouped into a soft floating pill). Same nodes as
                collapsed, only classNames fork on `expanded` — no remount. */}
            <div
              className={cn(
                "flex shrink-0 items-center justify-between",
                expanded ? "px-4 pt-4 sm:px-8 sm:pt-6" : "border-b border-border/60 px-4 py-3"
              )}
            >
              <div className="flex min-w-0 items-center gap-3">
                <AiChatAvatar size="md" />
                <div className="min-w-0">
                  <p className="truncate font-heading text-base font-medium leading-tight text-foreground">
                    {t.aiChat.name}
                  </p>
                  <p className="truncate text-xs leading-tight text-muted-foreground">{t.aiChat.role}</p>
                </div>
              </div>
              <div
                className={cn(
                  "flex items-center gap-1",
                  expanded && "rounded-full bg-ai-surface p-1 shadow-ai-glow backdrop-blur-md"
                )}
              >
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

            {/* CAM-431: fullscreen centers reading + composing in a column
                with generous side gutters (room reserved for a future side
                panel, owner note) instead of stretching edge-to-edge; the
                collapsed bottom-sheet/anchored-card is already narrower than
                the max-w bound so these classes are a no-op there.
                CAM-436: the reading-column max-w moved OFF this shared flex
                column (below) and onto the message-list wrapper + the
                composer container individually, so the ScrollArea itself
                spans full width and its scrollbar sits at the screen edge
                (not floating mid-screen at the column's inner edge) while
                content still reads centered. */}
            <div className="mx-auto flex w-full min-h-0 flex-1 flex-col">
              <ScrollArea className="min-h-0 flex-1">
                <div className={cn(expanded && "mx-auto max-w-2xl px-4 sm:max-w-3xl sm:px-8")}>
                  <AiChatMessageList
                    entries={entries}
                    sending={sending}
                    resuming={resuming}
                    onSuggestion={handleSuggestion}
                    onRetry={retryLast}
                  />
                </div>
              </ScrollArea>

              {/* CAM-431: fullscreen composer = a floating glass dock (glow +
                  a subtle teal→sky gradient accent), not the collapsed
                  bordered full-width bar. CAM-436: `rounded-3xl` surface (a
                  card that grows vertically, not a stadium pill that
                  stretches grotesquely once the textarea wraps), even
                  `pl-4` inset (the send button now reads as part of the
                  box, not detached far-right), and `focus-within:ring-2` so
                  keyboard focus is visible around the whole dock instead of
                  being swallowed by the transparent textarea. */}
              <div
                className={cn(
                  "shrink-0",
                  expanded
                    ? "mx-auto w-full max-w-2xl px-4 pb-6 sm:max-w-3xl sm:px-8 sm:pb-10"
                    : "border-t border-border/60 p-4"
                )}
              >
                <div
                  className={cn(
                    "flex items-end gap-2",
                    expanded &&
                      "rounded-3xl border border-border/60 bg-ai-surface bg-gradient-to-r from-primary/10 via-info/10 to-transparent p-2 pl-4 shadow-ai-glow backdrop-blur-xl focus-within:ring-2 focus-within:ring-ring"
                  )}
                >
                  <Textarea
                    ref={composerRef}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={handleComposerKeyDown}
                    placeholder={t.aiChat.composerPlaceholder}
                    aria-label={t.aiChat.composerPlaceholder}
                    disabled={sending || disabled}
                    rows={1}
                    className={cn("max-h-32", expanded && "border-none bg-transparent focus-visible:ring-0")}
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
          </div>
        </PanelPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}

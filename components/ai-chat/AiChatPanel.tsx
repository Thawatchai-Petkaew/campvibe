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
 *
 * CAM-442 (R3 owner feedback, 2 fixes):
 *  1. Auto-scroll: the thread never followed new content, so the view froze
 *     wherever Enter was pressed. `scrollWrapperRef` sits on the existing
 *     flex column that already holds `<ScrollArea>` (no new wrapper element,
 *     keeps the CAM-407 definite-height chain untouched) and resolves
 *     Radix's real scrollable node via
 *     `querySelector('[data-radix-scroll-area-viewport]')` (the one node
 *     `components/ui/scroll-area.tsx` doesn't expose a ref for; that shared
 *     primitive stays untouched). `stickToBottomRef` defaults `true` and
 *     flips `false` only once the camper scrolls away from the last
 *     ~120px (an intentional read-history override); it is forced back to
 *     `true` on every camper-initiated send (`handleSend`/`handleSuggestion`)
 *     so pressing Enter always jumps to the newest turn, while a growing
 *     assistant answer only pulls the view along when the camper hadn't
 *     already scrolled up to read.
 *  2. Send spinner: `<LoadingSpinner>`'s ring color (`border-primary`,
 *     hardcoded in that shared primitive) matched the button's own
 *     `bg-primary` fill, so the spinner was invisible while sending.
 *     Swapped for a plain `lucide-react` `Loader2`, tokened
 *     `text-primary-foreground` so it reads against the button fill, same
 *     `size-4` footprint as the `Send` icon it replaces (no layout shift).
 *
 * CAM-447 (S5): tapping a result card now opens a floating, in-panel detail
 * card (`AiChatDetailCard`) instead of navigating away — the panel owns the
 * "which camp is open" view state (`selectedCamp`, a plain `useState` here,
 * NOT `use-ai-chat.ts`, so a thread re-render never drops the open detail)
 * plus a ref to the ORIGINATING card button so focus can return to it on
 * close.
 *
 * CAM-451 (owner staging feedback, SUPERSEDES CAM-447/450's floating-card +
 * scrim geometry): the detail becomes a PUSH navigation instead of an
 * overlay. The chat body and `AiChatDetailCard` are now two full-size panes
 * stacked via `absolute inset-0` inside one `overflow-hidden` track; each
 * pane carries its own `transition-transform` and slides fully off/on
 * screen (`translate-x-full` / `-translate-x-full` / `translate-x-0`) in
 * lockstep, so the chat visibly slides out to the LEFT exactly as the detail
 * slides in from the RIGHT — no scrim, no dim, nothing floats "on top" of
 * the other. Identical geometry at every breakpoint (no `expanded`/mobile
 * fork here; `AiChatDetailCard` still receives `expanded` only to bound its
 * own reading column). The off-screen pane is `inert` (extends the CAM-447
 * guarantee symmetrically to BOTH directions) so Tab/SR never reach hidden
 * controls in either pane.
 *
 * CAM-453 (owner staging feedback, refines CAM-451 for desktop): full-push
 * (chat slides fully off-screen) is now MOBILE-ONLY (and the narrow
 * collapsed 384px card, any width — too tight to split). On desktop
 * (`lg:`+, raised from `sm:` per QA follow-up — 640px left only ~224px of
 * chat text width, too cramped) while `expanded` (fullscreen has the room),
 * the track becomes a DESKTOP SPLIT instead: the chat pane stays in-flow
 * (`lg:flex-1`), visible and interactive, never translated off and never
 * `inert`; the detail pane becomes a bounded right-hand rail (`lg:w-[26rem]`)
 * that widens open / narrows shut instead of translating — a translate on a
 * fixed-width flex sibling would still reserve its layout box and leave a
 * blank gap, so width is the correct axis for a flex-row sibling. Every
 * override is gated `expanded && "lg:…"` so the SAME classes fall back to
 * the unprefixed CAM-451 full-push behaviour whenever `expanded` is false
 * (collapsed card) or the viewport is below `lg:` (mobile/tablet) — no
 * separate mount, no remount. `inert` is a DOM boolean, not stylable by a
 * CSS media query, so the chat pane's `inert` value alone needs a real
 * runtime viewport check (`useIsDesktopViewport`, SSR-safe: starts `false`
 * and syncs after mount — this panel is already `next/dynamic(ssr:false)`,
 * so there's no hydration mismatch to worry about); the split CSS itself
 * still gates purely on Tailwind's `lg:` prefix + `expanded`. CRITICAL: the
 * `useIsDesktopViewport` query breakpoint MUST equal the `lg:` breakpoint
 * (both 1024px) — a desync makes the visual split and the `inert` boolean
 * disagree (an a11y trap, QA-verified invariant).
 *
 * CAM-454 (owner staging feedback, LATER REVERTED by CAM-455 — see that note
 * below for the corrected geometry): the EXPANDED panel briefly became an
 * inset sliding CARD instead of CAM-431's true-fullscreen surface, with the
 * page behind it fully locked.
 *  1. Expanded geometry (superseded): a small four-unit inset on every side
 *     on mobile/tablet, widening on desktop to a small top/bottom/right gap
 *     with a wide left margin so it still read as a big card, rounded
 *     corners + a border, entering via a slide-from-the-right (replacing the
 *     earlier zoom entrance). The CAM-453 desktop split (chat + detail rail)
 *     lived INSIDE this card unchanged; only the outer Content geometry
 *     forked. CAM-455 reverted point 1 only — points 2-4 below still apply.
 *  2. Scroll containment: `overscroll-contain` on both ScrollArea
 *     viewports (chat + `AiChatDetailCard`'s own) so scrolling to the end of
 *     either list can never chain-scroll the page behind it.
 *  3. Page lock, deliberately NOT Radix `modal={true}`: CAM-440 fixed this
 *     panel to `modal={false}` precisely because Radix's modal `RemoveScroll`
 *     injects a `body{padding-right:<scrollbarWidth>px}` compensation gap
 *     (the phantom-sidebar bug). Re-enabling `modal` to get a scroll-lock
 *     would regress that. Instead a manual effect adds `.ai-chat-scroll-lock`
 *     (`overflow:hidden`, no scrollbar-gutter reservation so nothing to
 *     compensate for, no shift) + `.no-scrollbar` to `<html>`, and marks
 *     every OTHER `document.body` child `inert`, only while `open && expanded`
 *     (collapsed stays fully non-modal/interactive, per CAM-429/440's
 *     non-intrusive-floating-assistant intent). The Radix `DialogOverlay`
 *     below is kept (CAM-429) but confirmed against `@radix-ui/react-dialog`
 *     source, it unconditionally renders `null` whenever the Root has
 *     `modal={false}`, so it was already inert; a plain sibling `<div>` (no
 *     `RemoveScroll`/`hideOthers`) is the real pointer-capturing backdrop,
 *     active only while `expanded`, so the visible gap around the inset card
 *     can't click through to the page.
 *  4. Chrome/scrollbar cleanup: no border-l divider rule between the
 *     CAM-453 split panes; the chat's close/expand buttons hide while a
 *     detail is open (`selectedCamp !== null`) so focus reads on the pane
 *     that slid in (back/Esc still return to them); every visible Radix
 *     ScrollArea scrollbar affordance is hidden (`data-scrollbar-hidden` +
 *     the rules in `app/globals.css`) while scrolling itself keeps working.
 *
 * CAM-455 (owner clarification, corrects a CAM-454 misread): CAM-454 point 1
 * wrongly turned the whole EXPANDED CHAT into an inset card. The owner's
 * actual ask — "an inset card with top/bottom spacing that slides in" —
 * was always about the DETAIL panel, not the chat.
 *  1. Expanded chat geometry reverts to CAM-431's true fullscreen: `inset-0`,
 *     no `rounded-3xl`/border at the outer edge, entrance back to the
 *     pre-454 `zoom-in-95`/`zoom-out-95` + fade (calmer than a fullscreen
 *     slide, still <=250ms + motion-reduce safe). Collapsed mode (384px
 *     desktop card / mobile bottom-sheet) is untouched.
 *  2. The detail pane (both the CAM-451 mobile/collapsed full-push pane and
 *     the CAM-453 desktop split rail) becomes the floating inset card: a
 *     margin gap (`my-3 mx-2` full-push, `lg:my-4 lg:mr-4` split) around the
 *     pane wrapper, so `AiChatDetailCard`'s own `rounded-3xl border
 *     border-ai-tint bg-ai-surface shadow-ai-glow` reads as a card floating
 *     inside the fullscreen chat rather than filling it edge-to-edge. The
 *     wrapper drops `h-full` (kept since CAM-451) in favor of `inset-0` (or,
 *     split-mode, flex `stretch`) + an explicit non-auto margin — pairing an
 *     explicit `height:100%` with top+bottom+margin is CSS-over-constrained
 *     (CSS2.1 10.6.4: the browser recomputes `bottom` to satisfy the
 *     equation and the box overflows by the margin amount); dropping the
 *     explicit height lets the browser derive a correct definite height from
 *     the insets/stretch minus the margin, which is what the CAM-407
 *     definite-height chain needs for `AiChatDetailCard`'s own `h-full`
 *     child to resolve against. The margin gap itself is what visually
 *     separates chat vs detail now — no divider line is reintroduced. Both
 *     margin pairs are gated on `selectedCamp !== null` (QA/design gate
 *     follow-up): applying `lg:mr-4`/`mx-2` unconditionally would still
 *     reserve that margin in the split flex row even at `lg:w-0` (nothing
 *     selected), leaving a small permanent dead strip on the right of the
 *     otherwise-fullscreen chat pane — the default, most-often-seen view.
 *     The margin now exists only while there is an actual card to float.
 *  3. Everything else from CAM-451/453/454 (`modal={false}`, the manual
 *     scroll-lock + inert-background effect, `overscroll-contain`, hidden
 *     scrollbars, chrome-hide while a detail is open, the pathname-close
 *     effect) is unchanged.
 *
 * CAM-550 (owner staging feedback, phone testing, 3 mobile-only defects).
 * Implementation note: every fix below is an ADDITIVE `max-sm:`-prefixed
 * class layered AFTER the existing `expanded ? … : …` branches, never a
 * rewrite of those branch strings — the pre-CAM-550 classes stay byte-
 * identical (several pre-existing tests pin them verbatim) and the new
 * `max-sm:` rules simply win the cascade below the 640px breakpoint.
 *  1. No minimize/collapse on mobile — below `sm:` (640px) the panel is now
 *     full-screen ONLY, always (previously mobile defaulted to the CAM-407
 *     85dvh bottom sheet). The `max-sm:` override block replaces whichever
 *     branch's geometry was active with the SAME fullscreen shape already
 *     used for desktop's `expanded` state. The toggle button itself is
 *     `hidden sm:inline-flex` — the affordance does not exist on a small
 *     viewport, it is not merely hidden-but-reachable. Desktop (`sm:`+) is
 *     completely unchanged: still forks on `expanded` between the anchored
 *     384px card and the fullscreen toggle.
 *  2. Header stuck-in-place + breathing room — diagnosed first (per the
 *     ticket): the actual scrollable node was already, correctly, the
 *     message list only (Radix's `[data-radix-scroll-area-viewport]`
 *     established by CAM-407/442/454 — verified via Playwright: the header/
 *     panel boxes never move while the viewport itself scrolls, at a fixed
 *     browser-chrome viewport size). The real mobile-only gap: fullscreen
 *     geometry relied on a bare `inset-0`, which a `position:fixed` box
 *     resolves against the browser's LARGE viewport rather than the
 *     currently-visible one — on a real phone, that can leave the header
 *     above the visible fold until the address bar auto-collapses on
 *     scroll (matching the owner's exact symptom). Fixed via `max-sm:top-0
 *     max-sm:bottom-auto max-sm:h-[100dvh]` (tracks the real visible
 *     viewport as the toolbar animates) instead of relying on either
 *     branch's original inset-only sizing. `max-sm:transform-gpu` added
 *     alongside, guarding the separate (but related-looking) iOS
 *     compositing bug where a `position:fixed` element can visually lag
 *     during an active touch scroll until the gesture ends (same fix
 *     mirrored on `AiChatLauncher.tsx`, via `style` there — see its own
 *     header comment for why). Breathing room: the header/composer now
 *     always carry the fullscreen `pt-4`/`pb-6`-equivalent treatment on
 *     mobile (previously only under `expanded`) plus
 *     `env(safe-area-inset-top/bottom)` so the identity cluster and composer
 *     dock clear a notch/dynamic-island and the home-indicator gesture bar.
 *  3. Launcher cropped/not sticky — see `AiChatLauncher.tsx` (same
 *     `env(safe-area-inset-*)` + `transform-gpu` treatment, out of this
 *     file's surface).
 *
 * CAM-541 (owner feedback, 3 fixes — verified on `dev` first, per the
 * ticket, before changing anything):
 *  1. Contrast: the header's role subtitle (`text-muted-foreground` on
 *     `bg-ai-surface`) measured 4.40:1 in light mode, below the 4.5:1 body
 *     floor (`scripts/check-contrast.mjs`) — bumped to `text-foreground/70`
 *     (7.41:1 light / 8.69:1 dark), the same fix CAM-451 already applied to
 *     `AiChatDetailCard` for this identical pair.
 *  2. Mobile overlap: CAM-550 (just merged) already made the panel true
 *     full-screen (`h-[100dvh]`) below `sm:` — re-verified here at a real
 *     phone viewport (390x664) in BOTH color schemes and at 150% root
 *     font-size: the panel's bounding box exactly matches the viewport in
 *     every case (0,0 to 390,664), no gap/overlap. Nothing changed in this
 *     file for that symptom — it was already fixed.
 *  3. Glow: see `AiChatAvatar.tsx` (the aura ring token, out of this file's
 *     surface).
 *
 * CAM-591 (owner instruction 2026-07-27): the CAM-429 `expanded` fallback,
 * for when nothing is in `sessionStorage` yet, changes from the anchored
 * panel to full screen — a brand-new camper's FIRST open of น้องกองไฟ now
 * meets the immersive view, not the corner card. `readExpandedFromStorage`
 * already distinguished "read the stored choice" from "nothing stored" (the
 * mechanism CAM-429 built); only the "nothing stored" branch's return value
 * changes, from `false` to `true`. The load-bearing distinction this rests
 * on: `sessionStorage.getItem` returns the JS value `null` ONLY for a key
 * that was never written — an explicit `"0"` (a camper who pressed
 * collapse) is a DIFFERENT value from `null` and is checked FIRST, before
 * the new default applies, so a returning camper's deliberate collapse is
 * never overridden. This is desktop-only in effect: mobile (`max-sm:`)
 * already ignores `expanded` entirely and is always full screen per CAM-550,
 * untouched here. No new `sessionStorage` write is introduced — the first
 * full-screen open persists nothing on its own, exactly as before.
 *
 * CAM-627 (owner report, Golf: "เครื่องร้อนมากตอนเปิด chat" — the machine ran
 * hot for as long as the panel stayed open, remove the animation, keep only
 * น้องกองไฟ): profiled with the panel open and idle. The dominant, cleanly
 * measured idle cost was `AiAmbientCanvas`'s continuous ~30fps
 * `requestAnimationFrame` loop (renderer main-thread JS busy time dropped
 * ~85% once it was stopped — see that file's own header comment for the
 * numbers); the `.ai-aurora-drift` transform/opacity loop sat behind this
 * panel's several stacked `backdrop-blur-xl` glass layers, which the story's
 * design.md documents as the mechanism (animating anything behind a
 * backdrop-filter forces a per-frame blur recompute over that whole area).
 * Both loops are now static — see `app/globals.css`'s CAM-627 comment on
 * `.ai-aurora-drift` and `AiAmbientCanvas.tsx`'s own header. Nothing in this
 * file's JSX/className changed for either fix (the div below still reads
 * `"ai-aurora ai-aurora-drift ..."` byte-for-byte). Untouched, per the
 * ticket: `AiChatAvatar` (น้องกองไฟ — the flame keeps its `ai-flame-glow`/
 * `ai-flame-flicker` pulses) and all `prefers-reduced-motion` handling.
 */
"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import dynamic from "next/dynamic";
import { Dialog as PanelPrimitive } from "radix-ui";
import { Loader2, Maximize2, Minimize2, Send, X } from "lucide-react";
import { Dialog, DialogPortal, DialogOverlay } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAiChat } from "@/components/ai-chat/use-ai-chat";
import { AiChatMessageList } from "@/components/ai-chat/AiChatMessageList";
import { AiChatAvatar } from "@/components/ai-chat/AiChatAvatar";
import { AiChatDetailCard } from "@/components/ai-chat/AiChatDetailCard";
import { isSendableQuestion } from "@/components/ai-chat/conversation";
import type { BookingCampContext } from "@/components/ai-chat/booking-view";
import type { AiChatCardResponse } from "@/lib/api-client";

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

// CAM-591 (BR-1/BR-2): `getItem` returns the JS value `null` ONLY when the
// key was never written at all — a brand-new tab, this camper's first-ever
// open. That is a DIFFERENT value from the explicit string `"0"` a camper
// leaves behind by pressing collapse (writeExpandedToStorage below). The
// `null` check runs FIRST and short-circuits to the new full-screen default;
// an explicit `"0"` never reaches it, so a returning camper's deliberate
// collapse is never re-forced open. `"1"` (explicit expand) still returns
// `true` via the same `=== "1"` comparison as before CAM-591 — only the
// never-set branch's answer changed.
function readExpandedFromStorage(): boolean {
  if (typeof window === "undefined") return true;
  try {
    if (window.sessionStorage.getItem(EXPANDED_STORAGE_KEY) === null) return true;
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

// CAM-453 (raised from `sm:`/640px to `lg:`/1024px, QA follow-up: 640px left
// the chat pane only ~224px of text width, too cramped — the split should
// only engage at genuinely-desktop width). Mirrors Tailwind's `lg:`
// breakpoint exactly. Only consumed to gate `inert` (a DOM boolean the
// `lg:` CSS classes below can't reach) — the split/full-push CSS itself
// stays purely Tailwind-driven. CRITICAL: this query's breakpoint MUST
// equal the Tailwind prefix used on every split class below (both 1024px) —
// a desync between the two makes the visual split and the `inert` boolean
// disagree, which is an a11y trap (QA-verified invariant).
const DESKTOP_SPLIT_QUERY = "(min-width: 1024px)";

function subscribeToDesktopSplitQuery(onChange: () => void): () => void {
  const mql = window.matchMedia(DESKTOP_SPLIT_QUERY);
  mql.addEventListener("change", onChange);
  return () => mql.removeEventListener("change", onChange);
}

function getIsDesktopViewport(): boolean {
  return window.matchMedia(DESKTOP_SPLIT_QUERY).matches;
}

// SSR-safe snapshot: this panel is already `next/dynamic(ssr:false)`, so
// `false` here is never actually rendered server-side — it only covers the
// brief pre-mount tick, matching the mobile-first default.
function getServerIsDesktopViewport(): boolean {
  return false;
}

function useIsDesktopViewport(): boolean {
  return useSyncExternalStore(
    subscribeToDesktopSplitQuery,
    getIsDesktopViewport,
    getServerIsDesktopViewport
  );
}

export function AiChatPanel({ open, onOpenChange }: AiChatPanelProps) {
  const { t } = useLanguage();
  const {
    entries,
    sending,
    disabled,
    resuming,
    sendMessage,
    retryLast,
    abortActiveStream,
    startBookingFlow,
    onBookingChipSelect,
    onBookingBack,
    onBookingEditDate,
    onBookingEditGuests,
    onBookingCancel,
  } = useAiChat();
  const [draft, setDraft] = useState("");
  const [expanded, setExpanded] = useState(() => readExpandedFromStorage());
  // CAM-453 — desktop split gates on `expanded` (fullscreen has the room)
  // AND a real `lg:`-equivalent viewport check (needed only for `inert`,
  // which a CSS media query can't drive); the split's CSS itself uses
  // Tailwind's `lg:` prefix directly, gated by `expanded` alone. Both MUST
  // stay at the same 1024px breakpoint (QA-verified invariant).
  const isDesktopViewport = useIsDesktopViewport();
  const isSplitMode = expanded && isDesktopViewport;
  const composerRef = useRef<HTMLTextAreaElement>(null);

  // CAM-454: lock the page behind the panel only while open AND expanded —
  // collapsed never locks (matches CAM-429/440's non-intrusive-floating-
  // assistant intent). See the file-header doc comment for why this is a
  // manual class (not Radix `modal={true}`, which would reintroduce
  // CAM-440's scrollbar-compensation bug). `data-ai-chat-node` marks this
  // panel's OWN portal-rendered nodes (backdrop + Content below) so they are
  // never inerted along with the rest of the page.
  useEffect(() => {
    if (typeof document === "undefined" || !(open && expanded)) return;
    const root = document.documentElement;
    root.classList.add("ai-chat-scroll-lock", "no-scrollbar");
    const inerted: HTMLElement[] = [];
    for (const child of Array.from(document.body.children)) {
      if (!(child instanceof HTMLElement)) continue;
      if (child.hasAttribute("data-ai-chat-node") || child.inert) continue;
      child.inert = true;
      inerted.push(child);
    }
    return () => {
      root.classList.remove("ai-chat-scroll-lock", "no-scrollbar");
      for (const el of inerted) el.inert = false;
    };
  }, [open, expanded]);
  // CAM-447 — panel-level view state (not use-ai-chat.ts): which camp's
  // floating detail card is open, plus the originating card button so
  // closing the detail restores focus to it.
  const [selectedCamp, setSelectedCamp] = useState<AiChatCardResponse | null>(null);
  const detailTriggerRef = useRef<HTMLElement | null>(null);
  // CAM-442: sits on the existing flex column that already holds
  // <ScrollArea> (not a new element) so the CAM-407 definite-height chain
  // is untouched; Radix's real scrollable node has no ref of its own
  // exposed by components/ui/scroll-area.tsx, so it's resolved via
  // querySelector below instead of editing that shared primitive.
  const scrollWrapperRef = useRef<HTMLDivElement>(null);
  // True while the view should follow new content; false once the camper
  // scrolls up to read history. Reset to true on every camper-initiated
  // send so Enter always jumps to the newest turn.
  const stickToBottomRef = useRef(true);

  // CAM-423: the composer stays disabled while `resuming` too — a message
  // sent before the resumed conversationId lands would create a stray NEW
  // conversation instead of continuing the one being restored.
  const canSend = !sending && !disabled && !resuming && isSendableQuestion(draft);

  // CAM-442: the last assistant entry's growing text length — included in
  // the auto-scroll effect's deps below so a streaming/answer turn that's
  // still growing keeps pulling the view along (while `stickToBottomRef`
  // stays true).
  const lastEntry = entries[entries.length - 1];
  const lastAssistantTextLength =
    lastEntry && lastEntry.role === "assistant" && (lastEntry.kind === "answer" || lastEntry.kind === "streaming")
      ? lastEntry.text.length
      : 0;

  function getScrollViewport(): HTMLElement | null {
    return scrollWrapperRef.current?.querySelector<HTMLElement>("[data-radix-scroll-area-viewport]") ?? null;
  }

  // Tracks how close to the bottom the camper is; scrolling away from the
  // last ~120px is read as "reading history" and pauses the auto-follow.
  useEffect(() => {
    const viewport = getScrollViewport();
    if (!viewport) return;
    function handleScroll() {
      if (!viewport) return;
      stickToBottomRef.current = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight < 120;
    }
    viewport.addEventListener("scroll", handleScroll, { passive: true });
    return () => viewport.removeEventListener("scroll", handleScroll);
  }, []);

  // Follows the newest turn: fires on a new entry, the sending/resuming
  // transition, or the in-flight answer growing. `requestAnimationFrame`
  // measures `scrollHeight` after the appended DOM has actually committed.
  useEffect(() => {
    if (!stickToBottomRef.current) return;
    const raf = requestAnimationFrame(() => {
      const viewport = getScrollViewport();
      if (!viewport) return;
      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      viewport.scrollTo({ top: viewport.scrollHeight, behavior: reduceMotion ? "auto" : "smooth" });
    });
    return () => cancelAnimationFrame(raf);
  }, [entries.length, sending, lastAssistantTextLength, resuming]);

  function handleSend() {
    if (!canSend) return;
    const text = draft;
    setDraft("");
    stickToBottomRef.current = true; // camper-initiated send always jumps to the newest turn
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
    stickToBottomRef.current = true; // camper-initiated send always jumps to the newest turn
    void sendMessage(text);
  }

  function handleComposerKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  // CAM-447 — captures the tapped card button (the current focused element
  // at click time) before opening the detail, so closing it can restore
  // focus there.
  function handleSelectCamp(card: AiChatCardResponse) {
    detailTriggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setSelectedCamp(card);
  }

  function handleCloseDetail() {
    setSelectedCamp(null);
    detailTriggerRef.current?.focus();
    detailTriggerRef.current = null;
  }

  // CAM-640 (design brief §"Entry") — "the detail pane closes when the flow
  // starts, at every viewport": starting the flow and closing the detail are
  // ALWAYS one action, never left to fire separately.
  function handleStartBooking(camp: BookingCampContext) {
    startBookingFlow(camp);
    handleCloseDetail();
  }

  // CAM-412 (BR-6/AC-7/EC-6) — every dismiss path (X button, Esc,
  // outside-pointer-dismiss) funnels through Radix's onOpenChange; aborting
  // here on the close transition covers all of them in one place.
  // CAM-447 — closing the whole panel also clears any open detail card so a
  // later reopen never resurrects a stale one.
  function handleOpenChange(next: boolean) {
    if (!next) {
      abortActiveStream();
      setSelectedCamp(null);
      detailTriggerRef.current = null;
    }
    onOpenChange(next);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange} modal={false}>
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
        {/* CAM-454: a plain backdrop (NOT Radix's `Dialog.Overlay` above,
            which the library gates to `null` whenever the Root has
            `modal={false}` — confirmed against @radix-ui/react-dialog
            source, so that JSX line never actually renders anything today).
            This div is the real pointer-capturing backdrop, active only
            while `expanded`. CAM-455: the expanded Content is fullscreen
            again (inset-0) so there is no longer a visible gap around it to
            click through — this backdrop is now a defensive no-op layer
            beneath the fullscreen Content, kept for the collapsed-toggle
            transition frame rather than removed. No RemoveScroll/hideOthers
            here — the page lock is the separate manual effect above, so
            this never reintroduces CAM-440. */}
        <div
          aria-hidden="true"
          data-ai-chat-node=""
          className={cn("fixed inset-0 z-40", expanded ? "pointer-events-auto" : "pointer-events-none")}
        />
        <PanelPrimitive.Content
          data-slot="ai-chat-panel"
          data-ai-chat-node=""
          data-testid="dialog--ai-chat-panel"
          aria-label={`${t.aiChat.name} ${t.aiChat.role}`}
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            composerRef.current?.focus();
          }}
          className={cn(
            "fixed z-50 flex flex-col overflow-hidden bg-ai-surface shadow-ai-glow outline-none backdrop-blur-xl",
            "motion-reduce:data-open:animate-none motion-reduce:data-closed:animate-none",
            // CAM-455 (reverts CAM-454 point 1 — owner clarification: the
            // inset-card treatment belongs to the DETAIL pane, not the
            // chat): expanded = TRUE full-screen again (inset-0, no
            // rounded/border at the outer edge — the ambient fills
            // edge-to-edge), entrance back to the calmer pre-454
            // zoom-in-95/zoom-out-95 + fade. collapsed = the CAM-407
            // fixed-size bottom-sheet/anchored-card (unchanged sizing, only
            // the desktop anchor moved sm:bottom-24 -> sm:bottom-6 to match
            // AiChatLauncher's reset position).
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
                ),
            // CAM-550 (owner staging feedback, mobile widths, ADDITIVE —
            // wins the cascade at `max-sm` regardless of which branch above
            // is active, deliberately layered on top rather than rewriting
            // the branches above so every pre-existing pinned classString
            // stays byte-identical): below `sm:` (640px) the assistant is
            // full-screen ONLY, always — no collapsed bottom sheet, no
            // minimize control on a small viewport at all (see the hidden
            // `btn--ai-chat-expand-toggle` below). `top-0`/`bottom-auto`/
            // `h-[100dvh]` (not a bare `inset-0`/`bottom-0`) so the box
            // tracks the REAL visible viewport as the phone browser's
            // address bar shows/hides — a fixed box sized purely by
            // `inset-0` resolves its height against the browser's LARGE
            // viewport, which can leave the header above the visible fold
            // until the toolbar auto-collapses (matches the owner's report:
            // "the header only returns after scrolling all the way back
            // down"). `max-h-[100dvh]` is required alongside `h-[100dvh]` —
            // the collapsed branch's own `max-h-[85dvh]` (untouched, still
            // present above) would otherwise still CAP the box at 85% of
            // the viewport even after `height` is overridden (verified via
            // Playwright: without this line the panel measured 85% tall, not
            // fullscreen). `rounded-none border-none` strip the (now unused
            // on mobile) bottom-sheet corner/divider from the collapsed
            // branch; `fade-in-0 zoom-in-95`/`slide-in-from-bottom-0`
            // normalize the entrance to the calmer fullscreen fade+zoom
            // regardless of which branch supplied the base animation
            // classes.
            "max-sm:inset-x-0 max-sm:top-0 max-sm:bottom-auto max-sm:h-[100dvh] max-sm:max-h-[100dvh] max-sm:rounded-none max-sm:border-none",
            "max-sm:transform-gpu max-sm:data-open:fade-in-0 max-sm:data-open:zoom-in-95 max-sm:data-open:slide-in-from-bottom-0 max-sm:data-closed:fade-out-0 max-sm:data-closed:zoom-out-95 max-sm:data-closed:slide-out-to-bottom-0"
          )}
        >
          {/* CAM-426: campfire-night ambient backdrop — decorative, behind every
              reading region (DESIGN.md §2.1). The glass shell above
              (bg-ai-surface + backdrop-blur-xl) plus each child's own opaque
              surface keep text legible over it; never a wash over content.
              CAM-627 (owner report: the machine ran hot while this panel
              stayed open) — the `ai-aurora-drift` class name below is
              UNCHANGED (kept so this div's className stays pinned/stable),
              but it no longer animates: its motion sat behind this shell's
              several stacked `backdrop-blur-xl` glass layers, so animating
              it forced a continuous per-frame blur recompute over the whole
              panel for as long as it was open — the fix lives in
              `app/globals.css` (`.ai-aurora-drift { animation: none; }`, see
              its own CAM-627 comment there), not in this className string.
              `AiAmbientCanvas` below no longer runs a continuous
              `requestAnimationFrame` loop either — see that file's header
              comment. */}
          <div className="ai-aurora ai-aurora-drift pointer-events-none absolute inset-0 -z-10" aria-hidden="true" />
          <AiAmbientCanvas />

          {/* CAM-451: the push track — a single overflow-hidden viewport
              holding two absolute-inset0 panes (chat | detail). Each pane's
              own translate-x moves it fully off/on screen; both share the
              same duration/easing so they read as one connected push, never
              an overlay.
              CAM-453: `expanded` additionally unlocks a `lg:` desktop-split
              row layout on the SAME track (no separate mount) — see the
              file-header doc comment for the full rationale. */}
          <div
            className={cn(
              "relative z-10 h-full min-h-0 overflow-hidden",
              expanded && "lg:flex lg:flex-row"
            )}
          >
            <div
              className={cn(
                "absolute inset-0 flex h-full min-h-0 flex-col transition-transform duration-200 ease-out motion-reduce:transition-none",
                selectedCamp ? "-translate-x-full" : "translate-x-0",
                // CAM-453: desktop split — the chat pane stays in-flow and
                // visible beside the detail rail (never translated off).
                expanded && "lg:relative lg:inset-auto lg:flex-1 lg:min-w-0 lg:translate-x-0"
              )}
              inert={!isSplitMode && selectedCamp !== null}
            >
              {/* CAM-431: fullscreen drops the bordered bar — identity cluster
                  + expand/close buttons sit lighter, directly on the ambient
                  (buttons grouped into a soft floating pill). Same nodes as
                  collapsed, only classNames fork on `expanded` — no remount. */}
              <div
                className={cn(
                  "flex shrink-0 items-center justify-between",
                  expanded ? "px-4 pt-4 sm:px-8 sm:pt-6" : "border-b border-border/60 px-4 py-3",
                  // CAM-550 (ADDITIVE — see the Content className above for
                  // why this is layered on top rather than rewriting the
                  // branch strings): mobile is always the borderless
                  // fullscreen header + safe-area-inset-top so the identity
                  // cluster clears a notch/dynamic island — "no top
                  // breathing room" fix. sm:+ is untouched (this override
                  // only matches below 640px).
                  "max-sm:border-none max-sm:px-4 max-sm:pt-[max(1rem,env(safe-area-inset-top))]"
                )}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <AiChatAvatar size="md" />
                  <div className="min-w-0">
                    <p className="truncate font-heading text-base font-medium leading-tight text-foreground">
                      {t.aiChat.name}
                    </p>
                    {/* CAM-541: text-muted-foreground on bg-ai-surface measured
                        4.40:1 in light mode (below the 4.5:1 floor,
                        scripts/check-contrast.mjs) — bumped to text-foreground/70
                        (7.41:1 light / 8.69:1 dark), the same fix CAM-451 already
                        applied to AiChatDetailCard for this identical pair. */}
                    <p className="truncate text-xs leading-tight text-foreground/70">{t.aiChat.role}</p>
                  </div>
                </div>
                {/* CAM-454: hidden while a detail is open (selectedCamp) so
                    focus reads on the pane that slid in — reappear the
                    instant the camper backs out (setSelectedCamp(null)).
                    Esc/back both still work: AiChatDetailCard's own back
                    button + window-capture Esc listener close the detail
                    unconditionally, independent of these buttons. */}
                {selectedCamp === null && (
                  <div
                    className={cn(
                      "flex items-center gap-1",
                      expanded && "rounded-full bg-ai-surface p-1 shadow-ai-glow backdrop-blur-md",
                      // CAM-550 (ADDITIVE, see above): mobile is always the
                      // fullscreen soft pill, matching the header always
                      // being borderless there; sm:+ is untouched.
                      "max-sm:rounded-full max-sm:bg-ai-surface max-sm:p-1 max-sm:shadow-ai-glow max-sm:backdrop-blur-md"
                    )}
                  >
                    {/* CAM-550 (owner decision): the expand/collapse toggle
                        does not exist on a small viewport at all — mobile is
                        full-screen only, never shrunk to fit. Desktop (sm:+)
                        keeps it. */}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={expanded ? t.aiChat.collapse : t.aiChat.expand}
                      data-testid="btn--ai-chat-expand-toggle"
                      className="hidden sm:inline-flex"
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
                      onClick={() => handleOpenChange(false)}
                    >
                      <X className="size-5" aria-hidden="true" />
                    </Button>
                  </div>
                )}
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
              <div ref={scrollWrapperRef} className="mx-auto flex w-full min-h-0 flex-1 flex-col">
                {/* CAM-454: overscroll-contain stops scrolling to the end of
                    the thread from chain-scrolling the page behind it;
                    data-scrollbar-hidden hides this ScrollArea's own visible
                    scrollbar affordance (app/globals.css) while scrolling
                    itself keeps working. */}
                <ScrollArea
                  className="min-h-0 flex-1 [&>[data-slot=scroll-area-viewport]]:overscroll-contain"
                  data-scrollbar-hidden
                >
                  <div className={cn(expanded && "mx-auto max-w-2xl px-4 sm:max-w-3xl sm:px-8")}>
                    <AiChatMessageList
                      entries={entries}
                      sending={sending}
                      resuming={resuming}
                      onSuggestion={handleSuggestion}
                      onRetry={retryLast}
                      onSelectCamp={handleSelectCamp}
                      onBookingChipSelect={onBookingChipSelect}
                      onBookingBack={onBookingBack}
                      onBookingEditDate={onBookingEditDate}
                      onBookingEditGuests={onBookingEditGuests}
                      onBookingCancel={onBookingCancel}
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
                      : "border-t border-border/60 p-4",
                    // CAM-550 (ADDITIVE, see above): mobile is always the
                    // fullscreen composer layout + safe-area-inset-bottom so
                    // the dock clears the home-indicator gesture bar — "no
                    // bottom breathing room" fix. sm:+ is untouched.
                    "max-sm:border-none max-sm:mx-auto max-sm:w-full max-sm:max-w-2xl max-sm:px-4 max-sm:pb-[max(1.5rem,env(safe-area-inset-bottom))]"
                  )}
                >
                  <div
                    className={cn(
                      "flex items-end gap-2",
                      expanded &&
                        "rounded-3xl border border-border/60 bg-ai-surface bg-gradient-to-r from-primary/10 via-info/10 to-transparent p-2 pl-4 shadow-ai-glow backdrop-blur-xl focus-within:ring-2 focus-within:ring-ring",
                      // CAM-550 (ADDITIVE, see above): mobile is always the
                      // fullscreen glass dock, matching the header/toggle-
                      // pill always being the fullscreen treatment there;
                      // sm:+ is untouched.
                      "max-sm:rounded-3xl max-sm:border max-sm:border-border/60 max-sm:bg-ai-surface max-sm:bg-gradient-to-r max-sm:from-primary/10 max-sm:via-info/10 max-sm:to-transparent max-sm:p-2 max-sm:pl-4 max-sm:shadow-ai-glow max-sm:backdrop-blur-xl max-sm:focus-within:ring-2 max-sm:focus-within:ring-ring"
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
                      className={cn(
                        // CAM-550 (ADDITIVE, kept as its own nested cn() call
                        // — a pre-existing test pins this exact expression
                        // verbatim, closing paren included): the textarea
                        // blends into the always-fullscreen mobile dock the
                        // same way it already blends into the desktop
                        // `expanded` dock; sm:+ is untouched.
                        cn("max-h-32", expanded && "border-none bg-transparent focus-visible:ring-0"),
                        "max-sm:border-none max-sm:bg-transparent max-sm:focus-visible:ring-0"
                      )}
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
                        <Loader2 className="size-4 animate-spin text-primary-foreground motion-reduce:animate-none" aria-hidden="true" />
                      ) : (
                        <Send className="size-4" aria-hidden="true" />
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* CAM-451 — the detail pane: off-screen right (`translate-x-full`)
                until a camp is selected, then slides to `translate-x-0`.
                `AiChatDetailCard` itself only mounts while selected — never
                fetches for a pane the camper can't see.
                CAM-453 — desktop split: a bounded side rail that WIDENS
                open / narrows shut (`lg:w-0` <-> `lg:w-[26rem]`) instead of
                translating; a translated fixed-width flex sibling would
                still reserve its box and leave a blank gap, so width is the
                right axis here. `lg:motion-reduce:transition-none` repeats
                the reduced-motion guard at the `lg:` variant so it still
                wins once the transitioned property switches from transform
                to width at that breakpoint.
                CAM-454 — dropped the border-l divider rule (owner feedback:
                no line between the two panes inside the inset card).
                CAM-455 — this pane is now the floating inset card: `my-3
                mx-2` (full-push) / `lg:my-4 lg:mr-4` (split) reserve the gap
                that reads as a card floating inside the fullscreen chat;
                `h-full` is dropped (see file-header doc comment) so the
                margin doesn't over-constrain the box. Both margin pairs are
                gated on `selectedCamp` (not applied unconditionally) — in
                split mode the rail is `lg:w-0` when nothing is selected, and
                an unconditional `lg:mr-4`/`mx-2` would still reserve that
                margin in the flex row, leaving a small dead strip on the
                right of the otherwise-fullscreen chat pane even with no
                detail open (owner staging feedback). Margin only exists
                while there is an actual card to float. */}
            <div
              className={cn(
                "absolute inset-0 flex min-h-0 flex-col transition-transform duration-200 ease-out motion-reduce:transition-none",
                selectedCamp ? "my-3 mx-2 translate-x-0" : "translate-x-full",
                expanded &&
                  cn(
                    "lg:relative lg:inset-auto lg:shrink-0 lg:translate-x-0 lg:overflow-hidden lg:transition-[width] lg:duration-200 lg:ease-out lg:motion-reduce:transition-none",
                    selectedCamp ? "lg:my-4 lg:mr-4 lg:w-[26rem]" : "lg:w-0"
                  )
              )}
              inert={selectedCamp === null}
            >
              {selectedCamp && (
                <AiChatDetailCard
                  card={selectedCamp}
                  expanded={expanded}
                  onClose={handleCloseDetail}
                  onStartBooking={handleStartBooking}
                />
              )}
            </div>
          </div>
        </PanelPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}

/**
 * components/ai-chat/AiChatLauncher.tsx — CAM-272
 *
 * CAM-434 (owner staging feedback D): moved from a Home-only mount
 * (`app/page.tsx`) to the ROOT layout (`app/layout.tsx`) — the launcher now
 * floats on EVERY page (BR-1: renders whenever a page renders, including
 * when the assistant is disabled — never hidden), except two internal,
 * non-consumer surfaces it explicitly hides on: the token-gated `/status`
 * delivery dashboard (+ `/status/map`, fixed self-contained styling by
 * design) and the pre-launch `/coming-soon` holding page ("users cannot
 * navigate anywhere"). See BR-3 in this story's spec for why this list
 * stays small and explicit rather than a general per-route config.
 *
 * CAM-429 (owner staging feedback): reset to its natural `bottom-6 right-6`
 * (the earlier `bottom-24` offset dodged `HostOnboardingFab`, which now moves
 * to `bottom-6 left-6` instead — see `components/HostOnboardingFab.tsx`) and
 * gained a campfire aura: the flame recoloring to `text-ai-ember` with the
 * already-sanctioned `ai-flame-glow` pulse (same idiom as `AiChatAvatar`,
 * DESIGN.md §2.1) and two small decorative ember/firefly dots (Tailwind's
 * stock `animate-pulse`, motion-safe/reduce gated).
 *
 * CAM-432 (owner staging feedback + reference image): repositioned up to
 * `bottom-10 right-6` (easier thumb reach; `HostOnboardingFab` lives at
 * `bottom-6 left-6`, no collision). The disc moves from teal (the default
 * Button variant's `bg-primary`) to a fire-toned `bg-ai-ember/10`, and the
 * flat `shadow-ai-glow` is replaced by a VISIBLE flickering aura halo — a
 * decorative `-z-10` span carrying `shadow-ai-flame-aura` + the
 * `ai-flame-flicker` loop (owner-approved, DESIGN.md §2.1's ai-flame-flicker
 * exception line; static under `prefers-reduced-motion`).
 *
 * CAM-435 (R2 owner staging feedback): this FAB is a persistent mark (shows
 * on every page), so its aura ring swaps `ai-flame-flicker` → the gentler
 * `ai-flame-glow` pulse — the strong flicker is reserved for the loading
 * surface only (`AiChatAvatar`'s `intensity="loading"`). Same token, no new
 * keyframe; still static under `prefers-reduced-motion`.
 *
 * PERF (not measured): the heavy panel (Sheet, message thread,
 * CampgroundCard reuse) is `next/dynamic(ssr:false)` and mounted only
 * after the first tap — the Home route's initial bundle only pays for
 * this file (a Button + an icon + 3 decorative spans), matching the Navbar's
 * own modal-lazy-loading idiom.
 *
 * CAM-411: the mark icon changes `Sparkles → Flame` (the น้องกองไฟ identity
 * mark shared with the header/welcome/bubble avatar — design.md §Avatar).
 */
"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { Flame } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";

const AiChatPanel = dynamic(
  () => import("@/components/ai-chat/AiChatPanel").then((m) => ({ default: m.AiChatPanel })),
  { ssr: false, loading: () => null }
);

// CAM-434 BR-3: a small, explicit route-hide list — not a general per-route
// config table. Both are internal/non-consumer surfaces (see header comment).
function isHiddenRoute(pathname: string | null): boolean {
  if (!pathname) return false;
  return pathname === "/coming-soon" || pathname === "/status" || pathname.startsWith("/status/");
}

export function AiChatLauncher() {
  const { t } = useLanguage();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  // CAM-454 (QA regression fix): the detail card's "view camp page" CTA is a
  // real navigation (`<Link href="/campgrounds/...">`), not a panel action —
  // the panel itself never intercepts it. Without this, the panel stayed
  // open across the navigation and its expanded scroll-lock/inert effect
  // (gated on `[open, expanded]`, neither of which changes on a route
  // change) kept `.ai-chat-scroll-lock`/`.no-scrollbar` on `<html>` and the
  // rest of the new page `inert`, stranding the camper on an unscrollable
  // destination. Closing on every pathname change unmounts `AiChatPanel`,
  // whose lock/inert cleanup then runs, leaving the new route clean. The
  // `didMountRef` guard skips the very first render so this never fights
  // the FAB's own `setOpen(true)` on first open.
  const didMountRef = useRef(false);
  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }
    setOpen(false);
  }, [pathname]);

  if (isHiddenRoute(pathname)) return null;

  return (
    <>
      <div className="fixed bottom-10 right-6 z-50">
        {/* CAM-432 fire aura: visible radial halo behind the FAB (DESIGN.md
            §2.1 closed --ai-* token set + the ai-flame-flicker exception
            line). aria-hidden + pointer-events-none: carries no information,
            never intercepts a tap; -z-10 keeps it strictly behind the button. */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 rounded-full shadow-ai-flame-aura ai-flame-glow"
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -top-1 -right-1 size-1.5 rounded-full bg-ai-ember motion-safe:animate-pulse motion-reduce:animate-none"
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-0.5 -left-1 size-1 rounded-full bg-ai-firefly motion-safe:animate-pulse motion-reduce:animate-none"
        />
        <Button
          type="button"
          size="icon-lg"
          aria-label={t.aiChat.launcherLabel}
          data-testid="btn--ai-chat-launcher"
          className="h-12 w-12 rounded-full bg-ai-ember/10 hover:bg-ai-ember/20 motion-safe:hover:scale-105 motion-safe:active:scale-95"
          onClick={() => setOpen(true)}
        >
          <Flame strokeWidth={1} className="ai-flame-glow size-5 fill-current text-ai-ember" aria-hidden="true" />
        </Button>
      </div>
      {open && <AiChatPanel open={open} onOpenChange={setOpen} />}
    </>
  );
}

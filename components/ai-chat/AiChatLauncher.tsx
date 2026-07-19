/**
 * components/ai-chat/AiChatLauncher.tsx — CAM-272
 *
 * Home-only floating entry point (BR-1: renders whenever Home renders,
 * including when the assistant is disabled — never hidden).
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

import { useState } from "react";
import dynamic from "next/dynamic";
import { Flame } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";

const AiChatPanel = dynamic(
  () => import("@/components/ai-chat/AiChatPanel").then((m) => ({ default: m.AiChatPanel })),
  { ssr: false, loading: () => null }
);

export function AiChatLauncher() {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="fixed bottom-10 right-6 z-50">
        {/* CAM-432 fire aura: visible radial halo behind the FAB (DESIGN.md
            §2.1 closed --ai-* token set + the ai-flame-flicker exception
            line). aria-hidden + pointer-events-none: carries no information,
            never intercepts a tap; -z-10 keeps it strictly behind the button. */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 rounded-full shadow-ai-flame-aura ai-flame-flicker"
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
          <Flame className="ai-flame-glow size-5 fill-current text-ai-ember" aria-hidden="true" />
        </Button>
      </div>
      {open && <AiChatPanel open={open} onOpenChange={setOpen} />}
    </>
  );
}

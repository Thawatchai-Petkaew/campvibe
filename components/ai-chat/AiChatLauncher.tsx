/**
 * components/ai-chat/AiChatLauncher.tsx — CAM-272
 *
 * Home-only floating entry point (BR-1: renders whenever Home renders,
 * including when the assistant is disabled — never hidden). Positioned
 * `bottom-24` (not the usual `bottom-6`) to avoid colliding with
 * `HostOnboardingFab` (also `fixed bottom-6 right-6 z-50` on Home) —
 * that file is outside this story's edit surface, so the chat launcher
 * resolves the offset itself (design.md §Seams "FAB collision").
 *
 * PERF (not measured): the heavy panel (Sheet, message thread,
 * CampgroundCard reuse) is `next/dynamic(ssr:false)` and mounted only
 * after the first tap — the Home route's initial bundle only pays for
 * this file (a Button + an icon), matching the Navbar's own
 * modal-lazy-loading idiom.
 *
 * CAM-411: the mark icon changes `Sparkles → Flame` (the น้องกองไฟ identity
 * mark shared with the header/welcome/bubble avatar — design.md §Avatar);
 * all existing launcher states/offsets are unchanged.
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
      <div className="fixed bottom-24 right-6 z-50">
        <Button
          type="button"
          size="icon-lg"
          aria-label={t.aiChat.launcherLabel}
          data-testid="btn--ai-chat-launcher"
          className="h-12 w-12 rounded-full shadow-lg shadow-primary/20 motion-safe:hover:scale-105 motion-safe:active:scale-95"
          onClick={() => setOpen(true)}
        >
          <Flame className="size-5" aria-hidden="true" />
        </Button>
      </div>
      {open && <AiChatPanel open={open} onOpenChange={setOpen} />}
    </>
  );
}

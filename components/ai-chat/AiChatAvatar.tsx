/**
 * components/ai-chat/AiChatAvatar.tsx — CAM-411 (flame recolor: CAM-426)
 *
 * The single น้องกองไฟ (Kongfai) identity mark reused everywhere (launcher
 * FAB, panel header, welcome hero, every assistant-side bubble/notice) — a
 * composition of the DESIGN.md §3 icon-chip pattern (rounded-full
 * bg-primary/10 tint chip), NOT a new primitive (design.md §Avatar).
 *
 * CAM-426 (DESIGN.md §2.1 sanctioned exception): the flame itself now reads
 * as a small gentle campfire — `fill-current text-ai-ember` (the warm ember
 * token, not literal orange) with the `ai-flame-glow` dim opacity/scale
 * pulse (motion-safe, no-op under `prefers-reduced-motion`) — while the chip
 * background stays the existing teal `bg-primary/10` tint, so the mark holds
 * both the teal calm-confidence POV (BR-2) and the campfire warmth.
 *
 * Decorative only: `aria-hidden` — the name/role text carries the meaning,
 * per `.claude/rules/loading.md` §5 ("decorative shapes aria-hidden").
 */
import { Flame } from "lucide-react";

const SIZE = {
  sm: { wrapper: "h-8 w-8", icon: "size-4" },
  md: { wrapper: "h-10 w-10", icon: "size-5" },
  lg: { wrapper: "h-12 w-12", icon: "size-6" },
} as const;

interface AiChatAvatarProps {
  size: keyof typeof SIZE;
}

export function AiChatAvatar({ size }: AiChatAvatarProps) {
  const { wrapper, icon } = SIZE[size];
  return (
    <div
      aria-hidden="true"
      data-testid="img--ai-chat-avatar"
      className={`flex shrink-0 items-center justify-center rounded-full bg-primary/10 ${wrapper}`}
    >
      {/* ai-flame-glow is itself gated inside a prefers-reduced-motion:no-preference
          media block in globals.css (static under reduce-motion) — no motion-safe: prefix needed. */}
      <Flame className={`ai-flame-glow fill-current text-ai-ember ${icon}`} />
    </div>
  );
}

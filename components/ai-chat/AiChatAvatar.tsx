/**
 * components/ai-chat/AiChatAvatar.tsx — CAM-411
 *
 * The single น้องกองไฟ (Kongfai) identity mark reused everywhere (launcher
 * FAB, panel header, welcome hero, every assistant-side bubble/notice) — a
 * composition of the DESIGN.md §3 icon-chip pattern (rounded-full
 * bg-primary/10 tint + text-primary lucide icon), NOT a new primitive
 * (design.md §Avatar). Brand-tinted teal (not literal orange fire) to hold
 * the teal calm-confidence POV (BR-2).
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
      <Flame className={`text-primary ${icon}`} />
    </div>
  );
}

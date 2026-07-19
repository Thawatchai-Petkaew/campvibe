/**
 * components/ai-chat/AiChatAvatar.tsx — CAM-411 (flame recolor: CAM-426;
 * fire-toned chip + aura halo: CAM-432)
 *
 * The single น้องกองไฟ (Kongfai) identity mark reused everywhere (launcher
 * FAB, panel header, welcome hero, every assistant-side bubble/notice) — a
 * composition of the DESIGN.md §3 icon-chip pattern (rounded-full tint
 * chip), NOT a new primitive (design.md §Avatar).
 *
 * CAM-426 (DESIGN.md §2.1 sanctioned exception): the flame itself now reads
 * as a small gentle campfire — `fill-current text-ai-ember` (the warm ember
 * token, not literal orange) with the `ai-flame-glow` dim opacity/scale
 * pulse (motion-safe, no-op under `prefers-reduced-motion`).
 *
 * CAM-432 (owner staging feedback + reference image): the chip moves from
 * the CAM-426 teal `bg-primary/10` to a fire-toned `bg-ai-ember/10` (the
 * mark read "plain" against teal per the owner's screenshot review) and
 * gains a VISIBLE flickering aura halo behind it — a decorative `-z-10` span
 * carrying `shadow-ai-flame-aura` + `ai-flame-flicker` (static under
 * `prefers-reduced-motion`, DESIGN.md §2.1's ai-flame-flicker exception line).
 *
 * CAM-435 (R2 owner staging feedback): the CAM-432 `ai-flame-flicker` aura
 * was too intense on marks that show ALL THE TIME (this component is reused
 * by both the persistent header/launcher avatar AND the CAM-425/433 loading
 * indicator). New `intensity` prop — `'calm'` (default, persistent marks)
 * uses the gentler `ai-flame-glow` pulse on the aura ring; `'loading'` keeps
 * the strong `ai-flame-flicker` (owner: intense is fine while genuinely
 * loading). Both classes are already static under `prefers-reduced-motion`
 * (globals.css) — unchanged by this split. No new keyframe/token added.
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
  /** CAM-435: 'calm' (default) for persistent marks, 'loading' for the async loading surface only. */
  intensity?: "calm" | "loading";
}

export function AiChatAvatar({ size, intensity = "calm" }: AiChatAvatarProps) {
  const { wrapper, icon } = SIZE[size];
  const auraMotionClass = intensity === "loading" ? "ai-flame-flicker" : "ai-flame-glow";
  return (
    <div
      aria-hidden="true"
      data-testid="img--ai-chat-avatar"
      className={`relative flex shrink-0 items-center justify-center rounded-full bg-ai-ember/10 ${wrapper}`}
    >
      {/* CAM-432 fire aura: visible radial halo behind the chip. -z-10 keeps
          it strictly behind the flame; static under prefers-reduced-motion
          (gated in globals.css, see the ai-flame-flicker keyframe).
          CAM-435: gentle ai-flame-glow by default, ai-flame-flicker only
          while intensity="loading". */}
      <span className={`pointer-events-none absolute inset-0 -z-10 rounded-full shadow-ai-flame-aura ${auraMotionClass}`} />
      {/* ai-flame-glow is itself gated inside a prefers-reduced-motion:no-preference
          media block in globals.css (static under reduce-motion) — no motion-safe: prefix needed. */}
      <Flame strokeWidth={1} className={`ai-flame-glow fill-current text-ai-ember ${icon}`} />
    </div>
  );
}

## Story
As a **Camper**, I want น้องกองไฟ's mark to actually look like a campfire (a warm flame with a glowing, flickering aura) and the chat launcher to sit a little higher on the screen, so that the assistant reads as alive and on-brand instead of "plain", and the launcher button is easier to reach with my thumb.
Why: direct owner staging feedback against a reference image — the shipped mark (CAM-426/CAM-429) used a teal disc with only a faint depth shadow; it read as a generic icon-chip, not a campfire.
Scope: `components/ai-chat/AiChatLauncher.tsx`, `components/ai-chat/AiChatAvatar.tsx`, `app/globals.css`, `DESIGN.md` (§2.1 exception line only). Does NOT touch `AiChatPanel.tsx` / `AiChatMessageList.tsx` (parallel sibling stories own those files).
Depends on: CAM-411 (Flame avatar identity), CAM-426 (closed `--ai-*` token set + `ai-flame-glow`, DESIGN.md §2.1 sanctioned exception), CAM-429 (launcher's `bottom-6 right-6` reset + ember/firefly dots)

## AC
| # | Given | When | Then (user sees, Thai verbatim) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | Camper sees the chat launcher or the in-panel header avatar | Either surface renders | วงกลมรอบเปลวไฟเป็นโทนสีส้มอุ่นแบบกองไฟ ไม่ใช่สีเขียวอมฟ้า | Both surfaces' chip/disc background is `bg-ai-ember/10` (was teal `bg-primary/10` on the avatar, teal `bg-primary` on the launcher's default Button variant); the Flame icon itself is unchanged (`text-ai-ember`, `fill-current`) | EC-1 |
| AC-2 | Camper sees either mark | Either surface renders | มีแสงเรืองแบบกองไฟล้อมรอบวงกลมอย่างเห็นได้ชัด | A decorative `-z-10`, `pointer-events-none` span behind the chip/button carries the new `shadow-ai-flame-aura` token (fire-toned, distinctly stronger than the old `shadow-ai-glow`) | EC-2 |
| AC-3 | Camper's OS has no reduced-motion preference | Either mark is on screen | แสงกองไฟวูบวาบเบาๆ อย่างต่อเนื่อง | The aura span also carries `ai-flame-flicker` (opacity + brightness + a slight scale oscillation, ~2.6s loop, `ease-in-out infinite`) | AC-4 |
| AC-4 | Camper's OS has `prefers-reduced-motion: reduce` set | Either mark is on screen | แสงกองไฟนิ่ง ไม่มีการวูบวาบ | `ai-flame-flicker`'s `animation` resolves to `none` inside the `prefers-reduced-motion: reduce` media block (same gate as the 3 existing named loops) | AC-3 |
| AC-5 | Camper is on the Home page | The chat launcher renders | ปุ่มแชทลอยสูงขึ้นจากมุมขวาล่างเดิมเล็กน้อย กดง่ายขึ้นด้วยนิ้วหัวแม่มือ | The launcher's wrapper moves from `fixed bottom-6 right-6` to `fixed bottom-10 right-6`; `HostOnboardingFab` (bottom-6 left-6) is unaffected, no collision | — (layout-only, no failure twin) |

## Rules
- BR-1 The aura halo is a SEPARATE decorative layer (`<span aria-hidden pointer-events-none className="... -z-10 ...">`) behind the interactive control/chip — never applied directly to the `<Button>` or the flame `<svg>` itself — so the flicker's `opacity`/`transform` never fights the Button's own `hover:scale-105`/`active:scale-95` transition.
- BR-2 The aura token (`--ai-flame-aura`) is built ONLY from the already-closed `--ai-ember`/`--ai-firefly` hues (no new hue introduced); it is declared in both `:root` (light) and `.dark` per the existing CAM-426 convention, and mapped to a `shadow-ai-flame-aura` Tailwind utility via `@theme inline` (same mechanism as the pre-existing `shadow-ai-glow`).
- BR-3 `ai-flame-flicker` is a NEW named keyframe — permitted only because DESIGN.md §2.1 is amended in this same story to record it (owner-approved, assistant น้องกองไฟ mark only); it is transform/opacity(+filter)-only, gated inside `@media (prefers-reduced-motion: no-preference)`, and turned off (`animation: none`) inside the existing `@media (prefers-reduced-motion: reduce)` block alongside the other 3 named loops. Any FURTHER new motion beyond these 4 routes back to full human G2.
- BR-4 The launcher's reposition is layout-only (`bottom-6` → `bottom-10`, `right-6` unchanged); it does not change the FAB's size (`h-12 w-12`, tap target 48px ≥ 44px) or its interaction states (hover/active scale unchanged).

## Edge cases
- EC-1 IF the avatar/launcher renders in dark mode THEN the chip tint and the aura halo use the `.dark` `--ai-ember`/`--ai-firefly`/`--ai-flame-aura` values (brighter, per the existing CAM-426 dark-mode convention) — never the light-mode values.
- EC-2 IF the aura span is present THEN it never intercepts a pointer event or confuses assistive tech (`pointer-events-none` always set; `aria-hidden="true"` on the launcher's span, and implicitly hidden via the already-`aria-hidden` avatar wrapper).

## Data
No schema change. No migration. Purely presentational (CSS tokens + one class-name rewire on two existing components).

## Seams & refs
- Reuse: the CAM-426 closed `--ai-*` token machinery in `app/globals.css` (`:root`/`.dark` custom properties → `@theme inline` → Tailwind utility) — `--ai-flame-aura` follows the exact same pattern as `--ai-glow`/`shadow-ai-glow`. The 3 existing named-loop idiom (`ai-aurora-drift`/`ai-flame-glow`/`ai-materialize`, gated `@media (prefers-reduced-motion)`) is the template for the 4th (`ai-flame-flicker`).
- Refs: CAM-426 (`design.md §7` — original motion justification + DESIGN.md §2.1 exception), CAM-429 (launcher aura + reposition history, ember/firefly dots), CAM-411 (Flame avatar identity mark).

## Out of scope
- `AiChatPanel.tsx` / `AiChatMessageList.tsx` — owned by parallel sibling stories in this epic.
- Any additional new component, token, or motion beyond the aura halo + flicker (a 5th loop, a new hue, a redesigned chip shape) → would require a fresh Designer pass + full human G2.
- Re-tuning the launcher's vertical offset beyond `bottom-10` (e.g. a `bottom-12` variant) — this story ships `bottom-10`; a further owner request re-enters Discovery.

## Self-verify
- AC-1 → `__tests__/cam-432-fire-aura-flicker.test.ts` ("AC-1 — the mark's disc/glow is fire-toned, not teal --primary")
- AC-2 → `__tests__/cam-432-fire-aura-flicker.test.ts` ("AC-2"/"AC-4" — token declared + wired on both surfaces)
- AC-3/AC-4 → `__tests__/cam-432-fire-aura-flicker.test.ts` ("AC-3" — keyframe + motion-safe gate + reduce-motion static)
- AC-5 → `__tests__/cam-432-fire-aura-flicker.test.ts` ("AC-5" — reposition) + updated pre-existing assertions in `__tests__/cam-429-chat-shell-launcher.test.ts`, `__tests__/cam-272-ai-chat-components.test.ts`, `__tests__/cam-411-assistant-personality.test.ts`, `__tests__/cam-426-ai-expression-layer.test.ts` (stale teal/`shadow-ai-glow`/`bottom-6` pins updated to the new canonical values, per code.md's "update the guard to the new canonical class" rule)
- Gate = `/quality-gate` (lint 0 errors / typecheck / test / build + `check:ds`/`check:palette` green) · Done = every AC verified on localhost (dev DB) before merge into `dev`

## Changelog
- v1 (2026-07-19) — created

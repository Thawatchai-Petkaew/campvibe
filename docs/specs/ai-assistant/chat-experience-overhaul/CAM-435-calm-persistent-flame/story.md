## Story
As a **Camper**, I want น้องกองไฟ's flame to sit calm on the marks that are ALWAYS on screen (the chat-header avatar, the launcher FAB), so that the interface stops feeling restless while I browse — with the intense วูบวาบ flicker reserved for the moment the assistant is genuinely loading something for me.
Why: R2 owner staging feedback — the CAM-432 `ai-flame-flicker` aura, applied everywhere the mark appears, reads as too intense on marks that show ALL THE TIME; the owner asked for a calm/loading split.
Scope: `components/ai-chat/AiChatAvatar.tsx` (new `intensity` prop), `components/ai-chat/AiChatLauncher.tsx` (aura ring swap), `components/ai-chat/AiChatMessageList.tsx` (pass `intensity="loading"` on the resuming branch only). Does NOT touch `app/globals.css` (no new keyframe/token — reuses the existing `ai-flame-flicker` + `ai-flame-glow` classes, both already static under `prefers-reduced-motion`) or `AiChatPanel.tsx` (its header avatar picks up the new calm default with zero changes there).
Depends on: CAM-432 (closed `ai-flame-flicker`/`ai-flame-glow` classes + `--ai-flame-aura` token, reused unchanged), CAM-433 (the resuming/loading branch this story now marks `intensity="loading"`), CAM-434 (the root-layout-mounted launcher FAB this story recolors)

## AC
| # | Given | When | Then (user sees, Thai verbatim) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | Camper is on any page, chat closed | The launcher FAB renders (persistent mark) | เปลวไฟที่ปุ่มลอยเรืองแสงนุ่มนวล ไม่วูบวาบแรง | `AiChatLauncher`'s aura ring span uses `ai-flame-glow` (not `ai-flame-flicker`); the `Flame` icon's own `ai-flame-glow` pulse is unchanged | EC-1 |
| AC-2 | Camper opens the chat panel | The header renders `AiChatAvatar size="md"` (persistent mark) | เปลวไฟที่หัวข้อแชทเรืองแสงนุ่มนวลเช่นกัน | `AiChatAvatar` defaults `intensity` to `"calm"`; its aura ring span resolves to `ai-flame-glow` | EC-1 |
| AC-3 | Camper opens the chat panel and the latest conversation is being fetched | The resuming/loading indicator renders | เปลวไฟกลางจอวูบวาบแรงขณะกำลังโหลด | `AiChatMessageList` renders `<AiChatAvatar size="lg" intensity="loading" />`; `AiChatAvatar`'s aura ring span resolves to `ai-flame-flicker` only in this branch | AC-1/AC-2 |
| AC-4 | Camper's OS has `prefers-reduced-motion: reduce` set | Any of the three marks render | เปลวไฟนิ่ง ไม่มีการวูบวาบไม่ว่าจะเป็นมาร์คไหน | Both `ai-flame-glow` and `ai-flame-flicker` remain gated `@media (prefers-reduced-motion: reduce)` in `globals.css` (untouched by this story) | — (regression guard, no failure twin) |

## Rules
- BR-1 `AiChatAvatar` gets one new optional prop `intensity?: "calm" | "loading"`, default `"calm"`. The decorative aura ring span's motion class is `intensity === "loading" ? "ai-flame-flicker" : "ai-flame-glow"`; the `Flame` icon itself keeps its own `ai-flame-glow` pulse unconditionally (unchanged).
- BR-2 No new CSS/keyframe/token is introduced — both `ai-flame-glow` and `ai-flame-flicker` already exist in `app/globals.css` (CAM-432) and are already gated static under `prefers-reduced-motion: reduce`; this story only changes which existing class each call site's aura ring resolves to.
- BR-3 `AiChatLauncher`'s own aura ring span (the persistent FAB, mounted root-wide per CAM-434) hardcodes `ai-flame-glow` — it never receives an `intensity` prop because it does not reuse `AiChatAvatar`, it has its own inline aura span.
- BR-4 Only the CAM-425/433 resuming branch inside `AiChatMessageList` passes `intensity="loading"`; the welcome-hero avatar (`AiChatAvatar size="lg"`, shown once entries are empty and nothing is loading) and the panel-header avatar (`AiChatAvatar size="md"` in `AiChatPanel.tsx`) both keep the `"calm"` default with no code change at their call sites.

## Edge cases
- EC-1 IF the camper inspects the DOM of the launcher FAB or the panel header avatar THEN neither's aura ring span carries `ai-flame-flicker` as a live className (Prove-It: present before this fix on both, absent after).

## Data
No schema change. No migration. Purely presentational (one new component prop + two call-site edits; no new CSS/token).

## Seams & refs
- Reuse: `AiChatAvatar`'s existing `ai-flame-flicker`/`ai-flame-glow` classes and `shadow-ai-flame-aura` token (CAM-432, `app/globals.css`), unchanged.
- Refs: CAM-432 (`docs/specs/ai-assistant/chat-experience-overhaul/CAM-432-fire-aura-flicker/story.md` — the aura token + both motion classes this story reuses), CAM-433 (`docs/specs/ai-assistant/chat-experience-overhaul/CAM-433-loading-flame/story.md` — the resuming branch that now opts into `intensity="loading"`), CAM-434 (`docs/specs/ai-assistant/chat-experience-overhaul/CAM-434-global-launcher/story.md` — the root-mounted launcher FAB recolored here).

## Out of scope
- `app/globals.css` — no new keyframe/token; both motion classes already exist and are already reduced-motion-safe.
- Any change to `AiChatPanel.tsx` — its header avatar call site is untouched, it simply inherits the new `"calm"` default.
- Any change to the welcome-hero avatar — stays `"calm"` (default), unchanged call site.

## Self-verify
- AC-1/EC-1 (launcher) → `__tests__/cam-432-fire-aura-flicker.test.ts` + `__tests__/cam-429-chat-shell-launcher.test.ts` (both updated: aura ring pin moved from `ai-flame-flicker` → `ai-flame-glow`)
- AC-2/EC-1 (header, calm default) → `__tests__/cam-432-fire-aura-flicker.test.ts` (`AiChatAvatar`'s aura span now asserts the `auraMotionClass` ternary + the default-calm behavior)
- AC-3 (resuming = loading) → `__tests__/cam-433-loading-flame.test.ts` + `__tests__/cam-425-centered-loading-and-single-thread.test.ts` (both updated: pin `<AiChatAvatar size="lg" intensity="loading" />`) + `__tests__/cam-411-assistant-personality.test.ts` (welcome-hero vs resuming occurrence counts split)
- AC-4 → unchanged reduce-motion gate in `app/globals.css`, asserted across the same test files (no new test needed, dependency untouched)
- Gate = `/quality-gate` (lint 0 errors / typecheck / test / build + `check:ds`/`check:palette` green) · Done = every AC verified on localhost (dev DB) before merge into `dev`

## Changelog
- v1 (2026-07-19) — created

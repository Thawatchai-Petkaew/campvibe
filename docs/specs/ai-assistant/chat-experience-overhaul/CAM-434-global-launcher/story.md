## Story
As a **Camper**, I want the น้องกองไฟ chat launcher to float on every page of the app (not only Home), so that I can ask a question wherever I am browsing without navigating back to Home first.
Why: direct owner staging feedback — the launcher currently only mounts inside `app/page.tsx` (Home), so it disappears on `/campgrounds`, `/bookings`, `/dashboard`, etc.
Scope: `app/layout.tsx` (mount point), `app/page.tsx` (remove the now-duplicate Home mount), `components/ai-chat/AiChatLauncher.tsx` (doc comment + route-hide guard for two internal, non-consumer surfaces). Does NOT touch `AiChatMessageList.tsx` (parallel sibling story CAM-433 owns that file) or `AiChatPanel.tsx`.
Depends on: CAM-272 (launcher + lazy panel), CAM-429/CAM-432 (launcher position + fire aura, unchanged by this story)

## AC
| # | Given | When | Then (user sees, Thai verbatim) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | Camper is on any consumer route other than Home (e.g. `/campgrounds`, `/bookings`, `/dashboard`) | The page finishes rendering | ปุ่มแชทลอยมุมขวาล่างปรากฏเหมือนกับหน้าแรก | `AiChatLauncher` renders from the root layout (`app/layout.tsx`), mounted once for the whole app instead of only inside `app/page.tsx` | EC-1 |
| AC-2 | Camper is on Home (`/`) | The page finishes rendering | ปุ่มแชทลอยปรากฏเหมือนเดิม (ไม่ซ้ำสองปุ่ม) | The Home-specific mount is removed from `app/page.tsx`; the single root-layout instance is the only one on screen | AC-1 |
| AC-3 | Any route renders for the first time this session | Camper has not yet tapped the launcher | หน้าโหลดเร็วเหมือนเดิม ไม่มีอะไรหน่วงเพิ่ม | The chat panel + ambient canvas stay `next/dynamic(ssr:false)`; every route's initial JS still pays only for the small launcher button, never the panel | EC-2 |
| AC-4 | Camper is on the token-gated `/status` delivery dashboard or `/status/map` 3D board | The page renders | ไม่มีปุ่มแชทซ้อนทับแดชบอร์ดภายใน | The launcher does not render on `/status` or `/status/map` (internal, token-gated ops tooling with fixed self-contained styling — not a consumer surface) | — (internal-tool exclusion, not a user-facing failure path) |
| AC-5 | Site is in the pre-launch `/coming-soon` holding state | The page renders | หน้าเร็วๆ นี้ไม่มีปุ่มแชทลอย (ยังนำทางไปที่อื่นไม่ได้) | The launcher does not render on `/coming-soon`, consistent with that page's existing "no navigation" holding-page design | — (internal/gate exclusion, not a user-facing failure path) |

## Rules
- BR-1 The launcher mounts exactly once per page load, from `app/layout.tsx`, inside the existing client provider tree (`Providers` → `LanguageProvider`) so `useLanguage()` stays available; it is NOT re-mounted per-route.
- BR-2 The heavy panel (`AiChatPanel`, including `AiAmbientCanvas`) stays `next/dynamic(..., { ssr: false })` and mounts only after the first tap (`{open && <AiChatPanel .../>}`) — unchanged from CAM-272/CAM-411/CAM-429. This story only moves the mount point, never the lazy-loading contract.
- BR-3 The route-hide list is a small, explicit set (`/coming-soon`, `/status` and its sub-paths) — not a general per-route configuration table. Any future addition to this list re-enters Discovery rather than growing ad hoc.

## Edge cases
- EC-1 IF a route has no `Navbar`/`HostOnboardingFab` (e.g. `/login`, `/register`) THEN the launcher still renders at `fixed bottom-10 right-6` with no collision, since `HostOnboardingFab` lives inside `Navbar`, a separate component tree.
- EC-2 IF the user never taps the launcher on a given page visit THEN `AiChatPanel`/`AiAmbientCanvas` never enter that page's rendered tree (verified by the existing `{open && <AiChatPanel`) guard, unchanged from CAM-272).

## Data
No schema change. No migration. Purely a component-mount relocation + a 2-route visibility guard.

## Seams & refs
- Reuse: the existing `next/dynamic(ssr:false)` lazy contract in `AiChatLauncher.tsx` (CAM-272) — untouched.
- Reuse: `usePathname()` (already the idiomatic Next.js App Router way other client components in this repo read the current route).
- Refs: CAM-272 (original Home-only launcher + lazy panel), CAM-429/CAM-432 (launcher position/aura, unaffected), CAM-433 (parallel sibling story, message list — not touched here).

## Out of scope
- `AiChatMessageList.tsx` / `AiChatPanel.tsx` internals — owned by CAM-433 / prior stories.
- A general per-route allow/deny configuration system for the launcher — only the two named internal surfaces are excluded; anything broader is a fresh ticket.
- Any visual/position change to the launcher itself (aura, offset) — unchanged from CAM-432.

## Self-verify
- AC-1/AC-2 → `__tests__/cam-434-global-launcher.test.ts` (`app/layout.tsx` mounts `<AiChatLauncher`, `app/page.tsx` no longer does) + updated stale assertion in `__tests__/cam-272-ai-chat-components.test.ts` (BR-1 describe block, "mounts unconditionally on Home" → "mounts unconditionally from the root layout")
- AC-3 → `__tests__/cam-434-global-launcher.test.ts` + pre-existing lazy-load assertions in `__tests__/cam-272-ai-chat-components.test.ts` (unchanged, still pass)
- AC-4/AC-5 → `__tests__/cam-434-global-launcher.test.ts` ("route-hide guard excludes /status and /coming-soon")
- Gate = `/quality-gate` (lint 0 errors / typecheck / test / build + `check:ds`/`check:palette` green) · Done = every AC verified on localhost (dev DB) before merge into `dev`

## Changelog
- v1 (2026-07-19) — created

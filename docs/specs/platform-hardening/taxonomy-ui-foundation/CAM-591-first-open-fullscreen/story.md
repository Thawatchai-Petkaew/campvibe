## Story
As a **Camper**, I want the assistant to open full screen the very first time I use it, so that I land in an immersive, easy-to-read view instead of a cramped floating panel on my very first encounter with น้องกองไฟ.
Why: owner instruction 2026-07-27 — a first-time camper should meet a full, deliberate experience, not the anchored corner card that only makes sense once they already trust the assistant.
Scope: change only the no-stored-value fallback inside `AiChatPanel`'s `readExpandedFromStorage()` (desktop `sm:`+; mobile is already full-screen-only per CAM-550, untouched). A returning camper's own explicit collapse/expand choice, once stored, always wins over this default.
Depends on: CAM-429 (introduced the `expanded` state + `ai-chat-expanded` sessionStorage key) · CAM-550 (mobile full-screen-only, unaffected)

## AC
| # | Given | When | Then (user sees, Thai verbatim) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | A camper on desktop (`sm:`+) has never opened the assistant in this browser tab (no `ai-chat-expanded` key in `sessionStorage`) | The camper taps the น้องกองไฟ launcher button | The assistant opens **full screen** (the same immersive layout the existing expand toggle already produces) | `expanded` state initializes `true`; no write happens until the camper explicitly toggles | EC-1 |
| AC-2 | A camper previously pressed the collapse control and it persisted `ai-chat-expanded=0` in this tab's `sessionStorage` | The camper reopens the assistant (same tab) | The assistant opens as the **anchored panel** (their own last choice), not full screen | `expanded` state initializes `false` from the stored value | EC-2 |
| AC-3 | A camper previously pressed the expand control and it persisted `ai-chat-expanded=1` | The camper reopens the assistant (same tab) | The assistant opens **full screen** | `expanded` state initializes `true` from the stored value | — (same mechanism as AC-2, no new failure mode) |
| AC-4 | Any camper on a viewport below the `sm` breakpoint (mobile) | The camper opens the assistant | Behavior is **unchanged from CAM-550** — always full screen, no minimize control | No change to mobile geometry/toggle visibility | — (CAM-550 already covers mobile; this story does not touch it) |

## Rules
- BR-1 `readExpandedFromStorage()` returns `true` when `sessionStorage.getItem("ai-chat-expanded")` is `null` (the key was never written — a brand-new tab/user). This is the changed fallback (previously returned `false`).
- BR-2 `readExpandedFromStorage()` returns `false` only when the stored value is exactly `"0"`, and `true` only when it is exactly `"1"` — an explicit stored choice always overrides the BR-1 default, in either direction.
- BR-3 A `sessionStorage` read failure (privacy mode / access blocked) falls back to `false` (unchanged from CAM-429) — pre-existing safe-fallback behavior, not part of this story's scope.
- BR-4 No new `sessionStorage` write is introduced — the first full-screen open persists nothing on its own; a write only happens when the camper explicitly presses expand/collapse (unchanged `toggleExpanded`, CAM-429).

## Edge cases
- EC-1 IF the camper's very first open happens on mobile (below `sm`) THEN CAM-550's mobile-only-fullscreen rule governs instead — no behavior change (context only, not this story's surface).
- EC-2 IF the stored value is the empty string or any value other than `"1"` (corrupted storage, but not `null`) THEN treat it as `"0"` (collapsed) per the existing `=== "1"` check — never crash, never re-force full screen on a value that isn't literally absent.

## Data
- No schema/DB change. Client-only: `sessionStorage` key `ai-chat-expanded` (existing key from CAM-429), read logic only. Migration: none.

## Seams & refs
- Reuse: `components/ai-chat/AiChatPanel.tsx` — `readExpandedFromStorage()` / `writeExpandedToStorage()` (CAM-429); the `expanded` `useState` lazy initializer already calls `readExpandedFromStorage()`, unchanged. Refs: CAM-550 (mobile full-screen, untouched) · CAM-541 (contrast/mobile fixes, untouched).

## Out of scope
- Changing mobile behavior → already correct per CAM-550, no follow-up needed.
- Forcing full screen on every open regardless of the camper's stored choice → explicitly rejected reading of "ครั้งแรก" (first time); would need a new ticket if the owner later wants that instead.

## Self-verify
- AC-1..3 → unit (source-inspection + a behavioral test proving `null` and `"0"` produce different results)
- AC-4 → unit (CAM-550 regression, unchanged)
- Story-specific: prove "never set" is provably distinct from "set to false" in the same test file (the accident this story exists to avoid)
- Gate = /quality-gate · Done = every AC verified on localhost (dev DB) before merge into `dev`

## Changelog
- v1 (2026-07-27) — created

---
linear: CAM-152
feature: ai-workflow
epic: campsite-delivery-map (CAM-150)
persona: platform
artifact: design
owner: ux-designer
status: In Progress
version: v1
updated: 2026-06-24
---
# Design — S2 static scene + characters (CAM-152)

## Flow

Owner opens `/status/map?token=…` → the night-scene shell (from S1) paints → the lazy client scene hydrates → 7 role characters + "You" appear at fixed stations on the isometric map. Each character reads as **working** (glowing, with a task badge) or **at-rest** (calm, "พัก"), and "You" carries a `⚑N` campfire-amber alert when the human has gates to approve. The scene is **static** in S2 — no walking (that is S3) — so the reading is "who is busy, who is idle, what awaits me" at a glance, no interaction required.

Display-first: the scene is the primary narrator. Hover/focus on a character reveals a popover with its role label + current task + workload counts (the overlay panels themselves are S4–S5).

## Design-system exemption

Inherited from `/status` (recorded in CAM-151's design.md): this is an **internal ops dashboard**, exempt from the public OKLCH token rule. The scene's palette is the mockup's palette, carried over verbatim (per-role aura hex from the mockup `AGENTS` config). `check:palette` / `check:ds` apply to the public app, not to this page.

## Characters — role → station → color (ported from the mockup)

| Role | Display | Station node | Aura color | Role label (TH) |
|---|---|---|---|---|
| `architect` | Architect | N | `#8FB8F0` | วางแผนระบบ |
| `ux-designer` | Designer | NE | `#B7A6FF` | UX และวิชวล |
| `backend-engineer` | Backend | E | `#5BE9B0` | API และบริการ |
| `frontend-engineer` | Frontend | SE | `#5FD0DE` | หน้าแอป |
| `devops-release` | DevOps | SW | `#BFE85B` | CI/CD |
| `qa-engineer` | QA | W | `#F39FD2` | ทดสอบและตรวจสอบ |
| `security-reviewer` | Security | NW | `#FF8A7A` | ความปลอดภัย |
| `human` → **You** | คุณ | fixed (near bridge) | `#FFB454` (campfire amber) | — |

Stations are fixed percent coords (`NODES`), depth-sorted by `y` so nearer characters overlap correctly. The 7 build-roles always appear (calm if they have no work); You always appears.

## The 8 states (per DESIGN.md state coverage)

| State | What the user sees | Bound to |
|---|---|---|
| **default / idle (at-rest)** | Character standing in its relax pose, muted name badge, "พัก" status. No glow. | `rmap[role].active === 0` |
| **working** | Character glows (aura ring + colored badge dot), badge shows the active task id; popover shows `{id} · clean(title)`. | `rmap[role].active > 0`; task = the role's `isActive` story |
| **hover / focus** | Popover appears: role label chip + current task (or "ว่างอยู่ รอ task ใหม่") + workload line `{done} เสร็จแล้ว · {activeCount} กำลังทำ · {queued} รอคิว`. | hover/`:focus-visible` |
| **You — calm** | "You" at the campfire, no alert badge, "ปกติ" status. | `gates.length === 0` |
| **You — gated** | Amber `⚑N รอตรวจสอบ` alert above You (`role="alert"`); popover lists each gate id + title. | `gates.length === N > 0` |
| **loading** | (S1 shell) glass card "กำลังโหลดแผนที่แคมป์" until the scene hydrates. | dynamic import pending |
| **error** | (S1) glass placeholder "โหลดข้อมูลไม่ได้: …"; background still paints. | fetch failure |
| **empty** | Model has no stories → all 7 characters at-rest, You calm, stat bar "0% ความคืบหน้าโปรเจกต์". | `buildModel([])` |

## Anti-slop notes (the crux of this epic)

The plan's anti-slop rule: **every movement/signal binds to real data, except ambient.**

- **Allowed ambient (decorative):** the `breathe` idle-sway and the aurora/stars — these are atmosphere, not data, and are the **first to disable** under `prefers-reduced-motion: reduce`.
- **Data-bound (never faked):** the glow, the working badge, the task speech, the You `⚑N` badge, the stat-bar percentage and gate count — all derived from `buildModel` (`rmap`, `gates`, `projectPct`). No character glows or "walks" to look busy.
- **Speech only when real:** a working character's task badge/popover renders only when there is a real `clean(title)` to show; idle characters say "ว่างอยู่ รอ task ใหม่", not decorative filler.
- **Props stay inert:** tents/trees/the campfire backdrop never glow to fake meaning; only the data-bound aura glows.

## a11y (S2 baseline)

- Scout layer `role="list"`; each character `role="listitem"` + `tabIndex={0}` + an `aria-label` that states role + working/idle/gate state — so the scene is not color-only; the status is in the accessible name and the visible badge text.
- You gate alert is `role="alert"` with `aria-label="{N} gate รอการอนุมัติ"`.
- Motion (`auraPulse` / `breathe` / badge glow / alert pulse) is wrapped in `@media (prefers-reduced-motion: no-preference)`; at `reduce` the scene is fully static with the labels still readable. (S2 has no walking, so reduced-motion is satisfied for this story; the full keyboard-to-gate/agent + focus-trap pass is S7.)
- Contrast of the glass badges: **not measured with a tool** in S2; the mockup palette is carried over and the full axe pass is S7's gate.

## Copy

All user-visible copy is plain Thai, no jargon, no em-dash separator: "พัก", "ปกติ", "คุณ", "ว่างอยู่ รอ task ใหม่", "{N} รอตรวจสอบ", "{N} gate รอ", "{done} เสร็จแล้ว · {activeCount} กำลังทำ · {queued} รอคิว", "ความคืบหน้าโปรเจกต์".

## Design gate checklist (S2 scope)

- [x] Characters/colors/stations ported verbatim from the mockup; internal-ops token exemption inherited.
- [x] Every visible signal binds to `buildModel` data (anti-slop) — only `breathe`/aurora are ambient.
- [x] Speech/task text renders only when a real title exists.
- [x] You `⚑N` derived from `gates.length`; hidden at 0.
- [x] All copy plain Thai, no jargon, no em-dash.
- [x] Reduced-motion: ambient disabled, scene readable static (full a11y pass deferred to S7).
- [x] Sprites are static `/public` WebP, no base64 in the bundle.

## Links

`story.md` · `tech.md` · `../feature.md` · `design/campvibe-campsite.html` · `design/campsite-status-adaptation-spec.md` · `~/.claude/plans/status-delightful-map.md` (scene semantics + anti-slop) · `DESIGN.md`

## Changelog

- v1 (2026-06-24) — design artifact authored; documented characters/stations/colors, the 8 states, and the anti-slop rules realized in the static scene.

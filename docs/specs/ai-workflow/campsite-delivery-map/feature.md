---
artifact: epic
feature: ai-workflow
epic: campsite-delivery-map (CAM-150)
status: In Progress
version: v1
updated: 2026-06-24
---

# Campsite delivery map — /status/map (CAM-150)

## Why

`/status` communicates delivery status completely — who is doing what, what is awaiting the human, how far along, what is stuck — but it does so as a table/data panel that reads like a report. The owner wants a view that conveys the whole status **at a glance, before drilling into detail**: a playful isometric campsite scene where each role-agent stands/works on a map, mirroring `/status` in a sibling route that reuses the exact same data spine.

It is a **separate part** from the existing `/status` page (new route `/status/map`, the original page is not rewritten) with a segmented **Dashboard ⇄ Map** toggle that carries context (epic / filter / token) across both. Every number on the map is **derived from the same source as `/status`** (`fetchStatusIssues` + `buildModel` + `lib/status-derive.ts`) — no fabricated values, no new data path.

Source of truth for the look: the owner supplied a mockup (`design/campvibe-campsite.html`) + spec v2 (`design/campsite-status-adaptation-spec.md`). This epic turns that mockup into a real, Linear-bound feature that passes the design gate.

**KPI:** the owner can read the team's overall delivery state (who is working, what is awaiting them, how far along, what is stuck) from the scene in one glance, before opening any panel; every signal on the map traces back to a real `buildModel` field (anti-slop: no decorative motion stands in for data).

## Decisions (locked at G1)

| Topic | Choice |
|---|---|
| Motion model | **Hybrid (real + alive)** — idle-sway always-on so the scene feels alive, but a character "walks" between stations only when a real state change happens (handoff / column move / new active story). |
| First-version scope | **Full spec as an epic** — isometric scene + animation + 7 overlays + both Project & Epic scope + real-time — split into ~7 atomic stories. |
| Character art | **Reuse the mockup's sprites** — extract the base64 frames from `campvibe-campsite.html` into WebP under `public/status-map/sprites/`. |
| Route | `/status/map` as a **sibling** of `/status`, sharing the same `STATUS_TOKEN` gate. |
| Data | **Reuse the data spine** — `fetchStatusIssues` + `buildModel` + `lib/status-derive.ts`; no new Linear query/schema. |
| Real-time | Reuse the existing SSE/pulse, but **refetch the JSON model and reconcile** rather than `router.refresh()` (which would remount and reset the scene). |
| Linkage | Segmented **Dashboard ⇄ Map** button carries `epic` / `group` / `efilter` / `token` across both pages so context is not lost. |

## Scope — the 7 stories (in dependency order)

| # | CAM-id | Goal | Status |
|---|---|---|---|
| **S1** | CAM-151 | Extract the shared `lib/status-model.ts` (shared `buildModel`) + scaffold the `/status/map` route shell + assets | Built (this branch) |
| **S2** | CAM-152 | Static scene + characters from real data + extract sprites to `/public` | Built (this branch) |
| **S3** | — | Walk/rest/idle-sway engine (hybrid model) + reduced-motion guard | Not started |
| **S4** | — | Overview overlays (Delivery / Crew / Env / Backlog) + `<Overlay>` primitive | Not started |
| **S5** | — | Epic scope + scope switcher + Progress / Up-next / Board | Not started |
| **S6** | — | Real-time reconcile + Dashboard ⇄ Map linkage | Not started |
| **S7** | — | a11y / perf / reduced-motion gate + every state | Not started |

S1 and S2 are built and self-verified on this branch (`feature/cam-151-status-map-shared-model`), uncommitted, PR pending. S3–S7 follow in order.

## Out of scope (epic-level)

- Rewriting the existing `/status` page (except S1's extract-and-import — which must render identically — and S6 adding the link button).
- Adding any new Linear query or schema.
- Payment / any cost-incurring path (the whole epic uses data + assets already in the repo).

## Links

- Plan: `~/.claude/plans/status-delightful-map.md`
- Mockup: `design/campvibe-campsite.html` · Spec: `design/campsite-status-adaptation-spec.md`
- Epic ticket: [CAM-150](https://linear.app/campvibe/issue/CAM-150/campsite-delivery-map-statusmap)
- Reuse: `app/status/page.tsx` · `lib/status-derive.ts` · `lib/linear.ts` · `app/status/dashboard-client.tsx` · `app/api/status/stream/route.ts`
- Stories: `CAM-151-s1-shared-model-route-shell/` · `CAM-152-s2-scene-characters/`

## Changelog

- v1 (2026-06-24) — epic rollup authored; S1 (CAM-151) + S2 (CAM-152) built and self-verified on `feature/cam-151-status-map-shared-model`; G1 decisions recorded; S3–S7 scoped.

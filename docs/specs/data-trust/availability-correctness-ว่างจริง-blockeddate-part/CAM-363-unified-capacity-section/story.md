<!--
ticket: CAM-363
epic: Availability Correctness — ว่างจริง (BlockedDate + partial capacity + hold)
feature: Data & Trust
status: Draft (proposed for G1, folded into the G3 packet per Gate policy v2)
version: v1
spec-class: SPEC-LITE (S) — no schema/migration, no new API contract (reuses
  the CAM-351 mode chooser + the CAM-361/CAM-352 spots CRUD verbatim), single
  file-surface (CampgroundForm.tsx + one additive prop on
  spot-management-section.tsx). Qualifies per .claude/rules/ops.md Gate
  policy v2 §G1.
persona: Host
-->

## Story
As a **Host**, I want the capacity-mode chooser and the spot manager to live in ONE section on the campsite edit page, so that I never have to hunt for a separate "Capacity & Ground Type" card in one place and a separate spot list further down the page for the same decision.
Why: CAM-351 built the mode chooser inside a standalone Capacity card (sidebar); CAM-361 embedded the spot manager as its own full-width section below the form. Splitting one decision (whole-camp vs per-spot) across two disconnected sections left the host jumping between them, and a host who switches back to whole-camp mode while spots still exist had no visible reminder that those spots were still there.
Scope: restructure `components/CampgroundForm.tsx` so the mode chooser (CAM-351, reused verbatim) and the content below it (whole-camp inputs OR the embedded per-spot manager) render as ONE section; the old standalone sidebar Capacity card is removed from its old position (no duplicate capacity UI anywhere on the page); a new persistent hint line covers the "whole-camp mode with lingering live spots" case. Does not change the CAM-351 mode-storage rule, the CAM-361 spot CRUD/zone-grouping logic, or any availability/booking math.
Depends on: CAM-351 (mode chooser, MERGED) · CAM-361 (embedded spot section, MERGED, PR #373).

## AC
<!-- Then = user-visible (screen text = verbatim Thai) · System effect = data outcome, plain language · Neg/edge = failure twin (EC-n/AC-n); — needs a reason. -->
| # | Given | When | Then (user sees, Thai verbatim) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | A host is editing an existing camp | Host scrolls to the capacity section | Sees ONE section titled `ความจุและประเภทพื้น` holding the mode chooser (`กำหนดความจุของแคมป์แบบไหน`) first, then the content for the chosen mode below it — no second, separate capacity card anywhere else on the page | The old standalone sidebar Capacity card no longer renders at its old position; exactly one capacity section exists in the DOM | EC-1 |
| AC-2 | WHOLE-CAMP mode selected | Host views the section | Sees the manual `จำนวนผู้เข้าพักสูงสุดต่อวัน` / `จำนวนเต็นท์สูงสุดต่อวัน (โดยประมาณ)` / ground-type inputs, unchanged from CAM-351 | These inputs stay bound to the campsite form's `อัปเดต`/save button (same `campSiteSchema`, no new validation) | AC-11 (CAM-351) |
| AC-3 | PER-SPOT mode selected, editing an existing camp with a real camp id | Host views the section | Sees the CAM-351 derived-total/empty-state display, then the CAM-361 spot manager (grouped list + filter chips + add/edit/delete) directly below it in the same section | No separate navigation — the spot manager is embedded, reading/writing through the same `/api/campsites/{id}/spots` endpoints CAM-361 already uses | — (embed replaces the former nav link, not a failure path) |
| AC-4 | PER-SPOT mode selected, creating a brand-new camp (no id assigned yet) | Host views the section | Sees the CAM-351 derived-total/empty-state display, then a `จัดการจุดกางเต็นท์` prompt that shows `กรุณาบันทึกแคมป์กราวด์ก่อนสร้างจุดกางเต็นท์` when tapped | No embed is attempted (no camp id exists yet); no spot API call is made | — (create-mode has no id to embed against) |
| AC-5 | WHOLE-CAMP mode is active AND the camp still has 1+ live (non-deleted) spots (e.g. left over from an earlier per-spot period) | Host views the section, in the same load/session where they have NOT just switched modes | Sees a hint `มีจุดกางเต็นท์ {N} จุดอยู่ สลับเป็นรายจุดเพื่อจัดการ` | No data change — a read-only reminder so the leftover spots are never invisible with no path to manage them | EC-2 |
| AC-6 | A completeness-card deep-link to `#zones` | Host clicks the deep-link | Lands on (scrolls to) the unified capacity section, same as before this story | The `id="zones"` anchor now resolves to the unified section instead of the old sidebar card | — (anchor target moved, same id) |

## Rules
- BR-1 The unified section is the SAME `useSpotView` mode chooser CAM-351 shipped (copy, default, storage all unchanged) — CAM-363 only changes WHERE the chooser and its content live on the page, not how the mode is chosen or stored. (proves AC-1, AC-2)
- BR-2 The unified section stays entirely inside the campsite `<form>` — the whole-camp manual inputs must remain form-bound (BR-2 of CAM-351, unchanged: they save with the `อัปเดต`/save button, no separate submit). The embedded per-spot manager's own create/edit/delete dialogs render through a Radix `Portal` straight to `<body>` (verified: `components/ui/dialog.tsx`, `components/ui/alert-dialog.tsx`), so embedding it inside this `<form>` never nests a `<form>` inside a `<form>`. Every interactive control inside `spot-management-section.tsx` that is NOT portal-rendered (edit/delete/retry/add) carries an explicit `type="button"` so it can never accidentally submit the campsite form. (proves AC-3, AC-4)
- BR-3 In PER-SPOT mode, editing an existing camp with a real camp id embeds the CAM-361 `SpotManagementSection` directly (an additive `hideCard` prop nests it inside the unified section's own card chrome instead of rendering a second, stacked card); a create-mode camp (no id yet) shows the existing CAM-351 save-first prompt instead — never an embed attempt against a nonexistent id. (proves AC-3, AC-4)
- BR-4 The old standalone sidebar Capacity card is fully removed from its old position — not duplicated, not left behind. Exactly one capacity section (one `id="zones"`, one `ความจุและประเภทพื้น` heading) exists on the page. (proves AC-1)
- BR-5 A persistent hint renders whenever WHOLE-CAMP mode is active and the camp still has 1+ live spots, EXCEPT in the same moment the richer CAM-351 "just switched to whole-camp" warning is already showing (session-only, more detailed) — the two never show together. (proves AC-5)

## Edge cases
<!-- cover: invalid · empty/zero · concurrent/duplicate · permission · boundary. -->
- EC-1 IF a host looks anywhere else on the edit page for a second capacity card THEN there is none — the old sidebar Capacity card's heading/testid no longer renders at its old location (BR-4)
- EC-2 IF the host just switched PER-SPOT → WHOLE-CAMP this session (the CAM-351 warning is showing) THEN the new persistent hint does NOT also show in that same moment — only one capacity-related notice is visible at a time (BR-5)

## Data
- No schema change, no new endpoint. Reuses `CampSite.useSpotView` / `maxGuestsPerDay` / `maxTentsPerDay` / `groundType` (CAM-351) and the spots CRUD API (CAM-352/CAM-361) verbatim.
- migration: none.

## Seams & refs
- Reuse: `components/CampgroundForm.tsx` (the CAM-351 mode chooser + whole-camp inputs + per-spot derived display, moved and re-composed, not rewritten) · `components/spot-management-section.tsx` (CAM-361's shared component, gains one additive `hideCard` prop) · `locales/translations.json` (`newCampground.*` — one new key, `capacityWholeCampHasSpotsHint`).
- Do NOT touch: the CAM-351 mode-storage rule (`useSpotView`), the CAM-351/CAM-304 listing-completeness predicate, the CAM-361 zone-grouping/filter-chip logic, the spots CRUD API/authz, any availability/booking file.
- Refs: CAM-351 (mode chooser + whole-camp/per-spot rules) · CAM-361 (embedded spot manager, PR #373) · CAM-305 (the `#zones` completeness deep-link this story's anchor must keep resolving).

## Out of scope
- Any change to the CAM-351 mode-storage rule, validation, or the CAM-304/CAM-351 listing-completeness predicate → unchanged, not touched here.
- Any change to spot CRUD, zone grouping, or filter-chip behavior → CAM-361/CAM-352, unchanged here.
- A new e2e spec exercising the embedded per-spot manager on the edit page itself (today's e2e regression suite covers the standalone `/spots` route, which stays byte-identical) → QA follow-up if desired, not required for this restructure since the underlying component/testids are unchanged and already covered there.

## Self-verify
- AC-1, AC-4, AC-6 → source-inspection (`__tests__/cam-363-unified-capacity-section.test.ts`) + owner-verify on the real Staging URL (visually one section, deep-link lands correctly).
- AC-2, AC-3 → source-inspection (unified section structure, embed gating) + the existing `ac1-edit-round-trip` / `ac6-spot-lifecycle` Playwright regression specs stay green (both exercise the campsite edit form's `<form>` submit and the spots CRUD respectively, unaffected by the restructure).
- AC-5 → source-inspection (condition + Thai copy verbatim) + unit-level i18n assertion.
- Story-specific: no duplicate capacity UI (exactly one `id="zones"`, one `ความจุและประเภทพื้น` heading) · every `<Button>` in `spot-management-section.tsx` carries explicit `type="button"` (form-submit-bleed guard) · `#zones` anchor still resolves · Thai copy verbatim, no em-dash separator · design gate (`check:ds`/`check:palette`) green.
- Gate = /quality-gate · Done = every AC verified on the real Staging URL.

## Changelog
- v1 (2026-07-05) — created. Unifies the CAM-351 Capacity card and the CAM-361 embedded spot section into one mode-driven section (mode chooser first, content switches below); removes the old standalone Capacity card entirely; adds a persistent hint for whole-camp mode with lingering live spots.

<!--
ticket: CAM-361
epic: Availability Correctness — ว่างจริง (BlockedDate + partial capacity + hold)
feature: Data & Trust
status: Draft (proposed for G1, folded into the G3 packet per Gate policy v2)
version: v1
spec-class: SPEC-LITE (S) — single file-surface (one shared component + its two call
  sites), no schema/migration, no new API contract (reuses the existing spots CRUD
  API verbatim). Qualifies per .claude/rules/ops.md Gate policy v2 §G1.
persona: Host
-->

## Story
As a **Host**, I want the individual spots of my camp to be visible and manageable directly on the camp's edit page — grouped by zone, with a quick filter — so that I no longer have to leave the edit flow and hunt for a separate link just to see what spots exist.
Why: CAM-352 built the spot CRUD screen at `/dashboard/campsites/[id]/spots`, but spots are invisible on the edit page itself today — they live only behind a "manage spots" link on the Capacity card. A host editing a camp cannot see their spots without navigating away.
Scope: extract the existing spot list + create/edit/soft-delete management (CAM-352) into one shared component so it renders BOTH on the standalone `/spots` route AND embedded full-width below the main form on the campsite edit page (edit mode only — a create-mode camp has no id yet). Inside the section, spots are grouped by their existing free-text `zone` field (no-zone spots grouped last) with a single-select filter chip row above the list. No API/schema change — reuses the CAM-352 spots CRUD endpoints as-is.
Depends on: CAM-352 (host spot-management screen, MERGED).

## AC
<!-- Then = user-visible (verbatim Thai) · System effect = data outcome, plain language · Neg/edge = failure twin. -->
| # | Given | When | Then (user sees, Thai verbatim) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | A host is editing an existing camp that has spots in 2 zones | Host scrolls below the main edit form | Sees a "Manage spots" (`จัดการจุดกางเต็นท์`) section listing the camp's spots grouped under each zone's name, with spots that have no zone grouped last under `ไม่ระบุโซน` | Section renders from the same GET `/api/campsites/{id}/spots` data as the standalone screen; no new fetch/endpoint | EC-1 |
| AC-2 | The embedded section is showing 2 named zones + 1 unassigned bucket | Host taps a zone's filter chip | Sees only that zone's spots; the `ทั้งหมด` chip is no longer the selected one | Client-side filter only; no refetch, no data change | EC-2 |
| AC-3 | Host taps the `ทั้งหมด` chip after filtering to one zone | Host taps `ทั้งหมด` | Sees every zone group again, in the same grouped order | Filter resets to show all groups | — (reset path, not a failure) |
| AC-4 | A host owns a camp with zero spots | Host opens that camp's edit page and scrolls to the section | Sees the existing empty state `ยังไม่มีจุดกางเต็นท์ เพิ่มจุดแรกเพื่อเริ่มกำหนดความจุแบบรายจุด` with the `เพิ่มจุด` button available in the section | No list rows; no filter chips (nothing to filter) | — (empty state) |
| AC-5 | A host is creating a brand-new camp (no id assigned yet) | Host is on the create-camp form | Sees NO spot-management section at all (not even an empty state) | Section is not rendered/mounted; the Capacity card's existing "manage spots" shortcut still works once the camp is saved | — (nothing renders) |
| AC-6 | The standalone `/dashboard/campsites/{id}/spots` route (CAM-352) | Host opens that route directly | Sees the identical list/create/edit/soft-delete behavior as before (now also grouped by zone with the same filter chips) | Same component, same API calls — the dedicated route keeps working unchanged for existing bookmarks/links | EC-3 |

## Rules
- BR-1 **One shared component, two call sites.** `components/spot-management-section.tsx` owns 100% of the list/create/edit/soft-delete/loading/error/empty logic (extracted from CAM-352's page). The standalone route (`app/dashboard/campsites/[id]/spots/page.tsx`) becomes a thin shell that renders it with `variant="page"`; the campsite edit form (`components/CampgroundForm.tsx`) renders it with `variant="embedded"`. No logic is duplicated between the two. (proves AC-1, AC-6)
- BR-2 **Zone grouping — stable order, no-zone last.** Spots group by their existing free-text `zone` field (`lib/spot-zone-grouping.ts`). Named zones appear in first-appearance order (not alphabetical); spots with a null/empty/whitespace-only zone always group into one bucket sorted LAST, labeled `ไม่ระบุโซน`. A zone with zero live spots never appears as an empty group. (proves AC-1)
- BR-3 **Filter chips — single-select, reused primitive.** One `ทั้งหมด` chip (default-selected, shows every group) plus one chip per distinct zone group that exists, reusing `<FilterChip variant="pill">` exactly per its existing usage in `components/FilterModal.tsx` — no new primitive, no new token. Exactly one chip is selected at a time (radio-like, not a multi-select toggle). If the selected zone's group disappears after a reload (e.g. its last spot was edited/removed), the filter resets to `ทั้งหมด` rather than silently showing nothing. (proves AC-2, AC-3, EC-2)
- BR-4 **Embed gate — edit mode + real camp id only.** The embedded section only mounts when `isEditing` is true AND `initialData.id` is a real, saved camp id. A create-mode camp (no id yet) renders nothing for this section; the Capacity card's existing link to `/dashboard/campsites/{id}/spots` remains the shortcut once the camp is saved. (proves AC-5)
- BR-5 **Placement — outside the campsite `<form>`, full-width, below it.** The section is a sibling AFTER the campsite edit form's closing `</form>` tag, not nested inside it — `SpotFormDialog` (the add/edit spot dialog) renders its own `<form>`, and nesting a `<form>` inside another `<form>` is invalid HTML and would let Enter-to-submit fire the wrong form. (proves AC-1)
- BR-6 **No API/schema change.** Reuses the CAM-352 spots CRUD endpoints (`GET/POST /api/campsites/[id]/spots`, `GET/PUT/DELETE /api/campsites/[id]/spots/[spotId]`) verbatim — authz (`canManage`), validation (`spotSchema`), and soft-delete behavior are unchanged. (proves AC-1, AC-6)

## Edge cases
<!-- cover: invalid · empty/zero · concurrent/duplicate · permission · boundary. -->
- EC-1 IF a spot's `zone` is null, empty, or whitespace-only THEN it groups into the `ไม่ระบุโซน` bucket, which always sorts after every named zone (BR-2)
- EC-2 IF the host has a specific zone chip selected and every spot in that zone is later removed/reassigned THEN the filter silently falls back to `ทั้งหมด` instead of showing an empty filtered view with no explanation (BR-3)
- EC-3 IF a user without `CAMPSITE_UPDATE`/`CAMPSITE_DELETE` on the camp opens either surface (the standalone route or the embedded section) THEN both render read-only (no add/edit/delete controls), identical to the pre-existing CAM-352 behavior (BR-1, BR-6)

## Data
- No schema change, no new endpoint. Reuses `Spot.zone` (existing free-text field) purely as a client-side grouping key.

## Seams & refs
- Reuse: `app/dashboard/campsites/[id]/spots/page.tsx` (CAM-352 screen, becomes a thin shell) · `components/spot-form-dialog.tsx` (unchanged) · `components/ui/filter-chip.tsx` (`variant="pill"`, per `components/FilterModal.tsx`'s usage) · `components/ui/card.tsx` (`Card`/`CardHeader`/`CardTitle`/`CardAction`/`CardContent` for the embedded variant) · `lib/hooks/use-minimum-loading.ts` (unchanged anti-flicker hook) · the spots CRUD API (unchanged).
- Refs: CAM-352 (host spot-management screen — the logic this story extracts and embeds) · CAM-351 (capacity-mode chooser — the Capacity card's existing "manage spots" link stays as a shortcut, unchanged).

## Out of scope
- Any change to the spots CRUD API contract, authz, or soft-delete behavior → already covered by CAM-352, unchanged here.
- Drag-and-drop reordering of zones/spots, bulk zone rename/merge → not asked for; a real need would be its own follow-up ticket.
- A "no spots match this filter" empty variant → not reachable today (a zone chip only exists when it has ≥1 spot), so no such state is built.

## Self-verify
- AC-1, AC-6 → integration (source-inspection guard: both call sites import the same shared component) + owner-verify on the real Staging URL (section visible + grouped correctly on the edit page; the standalone route unchanged).
- AC-2, AC-3, BR-3, EC-2 → unit (pure grouping helper, real behavioral tests) + source-inspection (single-select state shape, reset-on-disappear guard).
- AC-4 → all 8 states already covered by the extracted CAM-352 component (loading/error/empty/success unchanged); empty-state assertion retargeted to the new shared component file.
- AC-5, BR-4 → source-inspection: the embed is gated on `isEditing && initialData?.id` in `components/CampgroundForm.tsx`.
- BR-5 → source-inspection: the embed JSX appears strictly after the campsite `<form>`'s closing tag in `components/CampgroundForm.tsx`.
- Story-specific: zero duplicated list/dialog logic between the two call sites · Thai copy (`ทั้งหมด`/`ไม่ระบุโซน`) verbatim in `locales/` (TH/EN), no em-dash separator · design gate (token-only, `check:ds`/`check:palette`) green.
- Gate = /quality-gate · Done = every AC verified on the real Staging URL.

## Changelog
- v1 (2026-07-05) — created. Extracts CAM-352's spot list/management into a shared component embedded on the campsite edit page (full-width, below the main form) with zone grouping + a single-select filter chip row; the standalone `/spots` route becomes a thin shell over the same component. No API/schema change.

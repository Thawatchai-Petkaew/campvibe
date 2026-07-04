---
linear: CAM-356
feature: m1-data-trust
epic: m1-listing-truth-ราคา-ค่าธรรมเนียม-นโยบายยกเลิก-qu (CAM-288)
persona: host
artifact: story
owner: product-owner
status: In Progress
version: v1
updated: 2026-07-04
class: spec-lite
---
# แก้ไขข้อความ validation error ไม่บอกรายละเอียด + สีซ้อนบนหัวข้อฟอร์ม (CAM-356)

## Story
As a **Host**, I want the edit-campsite form to name exactly which field failed when I save fails,
and I want each section header to render as one clean surface, so that I can fix the real problem
myself instead of staring at a bare `Validation Error` banner, and so the form does not look visually
broken.
Why: two owner-reported defects on `/dashboard/campsites/[id]/edit` — (1) a legacy camp
(ภูลมโลทุ่งหมอก, `02628ed3-8ee1-4c14-a711-b0939f0e98ea`) fails to save with only a bare
`Validation Error` banner even though the zod field details are already in the 400 response body;
(2) every section header shows a visibly double-tinted band.
Scope: `components/CampgroundForm.tsx` only (+ `locales/translations.json` for the new banner copy).
No API/schema/migration change. Reuses the EXISTING `campSiteSchema` (shared client+server), the
EXISTING `InputField`/`ErrorBanner`/`Card` primitives, and the EXISTING zod details the PUT/POST
routes already return on a 400 (`lib/api-utils.ts` `apiError`) — this story wires the client to
actually read them.
Depends on: none (both defects are entirely client-side; the shared `campSiteSchema` and the 400
response shape are unchanged).

## AC
| # | Given | When | Then (user sees, Thai verbatim) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | The host edits a campsite and the save fails zod validation on one or more fields (server 400, or the client pre-check catches it first) | The host taps `อัปเดต` | Each failing input shows its own inline error text below it, AND the banner at the top of the form names the failing fields by their real label (e.g. `กรอกข้อมูลไม่ถูกต้อง: เบอร์โทรศัพท์, พิกัด`), AND the page scrolls/moves focus to the section holding the first failing field | No write; `fieldErrors` state populated from the 400 body's `details` (or the client pre-check); no new endpoint | EC-1 |
| AC-2 | A campsite has a `groundType` breakdown set (e.g. the repro camp's `{"WOOD":6}`, set before this form ever validated it, on a field the host never touched) | The host saves the form without touching Ground Type | The save succeeds (no banner, redirects to the list as normal) | `groundType` is sent to the API as the object `campSiteSchema` expects (`z.record(string, number)`), not a JSON-stringified string; the PUT/POST routes stringify it for storage exactly as before — no DB/API contract change | EC-2 |
| AC-3 | The host opens the edit form (any campsite) | The form renders | Every section header (`ข้อมูลพื้นฐาน`, `การติดต่อ`, `ราคา`, …) renders as one flat surface with a single divider line under the title — no double-tinted band | No write; `CardHeader` no longer stacks `bg-muted/40` inside the `Card`'s own padding | — (visual-only; no failure twin) |

## Rules
- BR-1 The field→label map (`FIELD_LABEL_RESOLVERS`) pulls every label from the SAME locale key already rendered next to that field's input (`t.newCampground.*` / `t.campground.*` / `t.filter.*`) — never a new hardcoded string, never the raw schema key in the normal path. (proves AC-1)
- BR-2 The client pre-check runs `campSiteSchema.partial().safeParse(campPayload)` — the identical shared schema the server enforces — imported, never re-declared; the server re-validates regardless (server stays authoritative, `.claude/rules/ux.md` rule 1). (proves AC-1)
- BR-3 `groundType` is included in the payload as the plain object `formData.groundType` when non-empty, `undefined` when empty — never `JSON.stringify(...)` before the network call. (proves AC-2)
- BR-4 Section `CardHeader` keeps `border-b border-border pb-4` (the divider) and drops `bg-muted/40` (the second tint); no new token is introduced, no `bg-*` added elsewhere on the header. (proves AC-3)

## Edge cases
- EC-1 IF the 400 body's `details` is empty/absent (a non-validation 400, or a network/parse failure) THEN the banner falls back to `err.error` if present, else the generic copy `ข้อมูลที่กรอกไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง` — never a raw `[object Object]` or a crash (BR-1)
- EC-2 IF the 400 `details` names a field with no entry in the label map (future schema drift) THEN that field is listed once by its raw path in the banner instead of being silently dropped or throwing (BR-1)

## Data
- No schema/migration change. Reads the existing `err.details` (`validation.error.format()`) already returned by `PUT`/`POST /api/campsites` on a 400 (`lib/api-utils.ts` `apiError`, unchanged). `groundType` continues to store as the same JSON string in `CampSite.groundType` (Prisma column type unchanged) — only the wire shape between the client and the existing zod boundary changes (object, not a pre-stringified string). · migration: none

## Seams & refs
- Reuse: `lib/validations/campsite.ts` (`campSiteSchema`, shared client+server, imported not re-declared) · `lib/api-utils.ts` (`apiError` — already serializes zod `details` on 4xx, unchanged) · `components/ui/input-field.tsx` (`error=` slot) · `components/ui/error-banner.tsx` · `components/ui/card.tsx` (`Card`/`CardHeader` — no new component). Refs: `.claude/rules/ux.md` §1 (one schema, server authoritative) · `.claude/rules/code.md` (i18n, reuse-first).

## Out of scope
- Adding a `phone` format regex (or any new validation rule) to `campSiteSchema` → a separate ticket if the owner wants stricter phone validation; this story only surfaces whatever the CURRENT schema already rejects.
- Per-`<input>` DOM ids / focus (vs the section-level scroll+focus this story ships) → a larger a11y pass if ever needed; out of this atomic story's surface (`components/CampgroundForm.tsx` only).
- Any other legacy-data cleanup beyond the `groundType` wire-shape fix (e.g. backfilling stored values) → not needed, no stored data changes.

## Self-verify
- AC-1 → unit (`flattenZodFieldErrors` / `getFieldLabel` / `buildValidationBannerMessage` exported + tested: simple + nested zod paths, unmapped-field fallback, empty-details fallback) + source-inspection (client pre-check wired before `fetch`, server `err.details` wired, `zErr(field)` merged into each `InputField`'s `error=`, `scrollToFirstErrorField` called on both paths) + owner-verify on the real Staging URL (save the named repro camp, confirm the banner/inline text/scroll for a deliberately-broken field)
- AC-2 → unit (Prove-It: `campSiteSchema.partial().safeParse({ groundType: JSON.stringify({WOOD:6}) })` fails — documents the bug that shipped; `safeParse({ groundType: {WOOD:6} })` passes — the fix) + source-inspection (the stringify call is gone) + owner-verify (the named repro camp saves successfully on Staging)
- AC-3 → source-inspection (no `CardHeader` contains `bg-muted/40` anymore; the divider `border-b border-border pb-4` remains on all 14 sections) + owner-verify (screenshot vs the Design Brief / dashboard Card convention — no double-tint)
- Story-specific: no new component (reuse-only) · no schema/API/migration change · `check:ds` + `check:palette` stay green (token-only, no new hex/px) · every new user-facing string lives in `locales/translations.json` (TH+EN), no em-dash
- Gate = /quality-gate (`npm run lint` · `npm run typecheck` · `npm test` · `npm run build` — build verified by CI per the worktree caveat · `check:ds` + `check:palette` green). **G1/G2 fold into this spec-lite packet** (single file-surface, no schema/API/new-endpoint, expected diff within the atomic-story range) — this `story.md` ships in the same PR as the code. Done = merge to `staging` + AC verified on the real Staging URL (the named repro camp saves cleanly; the header tint is gone).

## Changelog
- v1 (2026-07-04) — created. Two owner-reported defects on the campsite edit form, fixed together as one atomic story (both client-only, same file surface): (1) actionable validation errors (inline + banner + scroll, generic for any field) instead of a bare `Validation Error`, root-caused to the client discarding the server's zod `details` AND, for the specific repro camp, an additional real bug — `groundType` was sent JSON-stringified against a schema that expects the object; (2) removed the `bg-muted/40` tint stacked inside the `Card`'s own padding on every section `CardHeader`, which produced the reported double-tinted band.

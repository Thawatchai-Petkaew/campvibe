---
linear: CAM-360
feature: m1-data-trust
epic: m1-listing-truth-ราคา-ค่าธรรมเนียม-นโยบายยกเลิก-qu (CAM-288)
persona: host
artifact: story
owner: product-owner
status: In Progress
version: v1
updated: 2026-07-05
class: spec-lite
---
# แก้ไขบั๊กลบโลโก้แคมป์แล้วบันทึกไม่ติด (CAM-360)

## Story
As a **Host**, I want clearing my campsite logo and saving to actually remove it, so that a camp I
no longer want branded with an old logo does not silently keep showing it after I save.
Why: found by CAM-359's E2E AC-3 with an exact trace — `components/CampgroundForm.tsx` sent
`logo: formData.logo || undefined` (a cleared `""` collapses to `undefined`, dropped by
`JSON.stringify`, so the key is absent from the request body) and
`app/api/campsites/[id]/route.ts` PUT only writes `logo` `...(data.logo !== undefined && {...})`
(an absent key means "skip"), so the column is never touched and the old logo reappears on reload.
This is the same explicit-null clearing defect class CAM-341 fixed for `extraFeeLabel`/
`cancellationPolicy`.
Scope: `components/CampgroundForm.tsx` (the `logo` line in `campPayload` only) +
`lib/validations/campsite.ts` (`logo` accepts an explicit `null`) +
`app/api/campsites/[id]/route.ts` PUT (`logo` mapping) + `app/api/campsites/route.ts` POST (`logo`
mapping, for shape consistency on create). No other field, no new endpoint, no schema/migration.
Depends on: none (mirrors the already-shipped CAM-341 pattern; no new seam).

## AC
| # | Given | When | Then (user sees, Thai verbatim) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | A campsite has a logo already set | The host presses remove on the logo and saves the form | The save succeeds; the logo no longer appears on the campsite (detail page and edit form both show no logo) | The PUT payload carries `logo: null`; the column is written to `NULL`, not left unchanged | EC-1 |
| AC-2 | A campsite has a logo already set | The host edits an unrelated field (e.g. price) and saves without touching the logo | The save succeeds; the existing logo still displays unchanged | The PUT omits the `logo` key entirely; the column is untouched (REGRESSION-CRITICAL — a partial save must never clear a field it did not send) | AC-1 (the clearing twin) |
| AC-3 | The host is creating or editing a campsite | The host uploads a valid logo image and saves | The save succeeds; the new logo displays | `logo` is validated as a safe absolute/root-relative URL and persists as-is (unchanged from before this fix) | — (existing CAM-358 contract, regression guard only) |

## Rules
- BR-1 `campPayload.logo` in `CampgroundForm.tsx` sends an explicit `null` when the field is blank AND the campsite already exists (`isEditing`); on create, a still-blank logo sends `undefined` (nothing to clear yet, no needless `NULL` write on a brand-new row). A non-blank value always passes through unchanged. (proves AC-1, AC-2)
- BR-2 `lib/validations/campsite.ts` `logo` accepts `undefined` (key omitted) · `null` (explicit clear) · `''` (no logo set) · a valid absolute/root-relative URL (CAM-358's `imageUrlValue`) — and continues to reject an unsafe URL shape (protocol-relative, control character, disallowed scheme) exactly as before. (proves AC-1, AC-3)
- BR-3 `app/api/campsites/[id]/route.ts` PUT keeps the `data.logo !== undefined` guard (an omitted key skips the field, never touching the column) but maps a received `''` or `null` to an explicit `null` write instead of collapsing both into `undefined`. `app/api/campsites/route.ts` POST maps the same three shapes (`''`/`null` → `null`, a value passes through) for create-path consistency. (proves AC-1, AC-2)

## Edge cases
- EC-1 IF a PUT request omits the `logo` key entirely (e.g. a partial price-only save) THEN the campsite's existing logo column is left completely untouched — this is the regression CAM-341's clearing fix already guards for the other three fields, extended here to `logo`.

## Data
No schema/migration change. `CampSite.logo` (`prisma/schema.prisma`) is already a nullable `String?`; this story only changes how the existing three write shapes (`undefined`/`null`/`''`/a value) map through the client payload, the zod boundary, and the two write routes. · migration: none

## Seams & refs
- Reuse: the CAM-341 explicit-null clearing pattern (`app/api/campsites/[id]/route.ts` `extraFeeLabel`/`cancellationPolicy` mapping, `__tests__/cam-341-fee-policy-form.test.ts` conventions) applied to `logo` · CAM-358's `imageUrlValue` (`lib/validations/image.ts`) stays the value rule, untouched. Refs: `.claude/rules/api.md` rule 12 (backward-compatible by widening `.nullable()`, not narrowing) · `.claude/rules/architecture.md` (undefined=skip / null=clear / value=set is the same atomic-write convention used across the CAM-268/341 fields).

## Out of scope
- Any other field's clearing behavior (already covered by CAM-341) → not touched here.
- `e2e/` changes → CAM-359's E2E AC-3 spec (PR #370) proves this fix end-to-end once both merge; this story does not add or modify e2e specs.
- Widening/narrowing the logo URL value rule itself (CAM-358 scope) → unchanged.

## Self-verify
- AC-1/AC-2 → integration (mocked-Prisma PUT route: `logo: null` clears the column · `logo: ''` clears the column · an omitted `logo` key never touches the column, alongside an unrelated field write) + unit (`campSiteSchema` accepts `null`/`''`/absent/a valid URL, still rejects an unsafe shape) + owner-verify on the real Staging URL (clear a logo, save, reload, confirm it is gone; save an unrelated field, confirm the logo survives)
- AC-3 → unit (`campSiteSchema.logo` still accepts a valid absolute/root-relative URL; still rejects `//evil.com`-style shapes per CAM-358) — regression guard only, no behavior change
- Story-specific: no new component, no new endpoint · `check:ds` + `check:palette` stay green (no UI/token change, mapping-only fix) · POST create path updated for shape consistency, verified with the same normal/null/empty cases
- Gate = /quality-gate (`npm run lint` · `npm run typecheck` · `npm test` · `npm run build` — build verified by CI in this isolated worktree, not run locally · `check:ds` + `check:palette` green). **G1/G2 fold into this spec-lite packet** (single-class fix, no schema/API-contract/new-endpoint, diff within the atomic-story range) — this `story.md` ships in the same PR as the code. Done = merge to `staging` + AC verified on the real Staging URL (clear a logo → save → reload → gone; unrelated-field save → logo survives).

## Changelog
- v1 (2026-07-05) — created. Fixes the logo-clear no-op defect found by CAM-359's E2E AC-3, mirroring the CAM-341 explicit-null clearing pattern for the `logo` field across the client payload, the zod boundary, and both the PUT and POST write paths.

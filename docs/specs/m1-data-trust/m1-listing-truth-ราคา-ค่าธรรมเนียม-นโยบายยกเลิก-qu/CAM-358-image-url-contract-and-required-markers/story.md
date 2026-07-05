---
linear: CAM-358
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
# แก้ไขสัญญา URL รูปภาพ + เครื่องหมายช่องที่ต้องกรอก (CAM-358)

## Story
As a **Host**, I want re-uploading a logo/photo to save successfully on every environment, and
I want to see clearly which fields are required before I submit the campsite form, so that I do not
lose my edits to a confusing validation error and I know exactly what to fill in before saving.
Why: `POST /api/upload` (`app/api/upload/route.ts`) returns a ROOT-RELATIVE `/uploads/<file>` path
in local dev (no `BLOB_READ_WRITE_TOKEN`) and an ABSOLUTE blob `https://` URL once the token is
configured — but `lib/validations/campsite.ts` `logo` and `lib/validations/image.ts`
`imageInputSchema` (both union branches) validated with a bare `z.string().url()`, which only ever
accepts the absolute shape. A re-upload on the dev fallback path, and any legacy relative row already
in the DB (e.g. `/placeholder-camp.svg`), 400 on save with zod's generic union message and can never
be saved again. Separately, `components/ui/input-field.tsx` renders no visual marker for the
`required` HTML attribute (the form uses `noValidate`, so it silently does nothing), leaving the host
guessing which fields are mandatory.
Scope: `lib/validations/image.ts` + `lib/validations/campsite.ts` (the value rule only) +
`components/ui/input-field.tsx` (additive marker prop) + `components/CampgroundForm.tsx` +
`components/spot-form-dialog.tsx` (apply the marker to genuinely schema-required fields only). No
API/endpoint change (`app/api/upload/route.ts` is untouched) and no new component.
Depends on: none (both fixes are entirely in the existing zod boundary + existing `InputField`
primitive; the upload route's response shape is unchanged and was already correct — the schema was
too narrow for it).

## AC
| # | Given | When | Then (user sees, Thai verbatim) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | The host uploads a new logo/photo on an environment with no `BLOB_READ_WRITE_TOKEN` (dev fallback returns `/uploads/<file>`) | The host saves the campsite form | The save succeeds (no validation banner); the logo/photo displays immediately | `campSiteSchema`/`imageInputSchema` accept the root-relative URL; the value persists unchanged | EC-1 |
| AC-2 | A campsite already has a legacy relative image row in the DB (e.g. `logo: "/placeholder-camp.svg"`) | The host opens and re-saves the edit form without touching the photo | The save succeeds; the legacy value round-trips unchanged | The existing relative value passes validation and persists as-is; no forced re-upload | EC-1 |
| AC-3 | A malicious or malformed value reaches the image/logo field (e.g. `//evil.com`, protocol-relative) | The host attempts to save | The field shows `ลิงก์รูปไม่ถูกต้อง` and the save is blocked | Zod rejects the value before it reaches the API/DB; no write | — (this row IS the failure case; EC-1 covers the sibling malformed shapes) |
| AC-4 | The host opens the create/edit campsite form or the add/edit spot dialog | The host looks at the form | Every field the schema actually requires (name (TH), latitude, longitude, check-in time, check-out time on the campsite form; name, price/night on the spot dialog) shows a `*` next to its label; no other field shows one | Purely presentational — `InputField` renders an `aria-hidden` `*` when `required` is set; no data/validation change | — (visual-only; the schema itself already enforces these fields, see BR-3) |

## Rules
- BR-1 The shared value rule (`imageUrlValue` in `lib/validations/image.ts`) accepts an absolute `http://`/`https://` URL OR a root-relative path with exactly ONE leading `/`; it rejects `//` (protocol-relative), `/\` (backslash right after the leading slash), any character with charCode < `0x20` anywhere in the value (not just the prefix — the CAM-215 open-redirect lesson applies to path hygiene generally), and the empty string. (proves AC-1, AC-2, AC-3)
- BR-2 `imageUrlValue` is applied to BOTH branches of `imageInputSchema` (the bare-string branch and the `{url, kind}` object branch's `url` field) and to `campSiteSchema.logo` (keeping the existing `.optional().or(z.literal(''))` — a blank/absent logo stays valid). (proves AC-1, AC-2)
- BR-3 The `*` marker on `InputField` is additive (an existing `required` prop now also renders a marker) and is applied ONLY where the shared zod schema (`campSiteSchema` / `spotSchema`) actually requires the field — a field the schema does not require never carries the prop. (proves AC-4)

## Edge cases
- EC-1 IF the image/logo value is a protocol-relative path (`//host/x.jpg`), a backslash-prefixed path (`/\host/x.jpg`), or contains a control character anywhere (e.g. a tab before `//evil.com`) THEN the value rule rejects it with `ลิงก์รูปไม่ถูกต้อง` and the save is blocked, matching AC-3's outcome for every one of these shapes (not just the exact `//evil.com` example)

## Data
No schema/migration change. `lib/validations/image.ts` widens the VALUE RULE only (the Prisma `Image.url` / `CampSite.logo` columns are unchanged `String` types that already store either shape). `app/api/upload/route.ts` is untouched — its response contract (relative in dev, absolute with a blob token) was already correct; the validation boundary was too narrow for it. · migration: none

## Seams & refs
- Reuse: `lib/validations/image.ts` (`imageInputSchema`, widened not replaced) · `lib/validations/campsite.ts` (`campSiteSchema.logo`, same optional/literal semantics) · `components/ui/input-field.tsx` (`required` prop already existed on the DOM type; this adds the visual marker only) · `components/CampgroundForm.tsx` / `components/spot-form-dialog.tsx` (existing `InputField` usages, no new component). Refs: `.claude/rules/security.md` CAM-215 lesson (control-char + protocol-relative bypass hygiene) · `.claude/rules/api.md` rule 12 (backward-compatible by widening, not narrowing) · `.claude/rules/ux.md` §1 (one shared zod schema, client + server).

## Out of scope
- Changing `app/api/upload/route.ts` or its response shape → not needed; the route was already correct, only the validation boundary was too narrow.
- A marker/required-audit on fields outside `campSiteSchema`/`spotSchema`'s InputField-bound controls (e.g. `bookingMethod` has no rendered form control at all today; `locationId`/province resolve through `LocationPicker`, a combobox, not an `InputField`; `campSiteType` carries a zod `.default([])` so it is not actually schema-required) → noted as a gap for a future ticket if the owner wants a control added, not silently marked here.
- Any other legacy-data backfill beyond validating the existing shapes correctly → not needed, no stored values change.

## Self-verify
- AC-1/AC-2 → unit (`isSafeImageUrl`/`imageUrlValue` normal + null/empty + boundary + error cases; `imageInputSchema` both branches with a relative path; `campSiteSchema.logo` with a dev-fallback relative URL, a legacy relative row, an absolute URL, and empty) + owner-verify on the real Staging URL (re-upload a logo, confirm save; open a camp with a legacy relative image and re-save without touching the photo)
- AC-3 → unit (`//evil.com`, `/\evil`, a control-char value, all rejected with the exact Thai string `ลิงก์รูปไม่ถูกต้อง`) + owner-verify (attempt the same value in the UI, confirm the save is blocked)
- AC-4 → source-inspection (`InputField` destructures `required` and renders the `aria-hidden` `*` + still forwards `required` to the native input; `CampgroundForm`/`SpotFormDialog` carry the marker only on the schema-required list, confirmed against `campSiteSchema`/`spotSchema`'s own `.isOptional()`) + owner-verify (visual check on Staging)
- Story-specific: no new component (reuse-only) · no API/endpoint/schema change · `check:ds` + `check:palette` stay green (token-only, no new hex/px) · the Thai error string lives inline in the zod schema following the existing convention in these files (no locales entry needed for a zod message; existing zod messages in `lib/validations/*.ts` are already plain inline strings, mixed EN/TH, not routed through `locales/`)
- Gate = /quality-gate (`npm run lint` · `npm run typecheck` · `npm test` · `npm run build` — build verified locally in this worktree · `check:ds` + `check:palette` green). **G1/G2 fold into this spec-lite packet** (single file-surface within the stated build surface, no schema/API/new-endpoint, diff within the atomic-story range) — this `story.md` ships in the same PR as the code. Done = merge to `staging` + AC verified on the real Staging URL (a real re-upload saves; a deliberately malformed `//evil.com` value is blocked with the Thai copy; the `*` markers appear only on the stated fields).

## Changelog
- v1 (2026-07-05) — created. Two owner-traced defects fixed together as one atomic story (same root cause class — an over-narrow validation boundary vs. the real contract it guards): (1) widened the image/logo URL value rule to accept root-relative paths (matching what `/api/upload` actually returns in dev and what legacy rows already store) while explicitly rejecting the CAM-215-style bypass shapes; (2) added a purely-presentational `*` marker to `InputField`, applied only to fields the shared schema genuinely requires.

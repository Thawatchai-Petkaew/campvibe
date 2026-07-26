---
linear: CAM-535
feature: platform-hardening
epic: taxonomy-ui-foundation
persona: platform
artifact: story
owner: qa-engineer
status: in-progress
version: v1
updated: 2026-07-26
---
# Restore the privilege-escalation test the legacy-route deletion dropped (CAM-535)

<!-- QA audit story. No production code touched — test-only surface. -->

## Story
As the **platform** (maintainer-facing, no end-user-visible change), I want a QA audit of the 9 test cases CAM-527 deleted alongside the orphaned `app/api/campgrounds/*` route, so that any genuine live-behavior coverage loss is restored and any correctly-dropped duplicate is confirmed rather than assumed.
Why: a post-merge audit of CAM-527 (commit `c8f6c94`) flagged that 3 test files lost `describe` blocks with zero added blocks in the same diff (net -38 cases), naming the `isVerified` self-grant guard on `POST /api/campsites` as a suspected uncovered live route.
Scope: audit all 9 named deleted cases (2 in `security-hotfix.test.ts`, 5 in `cam-209-rate1-abuse-hardening.test.ts`, 2 in `cam-211-upload-hardening.test.ts`) against the live route source; restore only a case that (a) still describes real live behavior and (b) has no equivalent live-route test today. Does not touch `app/`, `lib/`, `components/`, `prisma/` (test-only; a wrong guard would be reported, not edited).
Depends on: CAM-527 (`docs/specs/platform-hardening/taxonomy-ui-foundation/CAM-527-dead-code-removal/story.md`, merged `c8f6c94`) · CAM-534 (tracks the genuine IP-rate-limit gap this audit reconfirms, out of scope here)

## Finding (blocks Work Item 1 as originally scoped — reported per STOP RULE 1)

The dispatch's premise — "the live guard ... now has **no** route-level test" — is **contradicted by repo reality**. `__tests__/security-hotfix.test.ts` already carries a full route-level suite at `describe('isVerified self-grant prevention — POST /api/campsites')` (lines 630-745, pre-existing since the original security-hotfix commit `cec7d9d`, **untouched** by CAM-527 — `git show c8f6c94 -- __tests__/security-hotfix.test.ts` shows the deleted lines start strictly *after* that describe block's closing brace). It already asserts, against the live `campsitePOST` handler:

- CAMPER sending `isVerified:true` → `campSite.create` receives `isVerified:false`
- ADMIN sending `isVerified:true` → `campSite.create` receives `isVerified:true`
- OPERATOR sending `isVerified:true` → `false`
- ADMIN sending `isVerified:false` → `false`
- unauthenticated → `401`, no `create` call

CAM-527's own story.md (AC-2/BR-2) states this explicitly: "isVerified self-grant prevention ... now asserted only against the LIVE `/api/campsites` route" — the legacy-route block deleted in CAM-527 was a **byte-for-byte duplicate**, correctly removed.

**Prove-It performed on the EXISTING test** (no new test needed — a duplicate would violate qa.md's "never mock/pad a test that asserts nothing new"):
1. Neutralized the guard in `app/api/campsites/route.ts:288` (`isVerified: data.isVerified ?? false` — dropped the `role === 'ADMIN'` check) in a local, uncommitted edit.
2. Ran `npx vitest run __tests__/security-hotfix.test.ts` → **RED**: `CAMPER sending isVerified:true...` and `OPERATOR sending isVerified:true...` both failed (`expected true to be false`).
3. Restored the guard (`git checkout -- app/api/campsites/route.ts` equivalent) → **GREEN**: 45/45 pass.

No test file change was made for Work Item 1 — the existing block already has teeth and is not a gap.

## AC
| # | Given | When | Then (dev-facing, plain language) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | The 9 cases CAM-527 deleted across 3 test files | Each case is checked against the live route source + the current suite | Every case is classified: still-live-uncovered (restore) / still-live-covered-elsewhere (no action) / behavior no longer exists (no action, tracked elsewhere) | Verdict table recorded in this file + PR body; zero cases silently dropped | EC-1 |
| AC-2 | The `isVerified` self-grant guard at `app/api/campsites/route.ts:288` | The guard is temporarily neutralized in a local edit | The existing route-level test in `security-hotfix.test.ts` goes RED | No production file changed in the final diff; the guard is restored before commit | EC-2 |
| AC-3 | The guard restored | `npx vitest run __tests__/security-hotfix.test.ts` | 45/45 pass (GREEN) | Confirms the pre-existing test has real teeth, not just a source-inspection pin | — (proven, no negative twin needed) |

## Rules
- BR-1 A deleted case is restored only if it protects behavior that (a) still exists on a live route/module AND (b) has no equivalent assertion in the current suite (proves AC-1).
- BR-2 A guard test claimed as "missing" is verified by Prove-It (neutralize → red → restore → green) before writing anything new; a passing pre-existing test is evidence the claim is false, not evidence to duplicate (proves AC-2/AC-3).

## Edge cases
- EC-1 IF a deleted case's behavior has no live equivalent AND is already tracked by a separate ticket (CAM-534, the IP-rate-limit-on-list-GET gap) THEN it is named in the verdict table with a pointer to that ticket, not re-opened here (BR-1).
- EC-2 IF neutralizing the guard does NOT turn the existing test red THEN that would be a real gap requiring a new test — did not occur here (both affected cases went red as expected) (BR-2).

## Data
- No schema/DB change. Test-only surface; `app/api/campsites/route.ts` was touched only in an uncommitted, reverted local edit for the Prove-It demonstration (not part of the committed diff).

## Seams & refs
- Reuse: the existing `describe('isVerified self-grant prevention — POST /api/campsites')` block in `__tests__/security-hotfix.test.ts` (lines 630-745) is the single owner of this guard's route-level coverage — no parallel test added. Refs: CAM-527 story.md (AC-2/BR-2/EC-2) · CAM-534 (IP-rate-limit gap, separate ticket).

## Out of scope
- Adding IP-based rate-limiting to `/api/campsites` GET — genuine pre-existing gap, already tracked as CAM-534, not this ticket.
- Any change to `app/api/campsites/route.ts` — the guard is correct as-is; this story only proved it, never edited it in the final diff.

## Self-verify
- AC-1 → verdict table below + in the PR body.
- AC-2/AC-3 → Prove-It sequence run locally (documented above; not committed as a fixture since it required a temporary revert-then-restore of production code, out of this story's file surface).
- Story-specific: `npm run lint && npm run typecheck` clean · full `npx vitest run` green apart from the 3 known env-dependent failures (`delivery-client`, `delivery-tickets-api`, `cam-215-sec-a-access-control` — missing `DELIVERY_DATABASE_URL`, pre-existing, not this story's).
- Gate = `/quality-gate` · Done = verdict accepted + no defect left open.

## Verdict table — all 9 deleted cases

| # | Case (deleted in CAM-527) | Still live? | Covered elsewhere? | Restored? | Why |
|---|---|---|---|---|---|
| 1 | `security-hotfix`: CAMPER `isVerified:true` → `false`, POST `/api/campgrounds` | No (route deleted) | **Yes** — `security-hotfix.test.ts:653-671`, same assertion against live `campsitePOST` | No | Byte-for-byte duplicate; restoring would pad the count with zero new protection |
| 2 | `security-hotfix`: ADMIN `isVerified:true` → `true`, POST `/api/campgrounds` | No | **Yes** — `security-hotfix.test.ts:673-691` | No | Same as above |
| 3 | `cam-209` RISK-4: GET `/api/campgrounds` response ≤50 items (normal) | No | **Yes** — `cam-196-keyset-cursor.test.ts:443-445`, `take: PAGE_SIZE + 1` (24+1) source-inspection proof on the live route | No | Live route bounds via `PAGE_SIZE+1`, already proven |
| 4 | `cam-209` RISK-4: Prisma called with `take:50` (boundary) | No | **Yes** — same `cam-196-keyset-cursor.test.ts:443-445` | No | Same live bound already proven |
| 5 | `cam-209` RISK-4: 100th IP request allowed (boundary) | **No — confirmed**: `grep checkRateLimit app/api/campsites/route.ts` shows it called only once, for POST create (line 163); GET has zero rate-limit calls | No live equivalent exists | No | Behavior does not exist on the live route; tracked as CAM-534, not re-opened here |
| 6 | `cam-209` RISK-4: 101st IP request → 429 (boundary) | No — same | No live equivalent | No | Same — CAM-534 |
| 7 | `cam-209` RISK-4: different IPs independent counters (concurrent) | No — same | No live equivalent | No | Same — CAM-534 |
| 8 | `cam-211`: campgrounds POST 429 + Retry-After (create rate-limit) | No (route deleted) | **Yes** — `cam-211-upload-hardening.test.ts:278-310`, `describe('POST /api/campsites — rate-limit (campsite:create:<userId>)')` covers 429+Retry-After, no-call-when-limited, allows-under-limit, per-user isolation | No | Same `campsite:create:<userId>` key, already proven on the live (only remaining) route |
| 9 | `cam-211`: shared key `campsite:create:<userId>` across campsites+campgrounds (cross-route) | No — only one create route remains | **Yes (moot)** — per-user isolation on that key proven at `cam-211-upload-hardening.test.ts:312+` (`USER_B is unaffected`) | No | A cross-route sharing proof is meaningless with only one route left; per-user isolation on the surviving route is what actually matters and is covered |

**Result: 0 of 9 cases required restoration.** All were either exact duplicates of live-route coverage (already proven, in some cases more thoroughly — the surviving `security-hotfix` block also proves OPERATOR→false and unauthenticated→401, cases the deleted legacy block never had), or describe behavior that genuinely does not exist on the live route today (the IP rate-limit gap, correctly tracked separately as CAM-534 per CAM-527's own `story.md` §Out of scope).

## Changelog
- v1 (2026-07-26) — created; audit complete, 0 restorations needed, contradiction with dispatch premise reported.

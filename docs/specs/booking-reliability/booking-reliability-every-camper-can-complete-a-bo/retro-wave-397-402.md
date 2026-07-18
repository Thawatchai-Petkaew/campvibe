# Retro — Booking-reliability wave: CAM-397 / 398 / 400 / 401 / 402 (batch)

- **Trigger:** owner request ("/retro หลังจากจบ CAM-401") + one regression round (CAM-400) + a security finding that became its own story (CAM-401).
- **Stories / outcome:** 5 stories Done + on-staging in one day under the full rotation: live-session gate (#451) · bookings list nav+frame (#452) · capacity-seam invariant (#455) · availability range caps (#459) · honest loading (#457). Promotes #453/456/458/460. CAM-399 canceled-as-covered, CAM-403 carded.
- **Evidence read:** PR diffs #451-459, ticket events + G3 packet comments (`ticket-sync show`), test.md artifacts ×5, the security reports' findings, the wave's per-dispatch usage figures.

## The replayed failures (anti-rubber-stamp — the real ones, not paraphrases)

1. **CAM-400 regression round (the wave's one rework):** the build changed the availability route's source that TWO sibling source-inspection tests pinned; the builder re-pinned cam-55 but missed cam-302 — QA's later full run caught it red and routed it back (`blocked_on`), backend fixed in 1 commit. The builder's own "full suite green" claim predated the final edit — a mid-build green run proved nothing about the last commit.
2. **The security finding that became CAM-401:** the CAM-400 security pass, told to review a capacity diff, ALSO flagged a pre-existing uncapped per-night loop (CAM-344 class) on an unauthenticated route. Built as its own story, the §15b sweep then found 2 MORE sibling gaps — including one severer than the reported finding (a per-night DB query loop inside a serializable tx, driven by POST body dates).

## What we learned

| # | Role(s) | Type | Mistake → better rule | Generality | Destination |
|---|---|---|---|---|---|
| 1 | frontend, backend | process | Two stories broke sibling source-inspection pins that surfaced only later (cam-302 via CAM-400's QA; cam-194 caught by CAM-398's own builder). → Before handoff: grep `__tests__/` for every source string the diff changes, and re-run the full suite as the LAST act after the FINAL edit. | reusable | `.claude/rules/code.md` (new row) — **proposed** |

Validations (not new rules — evidence the promoted rules work): §15b seam-sweep found 2 in-scope sibling gaps on its first outing (CAM-401) and the CAM-400 invariant matrix is now the pinned contract · JSON return discipline 15/15 dispatches post-bounce-rule (was 0/3 on the first test run) · the rework loop (QA `blocked_on` → same-role fix → orchestrator re-verify) and approve-with-nits (2 in-branch nit fixes via agent resume, <2 min each) both ran cleanly · Verify-coverage guard passed 5/5.

One-off (memory): wave dispatch costs — 397: 424k · 398: 528k · 400: ~843k (incl. rework) · 402: 375k · 401: ~962k (incl. nit resume). Seam-scoped stories cost ~2× the S stories, proportional to sweep scope — the sweep tokens bought 3 real sibling defects.

## Gate feedback

- No owner gate rejections this wave (auto-run pre-auth; clean reviews + green CI throughout). The owner's G4 findings that SEEDED the wave were replayed in the CAM-396 retro; all five resulting stories are the closure.

## Routed this run

- **Proposed to rules:** 1 diff (code.md — grep-pins + full-suite-last) → owner approval pending.
- **To orchestrator memory:** wave cost figures + the seam-story ~2× cost pattern.
- **Ledger:** 1 row appended (`proposed`).

## Action items

| # | Action | Owner | Tracker entry |
|---|---|---|---|
| 1 | (none new — CAM-403 already carded; CAM-401 closed its own finding; parity nit closed in-branch) | — | n/a |

## Self-verify

- [x] Mined from durable sources (PRs, ticket events, test.md ×5, security reports)
- [x] Both real failures replayed directly
- [x] Deduped: one NEW lesson only; validations recorded as validations, not twinned rules
- [x] Rule promotion raised as a diff; ledger `proposed`
- [x] No prose-only action item left unticketed

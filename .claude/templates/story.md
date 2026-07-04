<!--
story v2 — ONE atomic story (PR <= ~400 lines). Fill every <stub>; delete guidance comments.
Framework in English; UI copy = verbatim Thai in backticks incl. `{N}` — QA asserts char-for-char.
EARS: Given = state · When = ONE trigger · failure = "IF <condition> THEN <response>". One behavior per row. Ban vague adverbs (fast/easy/robust); use numbers.
No event-codes/testids/class names/endpoints (G2 owns those). AC-n/BR-n/EC-n IDs are contracts. audit needs ## Story + ## AC.
-->

## Story
As a **<Admin|Camper|Host>**, I want <capability>, so that <outcome — a real, observable result, not a vague benefit>.
<!-- If the why is not obvious from the story itself (incident lesson, external constraint), add one line: Why: <reason> -->
Scope: <how far this ticket goes>
Depends on: <ADR/ticket | —>

## AC
<!-- Then = user-visible (screen text = verbatim Thai) · System effect = data outcome, plain language · Neg/edge = failure twin (EC-n/AC-n); — needs a reason. -->
| # | Given | When | Then (user sees, Thai verbatim) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | <state> | <one action> | <result + `ข้อความจริง`> | <data outcome> | EC-1 |

## Rules
- BR-1 <exact values/bounds/transitions/defaults + real Thai error copy> (proves AC-n)

## Edge cases
<!-- cover: invalid · empty/zero · concurrent/duplicate · permission · boundary. -->
- EC-1 IF <unwanted condition> THEN <response + `Thai copy` if visible> (BR-n)

## Data
- <entities/fields touched, plain language> · migration: <reversible | none>

## Seams & refs
- Reuse: <file/function that owns this logic — no parallel logic | —> · Refs: <ADR-NNN | —> (pointers, never implementation)

## Out of scope
- <not doing> → <follow-up CAM-id>

## Self-verify
- AC-1..n → <unit | integration | e2e | owner-verify (browser-only)>
- Story-specific: <ownership · migration up/down · every disallowed transition>
- Gate = /quality-gate · Done = every AC verified on the real Staging URL

## Changelog
- v1 (<date>) — created

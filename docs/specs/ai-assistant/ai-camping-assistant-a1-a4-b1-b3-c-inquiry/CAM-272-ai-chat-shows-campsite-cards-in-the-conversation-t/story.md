---
linear: CAM-272
feature: ai-assistant
epic: ai-camping-assistant-a1-a4-b1-b3-c-inquiry (CAM-266)
persona: camper
artifact: story
owner: product-owner
status: In Progress
version: v1
updated: 2026-07-18
---
# AI chat shows campsite cards in the conversation, tap through to inquiry (AI-3) (CAM-272)

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
<!-- If this story changes how a value is derived/enforced/written: grep-inventory EVERY reader+writer of the affected fields and tag NOW/LATER/NO-CHANGE (architecture.md 15b — the CAM-355 fifth-reader lesson). -->
- Reuse: <file/function that owns this logic — no parallel logic | —> · Refs: <ADR-NNN | —> (pointers, never implementation)

## Out of scope
- <not doing> → <follow-up CAM-id>

## Self-verify
- AC-1..n → <unit | integration | e2e | owner-verify (browser-only)>
- Story-specific: <ownership · migration up/down · every disallowed transition>
- Gate = /quality-gate · Done = every AC verified on the real Staging URL

## Changelog
- v1 (<date>) — created


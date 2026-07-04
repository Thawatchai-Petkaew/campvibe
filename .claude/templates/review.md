---
linear: {{linear}}
feature: {{feature}}
epic: {{epic}}
persona: {{persona}}
artifact: review
owner: security-reviewer
status: {{status}}
version: v1
updated: {{date}}
---
# Security review — {{title}} ({{linear}})

## Scope
<the diff / endpoints / surfaces reviewed>

## 6-area findings
<!-- CampVibe = a Level 2 (L2, standard) class app per OWASP ASVS 5.0 — every finding below cites the ASVS control ID it maps to (e.g. V4.1.1, V6.2.1), not just the 6-area label. A finding with no ASVS ID is not yet specific enough to action. -->
- input: <…> (ASVS <V-id>)
- auth/authz (per `BR-n`): <ownership/role; IDOR checks> (ASVS <V-id>)
- data (PII): <…> (ASVS <V-id>)
- infra: <…> (ASVS <V-id>)
- 3rd-party: <…> (ASVS <V-id>)
- AI/LLM: <…> (ASVS <V-id>, or — if ASVS has no applicable control yet)

## npm audit
<high/critical count (measured) — `npm audit --omit=dev`>

## Verdict
<PASS | BLOCK> — severity-tagged issues if any (Critical/Important/Suggestion/Info)

## Links
`story.md` · `.claude/rules/security.md`

## Changelog
- v1 ({{date}}) — created

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
- input: <…>
- auth/authz (per `BR-n`): <ownership/role; IDOR checks>
- data (PII): <…>
- infra: <…>
- 3rd-party: <…>
- AI/LLM: <…>

## npm audit
<high/critical count (measured) — `npm audit --omit=dev`>

## Verdict
<PASS | BLOCK> — severity-tagged issues if any (Critical/Important/Suggestion/Info)

## Links
`story.md` · `.claude/rules/security.md`

## Changelog
- v1 ({{date}}) — created

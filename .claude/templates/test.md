---
linear: {{linear}}
feature: {{feature}}
epic: {{epic}}
persona: {{persona}}
artifact: test
owner: qa-engineer
status: {{status}}
version: v1
updated: {{date}}
---
# Test — {{title}} ({{linear}})

## AC→test matrix
<!-- risk = H/M/L (impact × likelihood if this AC breaks — ISTQB risk-based testing). Order rows by risk (H first); go deepest on H. Default type mix across the whole matrix ≈ 70% unit / 20% integration / 10% e2e (Google test-pyramid ratio) — an e2e-heavy matrix is a smell, not more rigor. -->
| AC | risk (H/M/L) | type (unit/integ/e2e) | test file | status |
|---|---|---|---|---|
| AC-1 | <H/M/L> | <type> | <path> | ⬜ |

## Validation cases
<per `BR-n`: happy · boundary · error (assert the exact Thai copy from the `ux.md` catalog)>

## Coverage
<% on new code (≥80, measured) — or `not measured`>

## Links
`story.md` (AC/BR) · `.claude/rules/qa.md`

## Changelog
- v1 ({{date}}) — created

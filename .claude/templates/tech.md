---
linear: {{linear}}
feature: {{feature}}
epic: {{epic}}
persona: {{persona}}
artifact: tech
owner: architect
status: {{status}}
version: v1
updated: {{date}}
---
# Tech — {{title}} ({{linear}})

> OPTIONAL artifact. Use ONLY for a rich API contract. Otherwise delete this file —
> the per-story tech delta lives in `story.md ## Data` and the durable architecture in
> `../../feature.md ## Architecture overview` + `docs/adr/*`.

## Data model
<atomic entity/field changes (beyond `story.md ## Data` if complex)>

## API contract
<method/path · zod input/output · authz (ownership/role) · error codes — satisfies `AC-n`/`BR-n`/`EC-n`>

## ADRs
<links to `docs/adr/ADR-NNN-*.md` for hard-to-reverse decisions, or —>
<!-- Confirmation (MADR): every decision recorded here states how compliance is verified — the actual CI check/test that FAILS if the decision is violated (e.g. "Confirmation: __tests__/booking-lock.test.ts asserts Serializable isolation" or "Confirmation: check:ds greps the canonical token"). A decision with no Confirmation line is unenforced — it will drift. -->
Confirmation: <the check/test that fails if this decision is violated, or — if genuinely unenforceable by tooling>

## Links
`../../feature.md` (## Architecture overview) · `prisma/schema.prisma` · `story.md`

## Changelog
- v1 ({{date}}) — created

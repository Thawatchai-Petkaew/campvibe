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
<method/path · zod input/output · authz (ownership/role) · error codes — satisfies `AC-n`/`BR-n`>

## ADRs
<links to `docs/adr/ADR-NNN-*.md` for hard-to-reverse decisions, or —>

## Links
`../../feature.md` (## Architecture overview) · `prisma/schema.prisma` · `story.md`

## Changelog
- v1 ({{date}}) — created

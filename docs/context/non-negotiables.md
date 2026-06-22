# Non-negotiables — absolute don'ts

> Things never to do, under any circumstance — if a raised proposal conflicts with any of these, **the orchestrator must flag it in the gate packet** (no overriding, no deciding on the owner's behalf).
> Below are items the owner has **already stated** in other docs (with source links); anything not yet written = `> TODO(you):` (agents must not guess / invent).

- **Privacy / PDPA + tight authz** — never leak PII; ownership check on every mutation (← `product-strategy.md` #1 Trust · `.claude/rules/security.md` · `.claude/rules/ux.md`)
- **Never grow on fakes** — no fake reviews / fabricated data / leaked data (← `product-strategy.md` #1)
- **No dark patterns** — never deceive or pressure the user (← `README.md` example · `DESIGN.md` anti-slop §5)
- **Every gate is decided by a human, always** — no autonomous approval; the orchestrator raises, it does not decide on the owner's behalf (← `CLAUDE.md` §gates · interactive-only since PR #82)
- **No monetary cost without asking** — any cost (paid API / infra / prod deploy / real messages to users) → stop and ask the owner (← `.claude/rules/ops.md` · `docs/project/business.md`)

> TODO(you): owner-specific don'ts not yet written (e.g. competitors/partners you won't work with, directions you absolutely reject).

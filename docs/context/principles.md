# Principles — product principles always held

> Stable principles (Second Brain) — **the orchestrator reads these before planning / before raising a gate**, to keep proposals aligned with the owner.
> Relocated from `docs/project/product-strategy.md` (a "mutable" file) because these don't change with quarterly strategy.

## Product principles

1. **Trust before growth** — real reviews (verified-stay), verified badge, tight ownership/authz, PDPA; never grow on fakes or leaked data.
2. **Reduce friction in the core loop** — search → view → book → return (wishlist); every feature must help this loop.
3. **Lean** — anything you add must answer how it serves the north-star / persona, or it's cut (Iron Rule §6, `CLAUDE.md`).
4. **Supply–demand balance** — don't push demand past the camps available, or list camps with no demand.
5. **Thailand-first** — copy / UX / PII designed for Thai users (see `.claude/rules/ux.md`, `DESIGN.md`).

## Reference index — principles whose "home" is elsewhere (reference, don't duplicate)

Engineering / design principles already have a single home and the orchestrator reads them every session — this just points the way:

- **Engineering / delivery** → `CLAUDE.md` Iron Rules (Spec-first · One-atomic-story · Self-verify · Read-memory · Never-skip-a-gate · Lean) + `.claude/rules/*` Principles:
  - atomic data / Pixel·Set·Buffet → `.claude/rules/architecture.md`
  - reversible-or-don't-ship + Done ≠ Released → `.claude/rules/ops.md`
  - assume-breach + least-privilege → `.claude/rules/security.md`
  - code-is-a-liability (easy to delete > lots written) → `.claude/rules/code.md`
- **Brand / design** → `DESIGN.md` §1 (teal calm-confidence + voice) + §5 (named anti-patterns / anti-slop)
- **Mutable business** (roadmap / KPI / scope / market) → `docs/project/*`
- **Absolute non-negotiables + how to weigh trade-offs** → [`non-negotiables.md`](non-negotiables.md) · [`decision-heuristics.md`](decision-heuristics.md)

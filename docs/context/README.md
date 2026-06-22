# docs/context — Stable Context & Second Brain

The home for **near-unchanging context (≈100%)** and the **project owner's "Second Brain"** — principles, vision, absolute non-negotiables, and decision heuristics that **the orchestrator (and you) read before planning / before raising a gate**, so proposals stay "aligned with the owner" when other docs don't decide.

> Keep the context homes distinct:
> - **"How"** (how to build; changes with tech) → `.claude/rules/`, `CLAUDE.md`, `DESIGN.md`
> - **"Why / for whom / worth it"** (business/product; mutable) → `docs/project/`
> - **"Stable worldview / Second Brain"** (this one) → `docs/context/`

## Files in this folder (owner extends over time)

- [`principles.md`](principles.md) — **entry point + reference index**: the product principles always held + a map of where the engineering / design / business principles live (referenced, not duplicated).
- [`non-negotiables.md`](non-negotiables.md) — absolute don'ts (things never to do, under any circumstance).
- [`decision-heuristics.md`](decision-heuristics.md) — how to weigh a trade-off (so the orchestrator mirrors the owner's judgment).
- `vision.md` — the long-term picture that rarely changes (empty for now — the owner writes it when ready).
- other reference docs the owner wants the AI to consult occasionally (research / crystallized conclusions).

> The relocated principles (Trust>growth, etc.) came from the old `docs/project/product-strategy.md`; the engineering/design principles still "live" in `CLAUDE.md` / `.claude/rules/*` / `DESIGN.md` — `principles.md` only points to them.

## Who reads it + when

- **orchestrator** — reads before planning / before raising a gate to the owner (paired with `docs/project/*`).
- **owner (human)** — always the gate decision-maker (interactive); if a raised proposal **conflicts with a non-negotiable / principle**, the orchestrator must flag it in the packet (no overriding).

## Convention

- This is "stable" context — edited rarely; change it only when the owner's thinking actually changes.
- `> TODO(you):` = a spot awaiting the owner — **agents must not guess / fill it in**; if a decision point is still a TODO → escalate.
- Edit via a normal PR (keeps history).
- May be empty — the folder is set up for the owner to populate gradually.

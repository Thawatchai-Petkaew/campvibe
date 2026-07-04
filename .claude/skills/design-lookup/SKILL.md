---
name: design-lookup
description: JIT design-knowledge lookup (BM25 over curated CSVs) for UI/UX design questions — which chart type fits the data, doubts about a UX pattern (scroll, touch, forms, z-index, AI-chat UI), or the cognitive/psychology rationale behind a design decision (Hick's, Fitts's, social proof, choice overload). Use during a Design Brief or build when making a UX decision. Do NOT use for every UI task — DESIGN.md stays the visual source of truth — and never to pick colors, fonts, or styles.
---

# design-lookup — JIT UX knowledge search

Dependency-free BM25 search over three small curated datasets. Returns top-3 rows, each field truncated to 300 chars (~1 result set ≤ ~1500 tokens). Data loads per query — nothing preloaded.

## When to use

- **Designer / Frontend agents** during a Design Brief or build, at the moment of a UX decision:
  - "Which chart should the host dashboard use for bookings over time?" → `charts`
  - "Should this table scroll horizontally on mobile? What about z-index for the sticky bar?" → `ux`
  - "Why limit the filter options? Is a scarcity message OK here?" → `cognitive`
- NOT on every UI task. Routine token/component work needs only `DESIGN.md`. Reach for this skill when you need *reasoning* (chart choice, pattern doubt, psychology rationale), not vocabulary.

## Datasets

| `--data` | file | rows | contents |
|---|---|---|---|
| `charts` | `data/charts.csv` | 25 | chart-type selection: when to use / when NOT, volume thresholds, a11y grade + fallback, library recs |
| `ux` | `data/ux-supplement.csv` | 35 | UX gaps NOT already covered by `DESIGN.md` / `.claude/rules/*`: scroll, touch targets edge cases, z-index/stacking, viewport units, autofill/inputmode, AI-chat UI |
| `cognitive` | `data/cognitive-principles.csv` | 52 | UX psychology principles (Hick's → curse of knowledge), each tied to a real CampVibe surface (booking widget, สอบถามที่ว่าง form, catalog cards, review section, host dashboard, availability calendar, lead inbox) |

## How to call

```bash
python3 .claude/skills/design-lookup/search.py "<query>" [--data charts|ux|cognitive] [-n N] [--json]
```

The dataset is auto-detected from query keywords; pass `--data` to force one. Python 3 stdlib only — no installs.

## Example calls

**1. Chart choice** — `python3 .claude/skills/design-lookup/search.py "trend over time line chart" --data charts`

```
## design-lookup results
**Dataset:** charts (--data flag) | **Query:** trend over time line chart | **Found:** 3

### Result 1
- **Data Type:** Trend Over Time
- **Best Chart:** Line Chart (alt: Area Chart)
- **When to Use:** Data has a time axis; user needs to observe rise/fall trends...
- **When NOT:** Fewer than 4 data points (use stat card); more than 6 series...
- **Volume Threshold:** ... - **A11y Grade:** AA - **A11y Fallback:** ... - **Library Rec:** ...
```

**2. UX pattern doubt** — `python3 .claude/skills/design-lookup/search.py "sticky bottom bar overlaps fixed nav z-index"`

Auto-detects `ux`; returns Layout rows (Z-Index Scale, Fixed Element Collisions, Stacking Context) with Do / Don't / Code Good / Code Bad / Severity fields.

**3. Psychology rationale** — `python3 .claude/skills/design-lookup/search.py "too many filter options choice overload"`

Auto-detects `cognitive`; returns e.g. Choice Overload / Hick's Law with Definition, UI_Application, **CampVibe_Tie_In** (the surface this applies to), Do, Dont (incl. ethical-use notes), Source.

## HARD CONSTRAINT — advisory only

Results are **advisory knowledge, never design authority**:

- All visual decisions MUST still map to `DESIGN.md` tokens/components. The Design Gate (`DESIGN.md` §6) is unchanged and still blocks PRs.
- This skill **never generates colors, fonts, or styles**. Any color/library/code hint inside a dataset row (e.g. chart library recs, Tailwind snippets) is context, not permission — implement with our tokens, `components/ui/*` primitives, and lucide icons only.
- Persuasion principles (scarcity, social proof, anchoring, defaults…) carry ethical-use notes: **no dark patterns**, per `docs/context/` non-negotiables. If a suggested tactic conflicts with them, the non-negotiables win.
- Loading/skeleton questions → `.claude/rules/loading.md` owns the standard; validation/PDPA → `.claude/rules/ux.md`; performance budgets → `.claude/rules/performance.md`. This skill supplements, never overrides.

## Attribution

BM25 mechanic + charts/ux source data adapted from "UI/UX Pro Max" (© 2024 Next Level Builder, MIT). `cognitive-principles.csv` is original CampVibe work. See `LICENSE-ATTRIBUTION.md`.

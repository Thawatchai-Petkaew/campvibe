# License & Attribution — design-lookup

## Adapted work (MIT)

The BM25 search mechanic in `search.py` and the source content of two datasets are adapted from **UI/UX Pro Max** (https://github.com/nextlevelbuilder/ui-ux-pro-max-skill):

- `search.py` — BM25 implementation (tokenizer, index, Okapi scoring, k1=1.5 / b=0.75) adapted from the project's `scripts/core.py` + `scripts/search.py`. Adaptations: reduced to 3 curated datasets, per-dataset keyword auto-detection with search-all fallback, 300-char field truncation, single-file zero-dependency CLI.
- `data/charts.csv` — ported from the project's `data/charts.csv` (25 rows), reduced to 8 columns (Data Type, Best Chart, When to Use, When NOT, Volume Threshold, A11y Grade, A11y Fallback, Library Rec); hardcoded color guidance dropped (CampVibe colors come from DESIGN.md tokens only).
- `data/ux-supplement.csv` — 35 rows cherry-picked and adapted from the project's `data/ux-guidelines.csv` (99 rows). Rows already covered by CampVibe standards (`DESIGN.md`, `.claude/rules/ux.md`, `.claude/rules/loading.md`, `.claude/rules/performance.md`) were deliberately excluded; kept rows were reworded/extended for the CampVibe context (Thai copy, Tailwind idioms).

### Original MIT notice

```
MIT License

Copyright (c) 2024 Next Level Builder

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Original work

- `data/cognitive-principles.csv` (52 rows) — original CampVibe work, authored 2026-07: UX psychology principles with definitions, UI applications, CampVibe-specific tie-ins, ethical-use guardrails (no dark patterns per `docs/context/` non-negotiables), and canonical sources (lawsofux.com, NN/g, original papers).
- `SKILL.md`, this file, and the dataset curation/dedupe decisions — original CampVibe work.

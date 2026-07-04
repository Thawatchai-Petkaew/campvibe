#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""design-lookup — JIT BM25 lookup over small curated design-knowledge CSVs.

Datasets (in ./data):
    charts     chart-type selection (25 rows)
    ux         UX supplement — gaps not covered by DESIGN.md / .claude/rules (35 rows)
    cognitive  UX psychology principles tied to CampVibe surfaces (52 rows)

Usage:
    python3 .claude/skills/design-lookup/search.py "<query>" [--data charts|ux|cognitive] [-n N] [--json]

The BM25 search mechanic is adapted from "UI/UX Pro Max"
(https://github.com/nextlevelbuilder/ui-ux-pro-max-skill),
Copyright (c) 2024 Next Level Builder, MIT License — adapted for CampVibe
(3 curated datasets, keyword auto-detect, 300-char field truncation).
See LICENSE-ATTRIBUTION.md in this directory.

Zero dependencies (Python 3 stdlib only). Data is loaded per query — no preloading.
"""

import argparse
import csv
import json
import re
import sys
from collections import defaultdict
from math import log
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parent / "data"
MAX_RESULTS = 3
TRUNCATE_AT = 300

DATASETS = {
    "charts": {
        "file": "charts.csv",
        "search_cols": ["Data Type", "Best Chart", "When to Use", "When NOT", "Library Rec"],
        "output_cols": ["Data Type", "Best Chart", "When to Use", "When NOT",
                        "Volume Threshold", "A11y Grade", "A11y Fallback", "Library Rec"],
        "keywords": [
            "chart", "charts", "graph", "plot", "visualization", "visualize", "viz",
            "trend", "time series", "timeseries", "bar", "pie", "donut", "scatter",
            "heatmap", "funnel", "gauge", "kpi", "sankey", "treemap", "radar",
            "candlestick", "boxplot", "box plot", "waterfall", "sunburst", "bullet",
            "waffle", "choropleth", "sparkline", "histogram", "forecast", "anomaly",
            "correlation", "distribution", "proportion", "percentage chart",
        ],
    },
    "ux": {
        "file": "ux-supplement.csv",
        "search_cols": ["Category", "Issue", "Do", "Don't"],
        "output_cols": ["Category", "Issue", "Do", "Don't", "Code Good", "Code Bad", "Severity"],
        "keywords": [
            "scroll", "sticky", "anchor", "swipe", "gesture", "touch", "tap",
            "mobile", "keyboard", "input", "form", "autofill", "autocomplete",
            "password", "required", "viewport", "breakpoint", "responsive",
            "overflow", "z-index", "zindex", "stacking", "fixed", "table",
            "date format", "number format", "back button", "deep link", "url state",
            "hover", "animation", "haptic", "pull to refresh", "skip link",
            "step indicator", "wizard", "ai disclaimer", "streaming", "inputmode",
        ],
    },
    "cognitive": {
        "file": "cognitive-principles.csv",
        "search_cols": ["Principle", "Category", "Definition", "UI_Application", "CampVibe_Tie_In"],
        "output_cols": ["Principle", "Category", "Definition", "UI_Application",
                        "CampVibe_Tie_In", "Do", "Dont", "Source"],
        "keywords": [
            "law", "principle", "effect", "bias", "psychology", "psychological",
            "cognitive", "gestalt", "memory", "attention", "perception", "persuasion",
            "persuasive", "motivation", "decision", "choice", "hick", "fitts",
            "miller", "jakob", "restorff", "zeigarnik", "peak-end", "peak end",
            "anchoring", "framing", "scarcity", "urgency", "social proof",
            "loss aversion", "default", "overload", "progressive disclosure",
            "recall", "recognition", "doherty", "tesler", "postel", "weber",
            "feedback loop", "commitment", "endowment", "ikea", "mere-exposure",
            "banner blindness", "f-pattern", "z-pattern", "scanning", "nudge",
            "priming", "halo", "decoy", "reciprocity", "chunking", "sunk cost",
            "why do users", "mental model", "trust", "conversion psychology",
        ],
    },
}


class BM25:
    """BM25 ranking (Okapi) — k1/b defaults per the adapted implementation."""

    def __init__(self, k1=1.5, b=0.75):
        self.k1, self.b = k1, b
        self.corpus, self.doc_lengths, self.idf = [], [], {}
        self.avgdl, self.N = 0, 0

    @staticmethod
    def tokenize(text):
        text = re.sub(r"[^\w\s]", " ", str(text).lower())
        return [w for w in text.split() if len(w) >= 2]

    def fit(self, documents):
        self.corpus = [self.tokenize(doc) for doc in documents]
        self.N = len(self.corpus)
        if self.N == 0:
            return
        self.doc_lengths = [len(doc) for doc in self.corpus]
        self.avgdl = sum(self.doc_lengths) / self.N
        doc_freqs = defaultdict(int)
        for doc in self.corpus:
            for word in set(doc):
                doc_freqs[word] += 1
        for word, freq in doc_freqs.items():
            self.idf[word] = log((self.N - freq + 0.5) / (freq + 0.5) + 1)

    def score(self, query):
        tokens = self.tokenize(query)
        scores = []
        for idx, doc in enumerate(self.corpus):
            tf = defaultdict(int)
            for word in doc:
                tf[word] += 1
            s = 0.0
            for t in tokens:
                if t in self.idf:
                    num = tf[t] * (self.k1 + 1)
                    den = tf[t] + self.k1 * (1 - self.b + self.b * self.doc_lengths[idx] / self.avgdl)
                    s += self.idf[t] * num / den
            scores.append((idx, s))
        return sorted(scores, key=lambda x: x[1], reverse=True)


def search_dataset(name, query, max_results):
    """Load one dataset (per query, no preloading) and return (results, top_score)."""
    cfg = DATASETS[name]
    path = DATA_DIR / cfg["file"]
    if not path.exists():
        sys.exit(f"Error: dataset file not found: {path}")
    with open(path, "r", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
    docs = [" ".join(str(r.get(c, "")) for c in cfg["search_cols"]) for r in rows]
    bm25 = BM25()
    bm25.fit(docs)
    ranked = bm25.score(query)
    results = [
        {c: rows[idx].get(c, "") for c in cfg["output_cols"] if c in rows[idx]}
        for idx, s in ranked[:max_results] if s > 0
    ]
    top = ranked[0][1] if ranked else 0.0
    return results, top


def detect_dataset(query):
    """Keyword vote per dataset; unique winner > 0 picks it, else None (search all)."""
    q = query.lower()
    votes = {
        name: sum(1 for kw in cfg["keywords"] if re.search(r"\b" + re.escape(kw) + r"\b", q))
        for name, cfg in DATASETS.items()
    }
    best = max(votes, key=lambda k: votes[k])
    if votes[best] == 0 or list(votes.values()).count(votes[best]) > 1:
        return None
    return best


def truncate(value):
    v = str(value)
    return v[:TRUNCATE_AT] + "..." if len(v) > TRUNCATE_AT else v


def format_output(dataset, query, results, detected):
    out = [
        "## design-lookup results",
        f"**Dataset:** {dataset} ({'auto-detected' if detected else '--data flag'}) | "
        f"**Query:** {query} | **Found:** {len(results)}",
        "",
    ]
    if not results:
        out.append("No match. Try other terms or force a dataset with --data charts|ux|cognitive.")
    for i, row in enumerate(results, 1):
        out.append(f"### Result {i}")
        out.extend(f"- **{k}:** {truncate(v)}" for k, v in row.items())
        out.append("")
    out.append("> Advisory knowledge only — visual decisions MUST map to DESIGN.md tokens/components.")
    return "\n".join(out)


def main():
    parser = argparse.ArgumentParser(description="design-lookup: BM25 over curated design CSVs")
    parser.add_argument("query", help="Search query")
    parser.add_argument("--data", "-d", choices=sorted(DATASETS), help="Force a dataset")
    parser.add_argument("--max-results", "-n", type=int, default=MAX_RESULTS)
    parser.add_argument("--json", action="store_true", help="Output JSON instead of markdown")
    args = parser.parse_args()

    detected = args.data is None
    dataset = args.data or detect_dataset(args.query)
    if dataset:
        results, _ = search_dataset(dataset, args.query, args.max_results)
    else:  # no clear keyword winner: search all, keep the best-scoring dataset
        dataset, results, best = "cognitive", [], -1.0
        for name in DATASETS:
            r, top = search_dataset(name, args.query, args.max_results)
            if top > best:
                dataset, results, best = name, r, top

    if args.json:
        payload = {"dataset": dataset, "query": args.query, "count": len(results),
                   "results": [{k: truncate(v) for k, v in r.items()} for r in results]}
        print(json.dumps(payload, indent=2, ensure_ascii=False))
    else:
        print(format_output(dataset, args.query, results, detected))


if __name__ == "__main__":
    main()

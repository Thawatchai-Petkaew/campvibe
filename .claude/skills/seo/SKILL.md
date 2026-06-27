---
name: seo
description: Audit a CampVibe public page or route-sweep against the SEO/AEO standard (`.claude/rules/seo.md`) and produce a gap report — assesses metadata, JSON-LD, canonical + hreflang, sitemap/robots, index-vs-noindex, and Core-Web-Vitals presence, then proposes the fixes as story candidates. Audit-only: it reports, it does not apply. Use when assessing a public route's SEO readiness before or after building it, or to triage what SEO work a route needs. Do NOT use to APPLY the fixes (open stories and build per `.claude/rules/seo.md` through the gates), to author the SEO standard itself (`.claude/rules/seo.md` via the `retro` skill), or to profile/budget Core Web Vitals (`.claude/rules/performance.md`).
---

# seo

## Overview

CampVibe has a complete SEO/AEO standard in `.claude/rules/seo.md`, but no workflow that checks a real page against it — so gaps (a public route with no per-page metadata, a missing `app/sitemap.ts`, no JSON-LD) go unnoticed until late. This skill is an **audit**: it runs the seo.md per-page checklist against a route, verifies the signals on the real Staging URL, and produces a gap report with proposed fixes. It does **not** change code — gaps become stories built separately per seo.md.

## Quick Reference

Invoke: `/camper "seo <route or 'sweep public'>"`. Then:

1. **Target** — name the public route(s) (`app/page.tsx`, `app/campgrounds/[slug]/page.tsx`, host profile, articles) or sweep all public routes; separate public (index) from auth (noindex).
2. **Per-page audit** vs the seo.md checklist (§1–8): metadata · JSON-LD · canonical + hreflang · server-render · semantic · `next/image`/CWV.
3. **Site-wide audit**: `app/sitemap.ts` · `app/robots.ts` · `metadataBase`.
4. **Verify on Staging (curl-able only)**: `/sitemap.xml` + `/robots.txt` status; view-source for `<title>`/`og:`/`canonical`/`application/ld+json`. Rich Results / Search Console = **owner-verify** (browser-only).
5. **Gap report** — table `signal | present? | gap | proposed fix | severity`, grouped site-wide vs per-page, each citing the seo.md §.
6. **Hand off** the gaps as story candidates — do NOT apply.

## When to Use

- Assessing a public route's SEO readiness before building it, or auditing it after build.
- Triaging what SEO work the site/route needs (e.g. the known gaps: no `sitemap.ts`/`robots.ts`, no JSON-LD, home/detail missing per-page `generateMetadata`).

**NOT for:**

- **Applying** the fixes → open stories and build per `.claude/rules/seo.md` through the gates (this skill is audit-only).
- Authoring/editing the SEO standard → `.claude/rules/seo.md` via the `retro` skill.
- Profiling or budgeting Core Web Vitals → `.claude/rules/performance.md` (this skill only checks CWV *presence*, citing measured numbers).
- Heading/landmark/a11y design → `DESIGN.md` (the Designer owns semantic HTML).

## Prerequisites

Read first: `.claude/rules/seo.md` (the standard every check is graded against — do not invent SEO rules) · `.claude/rules/performance.md` (for the CWV numbers to cite) · `DESIGN.md` (semantic/a11y baseline). Have: the target route(s) under `app/`, the data source in `prisma/schema.prisma` (to confirm a signal has real data to back it), and the Staging URL (`campvibe-staging.vercel.app`).

## Workflow

1. **Pick the target.** Name the public route(s) — `app/page.tsx`, `app/campgrounds/[slug]/page.tsx`, host profile, articles — or sweep public routes. List which routes are public (must index) vs auth (must `noindex`: dashboard/booking/wishlist).
2. **Per-page audit** against the seo.md checklist, by reading the route + grepping:
   - `generateMetadata`: `grep -rlE "generateMetadata|export const metadata" app/` → present on every public route? `title`/`description` specific (not the layout default)? `alternates.canonical`? OG/Twitter? `alternates.languages` th/en? correct `robots` (seo.md §3, §8).
   - JSON-LD: `grep -rn "application/ld+json" app/ components/` → `Campground`/`Product` + `BreadcrumbList` on detail, `Organization` site-wide, `FAQPage` for Q&A; **values must match what renders** (seo.md §4).
   - Server-render: no client-only fetch on crawled content (seo.md §2).
   - Semantic: one `h1`, ordered headings, landmarks, `alt` (per `DESIGN.md`, seo.md §5).
   - CWV: `next/image` + `priority` above-the-fold + `width/height`; cite the measured LCP/CLS/INP from `.claude/rules/performance.md`/baseline — do not re-profile (seo.md §6).
3. **Site-wide audit.** `app/sitemap.ts` + `app/robots.ts` exist (generate published URLs only, block auth)? `metadataBase` set in `app/layout.tsx`? (seo.md §7).
4. **Verify on the real Staging URL — curl-able layer only.** `curl -sI https://campvibe-staging.vercel.app/sitemap.xml` + `/robots.txt` (200?); `curl -s <staging>/<route> | grep -oE "<title>|og:|canonical|application/ld\\+json"` (signal present in SSR HTML?). The Google **Rich Results test / Search Console** are browser-only → mark them **owner-verify** (per `.claude/rules/qa.md` — never claim a browser-only signal from curl).
5. **Produce the gap report** — a table `signal | present? | gap | proposed fix | severity`, grouped **site-wide** then **per-page**, each row citing the seo.md § it grades against.
6. **Hand off.** Turn the gaps into story candidates (per route / per signal) for the delivery loop (`discover` / `/new-feature`); build happens per `.claude/rules/seo.md` through G1–G5. This skill changes no app code.

## Examples

✅ **A gap-report row** (cites the standard, proposes a fix, does not apply):

| signal | present? | gap | proposed fix | severity |
|---|---|---|---|---|
| JSON-LD (seo.md §4) | ❌ | `campgrounds/[slug]` renders name/price/rating but no `Campground` schema | add `<script type="application/ld+json">` reflecting rendered values | high |
| `app/sitemap.ts` (seo.md §7) | ❌ | absent — published camps not in any sitemap | add `app/sitemap.ts` from Prisma (published only) | high |

❌ **Editing the page to add the metadata inline** during the audit — out of scope; this skill reports, a separate story applies it per seo.md.

## Reference Files

- `.claude/rules/seo.md` — the standard every check grades against (the §s the gap report cites).
- `.claude/rules/performance.md` — Core Web Vitals numbers to cite (do not re-profile here).
- `DESIGN.md` — semantic HTML / a11y baseline (heading/landmarks/`alt`).
- the `discover` / `new-feature` skills — turn the reported gaps into buildable stories.

## Next Steps

Gaps → open stories via `discover` / `/new-feature` → build per `.claude/rules/seo.md` through the gates → re-run this `seo` audit → confirm the signals on the real Staging URL (view-source / Rich Results) before the route is promoted (this audit is part of the pre-prod SEO check).

## Standards

1. **Audit-only.** Report gaps and propose fixes; never apply them. Building is a separate story per seo.md through G1–G5.
2. **Ground every check in `seo.md`.** Each row cites the standard's §; do not invent SEO rules here. If a signal isn't in seo.md, it isn't graded.
3. **Verify on the real Staging URL.** Curl the curl-able (`/sitemap.xml`, `/robots.txt`, view-source for title/og/canonical/JSON-LD); the browser-only Rich Results / Search Console are **owner-verify** — never claimed from curl.
4. **Report only real gaps.** A signal a route legitimately doesn't need is not a gap (`FAQPage` only where there's Q&A; `noindex` on auth pages is correct — flag only `noindex` slipping onto a public page, or `index` on an auth page).
5. **CWV is cited, not re-measured.** `.claude/rules/performance.md` owns profiling; this audit checks presence + cites the measured numbers.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "Audit means fix it too." | Audit-only — report the gap + open a story; building happens per `seo.md` through the gates. |
| "The metadata's probably fine, skip the grep." | Confirm with `grep generateMetadata` + Staging view-source. A missing per-page `generateMetadata` (home/detail) is the most common real gap. |
| "The JSON-LD tag is present, mark it done." | It must match the rendered values; mismatched schema earns a penalty. Check values, not just presence (seo.md §4). |
| "It's there in local view-source, that's enough." | Local ≠ Staging. Verify the signal on the real Staging URL; the browser-only Rich Results test is owner-verify. |
| "Re-measure CWV in the audit." | `performance.md` owns CWV profiling. Cite the measured numbers; don't re-profile here. |
| "The dashboard is `noindex`, that's a gap." | Auth pages SHOULD be `noindex` — correct, not a gap. Only flag `noindex` slipping onto a public page. |

## Verify (exit criteria)

- [ ] Target route(s) named; public (index) vs auth (noindex) separated.
- [ ] Every seo.md per-page checklist item assessed present / missing / N-A (citing the §); site-wide `sitemap.ts` / `robots.ts` / `metadataBase` checked.
- [ ] Staging signals verified for what's curl-able (`/sitemap.xml` + `/robots.txt` status, view-source `title`/`og`/`canonical`/`application/ld+json`); browser-only (Rich Results) flagged owner-verify.
- [ ] Gap report produced — `signal | present | gap | fix | severity`, grouped site-wide then per-page, each row citing `.claude/rules/seo.md`.
- [ ] Gaps handed off as story candidates; **no app code changed** (audit-only).
- [ ] No invented SEO rules (every check traces to seo.md); markdown clean (blank line around every heading/list/table).

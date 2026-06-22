---
name: seo-and-aeo
description: Standard for making CampVibe's public surfaces crawlable and machine-readable from the start. Use when building a public page (camp list/detail, host profile, article). Use when adding metadata, JSON-LD, sitemap/robots, or hreflang. Use when deciding index vs noindex on a route. Memory for the Frontend role (Designer owns semantic/a11y, Backend supplies publishable data); pairs with DESIGN.md, .claude/rules/performance.md, .claude/rules/architecture.md, .claude/rules/api.md.
---

# SEO & AEO

## Overview

Public surfaces have to be crawlable and machine-readable from the first commit, not bolted on later — a crawler or AI answer engine that runs no JS still has to see the name, price, location, and rating. Index vs noindex is a deliberate decision per route: public pages are indexed, auth pages never are.

## When to Use

- Building any public page: camp list, camp detail, host profile, article
- Adding or reviewing `generateMetadata`, JSON-LD, `app/sitemap.ts`, `app/robots.ts`, or hreflang
- Deciding whether a route is `index` or `noindex`
- Structuring question→answer content (AEO) or `llms.txt` so answer engines quote it correctly

**NOT for:**

- Designing heading/content hierarchy or the a11y baseline — that's the Designer's job; see `DESIGN.md` (semantic HTML / a11y is not duplicated here)
- Defining the data model or API contract — hand to Architect/Backend; see `.claude/rules/architecture.md` and `.claude/rules/api.md`. This std only consumes data that is already publishable
- Profiling/budgeting Core Web Vitals beyond the rules below — see `.claude/rules/performance.md`

> Read before working: this file + `CLAUDE.md` + `DESIGN.md`. For a public page, compare against the real route in `app/` and the data source in `prisma/schema.prisma`.

## Standards

### 1. Principles

- **Public = server-rendered + crawlable:** camp list / camp detail / host profile / article must render the main content plus the key facts (name / price / location / rating) in HTML from the server, always — the crawler/AI must see it without running JS.
- **AEO = answer the question directly + machine-readable:** lay content out as question→answer, use entity terms consistently (glossary), expose structured FAQ / `llms.txt` so answer engines can quote it correctly.
- **Separate index/noindex on purpose:** public = index; auth (dashboard/booking/wishlist) = `noindex`, always — never let it slip the wrong way.
- **Lean & Done-on-Staging:** add metadata/JSON-LD only as far as the real page has content to back it (never mark up things that don't render); Done = verify the signal on the **real Staging URL** (view-source / Rich Results), not just local.

### 2. Rendering

Public pages = Server Component (default), SSG/ISR. Camp pages use ISR (`revalidate`) and fetch via service/Prisma. **No client-only fetch on a public page** (the crawler sees a blank page). Interactive parts split into small Client Components under a shell that the server already rendered.

### 3. Metadata (Metadata API)

Every public page has its own `generateMetadata`:

- `title` specific per camp/page + non-duplicate `description`
- `alternates.canonical`
- Open Graph / Twitter (use `app/opengraph-image`)
- `alternates.languages` hreflang `th`/`en` (i18n)
- correct `robots`

### 4. Structured data (JSON-LD)

Inject via `<script type="application/ld+json">` inside a Server Component:

- Camp page = `Campground` / `Product` / `LocalBusiness` (`name`, `price`, `aggregateRating`, `geo`, `image`, `address`) + `BreadcrumbList`
- Site = `Organization`
- Page with Q&A = `FAQPage`

Markup must reflect only the values actually rendered.

### 5. Semantic HTML

One `h1` per page, ordered `h2/h3`, landmarks (`header/nav/main/footer`), complete `alt`, descriptive links — the a11y baseline detail lives in `DESIGN.md` (not duplicated here).

### 6. Performance (Core Web Vitals)

Budget LCP/CLS/INP must pass; use `next/image` for every image + `priority` on above-the-fold images + set `width/height` to prevent CLS; `preconnect` fonts. CWV budgeting/profiling detail lives in `.claude/rules/performance.md`.

### 7. sitemap & robots

`app/sitemap.ts` + `app/robots.ts` generate from Prisma (only camps/articles that are `published`) — include all public URLs; robots blocks auth paths.

### 8. noindex on auth

Every dashboard/booking/wishlist page sets `robots: { index: false }` on purpose — never let `noindex` slip onto a public page, and never forget `noindex` on an auth page.

### 9. AEO

Question→answer structure in articles/FAQ, terms from the glossary used consistently, ship structured FAQ + `llms.txt` so answer engines can cite accurately.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "Client-only render the camp page is fine." | The crawler sees a blank page. Use a Server Component + `generateMetadata`, fetch server-side. |
| "Reuse the same `title`/`description` everywhere." | Duplicate metadata sinks ranking. Make it specific per camp/page from real data. |
| "Skip `canonical`, it's optional." | Missing canonical creates duplicate content (params/dupe pages). Set `alternates.canonical` on every page. |
| "noindex/index doesn't need checking per route." | `noindex` slips onto public pages and dashboards stay indexed. Check robots per route before merge. |
| "Plain `<img>` without `alt` is good enough." | It tanks a11y and SEO. Use `next/image` + meaningful `alt` + `priority` above-the-fold. |
| "Mark up extra JSON-LD to look richer." | JSON-LD that doesn't match rendered content earns a Google penalty. Mark up only values actually rendered. |

## Verify (exit criteria — per public page)

- [ ] Server-rendered (SSG/ISR) with main content in the HTML — no client-only fetch on content that must be crawled
- [ ] `generateMetadata` complete: specific `title` + `description` + `canonical` + OG/Twitter + hreflang `th`/`en` + `robots`
- [ ] JSON-LD matches rendered content (`Campground`/`Product` + `BreadcrumbList`; `Organization`; `FAQPage` if there's Q&A)
- [ ] One `h1` + ordered headings + landmarks + complete `alt` (per `DESIGN.md`)
- [ ] `next/image` on every image + `priority` above-the-fold + Core Web Vitals (LCP/CLS/INP) pass
- [ ] In `app/sitemap.ts` (if `published`) + not blocked by `app/robots.ts`
- [ ] Auth pages (dashboard/booking/wishlist) set `noindex` on purpose — confirm it doesn't slip onto public pages
- [ ] **Verify the signal on the real Staging URL** (view-source / Rich Results / Lighthouse) before the story enters state `Done`

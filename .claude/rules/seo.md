---
name: seo-and-aeo
description: Standard for making CampVibe's public surfaces crawlable and machine-readable from the start. Use when building a public page (camp list/detail, host profile, article). Use when adding metadata, JSON-LD, sitemap/robots, or hreflang. Use when deciding index vs noindex on a route. Memory for the Frontend role (Designer owns semantic/a11y, Backend supplies publishable data); pairs with DESIGN.md, .claude/rules/performance.md, .claude/rules/architecture.md, .claude/rules/api.md.
paths:
  - app/**/page.tsx
  - app/**/layout.tsx
---

# SEO & AEO

## Overview

Public surfaces have to be crawlable and machine-readable from the first commit, not bolted on later — a crawler or AI answer engine that runs no JS still has to see the name, price, location, and rating. Index vs noindex is a deliberate decision per route: public pages are indexed, auth pages never are.

## Quick Reference

Per-page checklist (run top→bottom for every public route):

| # | Step | Do |
|---|---|---|
| 1 | Metadata export | `export async function generateMetadata()` — specific `title` + non-duplicate `description` (Server Component, fetch server-side) |
| 2 | OG / Twitter | Open Graph + Twitter tags via the Metadata API; image from `app/opengraph-image` |
| 3 | JSON-LD | `<script type="application/ld+json">` — `Campground`/`Product` + `BreadcrumbList` (`Organization` site-wide, `FAQPage` for Q&A); values must match what renders |
| 4 | Canonical + hreflang | `alternates.canonical` + `alternates.languages` `th`/`en` |
| 5 | sitemap / robots | listed in `app/sitemap.ts` if `published`; not blocked by `app/robots.ts`; auth paths blocked |
| 6 | index vs noindex | `robots` set on purpose — public = index, auth (dashboard/booking/wishlist) = `noindex` |
| 7 | Core Web Vitals | `next/image` + `priority` above-the-fold + `width/height`; LCP/CLS/INP pass |
| — | Done | verify the signal on the real **Staging URL** (view-source / Rich Results), not just local |

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

## Prerequisites

Read first: this file · `CLAUDE.md` · `DESIGN.md` (semantic/a11y baseline) · `.claude/rules/performance.md` (Core Web Vitals budgets). For the page in hand: the real route under `app/` and the publishable data source in `prisma/schema.prisma` (Backend supplies it; this std only consumes data that is already publishable). Know which routes are public (index) vs auth (noindex) before you write a single `robots` value.

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

## Examples

✅ A camp detail page (`app/camps/[slug]/page.tsx`) — Server Component with `generateMetadata` + JSON-LD reflecting only rendered values:

```tsx
export async function generateMetadata({ params }): Promise<Metadata> {
  const camp = await getCampBySlug(params.slug);
  return {
    title: `${camp.name} — จองแคมป์ | CampVibe`,
    description: camp.summary, // non-duplicate, from real data
    alternates: {
      canonical: `https://campvibe.app/camps/${camp.slug}`,
      languages: { th: `/th/camps/${camp.slug}`, en: `/en/camps/${camp.slug}` },
    },
    openGraph: { title: camp.name, images: [`/camps/${camp.slug}/opengraph-image`] },
    twitter: { card: "summary_large_image", title: camp.name },
    robots: { index: true, follow: true },
  };
}

export default async function Page({ params }) {
  const camp = await getCampBySlug(params.slug); // server-side fetch
  return (
    <main>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Campground",
          name: camp.name,
          address: camp.address,
          geo: { "@type": "GeoCoordinates", latitude: camp.lat, longitude: camp.lng },
          aggregateRating: { "@type": "AggregateRating", ratingValue: camp.rating, reviewCount: camp.reviewCount },
        }) }}
      />
      {/* name / price / location / rating render in HTML, no client-only fetch */}
    </main>
  );
}
```

❌ A public page with no metadata and client-only data — the crawler sees a blank shell:

```tsx
"use client";
export default function Page({ params }) {
  const { data } = useSWR(`/api/camps/${params.slug}`); // crawler runs no JS → empty
  return <div>{data?.name}</div>; // no generateMetadata, no canonical, no JSON-LD
}
```

✅ A valid `app/sitemap.ts` entry (published camps only):

```ts
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const camps = await getPublishedCamps(); // only status === "published"
  return camps.map((c) => ({
    url: `https://campvibe.app/camps/${c.slug}`,
    lastModified: c.updatedAt,
    changeFrequency: "weekly",
    priority: 0.8,
  }));
}
```

## Reference Files

- `.claude/rules/performance.md` — Core Web Vitals (LCP/CLS/INP) budgeting and profiling detail referenced from Standards §6
- `.claude/rules/code.md` — code/component conventions for the pages this std governs
- `DESIGN.md` — semantic HTML / a11y baseline (heading hierarchy, landmarks, `alt`); not duplicated here
- `CLAUDE.md` — the ironclad rules + 3-env Definition of Done (verify on Staging)

## Next Steps

Public-facing pages must pass this SEO check before promote — it is part of the pre-prod gate. Pairs with the `.claude/rules/performance.md` (CWV) and observability pre-prod checks: confirm metadata/JSON-LD/canonical/sitemap on the real Staging URL (view-source / Rich Results / Lighthouse), then proceed to promote `staging`→`main` per the promotion rules.

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

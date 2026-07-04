---
linear: CAM-187
feature: performance-and-freshness
epic: data-layer-performance-and-freshness (CAM-186)
persona: platform
artifact: tech
owner: architect
status: In Progress
version: v1
updated: 2026-06-26
---
# Tech — MEAS-1 measure baseline (CWV / query / bundle) (CAM-187)

MEAS-1 is a pure measurement harness. It does NOT change performance — it instruments and captures real numbers so every subsequent optimization story has a before/after baseline. No application behavior changes for the end-user (AC-1).

---

## ADR-007 — CWV Vital Storage: structured log vs Prisma table

**Status: PROPOSED** · Story: CAM-187 · Date: 2026-06-26

### Context

`POST /api/vitals` receives LCP/INP/CLS/TTFB readings from `web-vitals` (browser). We need to store them so we can compare before vs after each optimization sprint. Two viable options:

**Option (a) — Prisma model `WebVital`** (additive SQL table)
- Queryable with SQL, joinable, filterable by metric/rating/route/deployShA
- Requires a migration (`CREATE TABLE "WebVital"`) + Prisma client regeneration
- Permanent store; grows indefinitely; would need a retention policy

**Option (b) — Structured JSON log to Vercel log drain** (`console.log(JSON.stringify({...}))`)
- Zero migration, zero new table, zero schema risk
- Vercel captures structured `console.log` to the log drain (queryable in the Vercel dashboard / log search for 30 days; exportable via log drain to an external store)
- Ephemeral by default (30-day Vercel log retention on Pro/Hobby), which is exactly what a time-boxed measurement sprint needs
- Fast to stand up; easy to delete when MEAS-1 is done (delete the route + reporter component)

**Option (c) — Both** (log + table)
- Maximum redundancy, but doubles the complexity with no extra value at this stage

### Decision

**Option (b) — structured JSON log only.**

Rationale:
1. MEAS-1 is a time-boxed measurement gate, not a long-lived analytics product. The before/after comparison happens once per optimization sprint, not across months.
2. Vercel captures `console.log(JSON.stringify(...))` as structured log entries queryable for 30 days — sufficient for sprint-cadence compare.
3. Zero migration = zero risk to staging DB, zero Prisma client churn, zero rollback concern. Lean > complete (`.claude/rules/architecture.md` principle 3).
4. The baseline table (`baseline.md`) is a hand-authored snapshot from a single capture session — a SQL store does not improve its quality.
5. If a future story needs a durable analytics store for vitals (e.g. trend dashboards), that story can add the `WebVital` model then, with AC that justifies the migration. YAGNI.

**What this means for the `/api/vitals` route:** validate the payload with zod, stamp the deploy SHA + route template, emit one structured JSON log line per request at `info` level. No Prisma write. No migration.

### Alternatives

- **Option (a)** rejected: a new table with no long-term AC is premature abstraction (debt). Adds a migration that must be reversible, tested on staging, and eventually cleaned up — all overhead with no measurement benefit over logs at this stage.
- **Option (c)** rejected: duplicates effort and storage for zero additional signal.

### Consequences

- No migration, no schema change for this story.
- Vitals are visible in the Vercel log dashboard / log drain for 30 days from each capture run.
- If log retention is insufficient for a multi-sprint comparison window, the owner must decide: extend via a log drain export (free-tier tools: Axiom, Logflare) OR add the `WebVital` Prisma model in a follow-up story with explicit AC. That decision is flagged as an open trade-off below.
- The `/api/vitals` route and `components/vitals-reporter.tsx` are self-contained — easy to remove or extend.

---

## Data model

No Prisma migration required for this story. `## Data` in `story.md` records this explicitly.

Schema.prisma diff: **none.**

Classification note: vitals payload carries no PII (no userId, no email, no name). The only identifiers are: `metric` (LCP/INP/CLS/TTFB), `rating` (good/needs-improvement/poor), `value` (float ms/unitless), `routeTemplate` (pattern string, NOT raw URL), `deployShA` (public env var). All fields are [Public].

---

## API contract

### `POST /api/vitals`

Recorded in `schema/api-schema.json` under `"POST /api/vitals"`.

**Auth:** unauthenticated (public telemetry endpoint — browser `sendBeacon` fires without a session). No user data is accepted or stored.

**Rate limit:** in-process sliding window via existing `lib/rate-limit.ts` — limit: 200 req / 15 min per IP (lenient; normal page loads send 4 vitals per visit). Returns `429` on excess. Note: Vercel serverless = per-instance counter; this is best-effort, not distributed. Sufficient for abuse deterrence at this scale.

**Zod schema** — `lib/validations/vitals.ts`:

```
VitalPayloadSchema = z.object({
  name:          z.enum(['LCP', 'INP', 'CLS', 'TTFB', 'FCP']),
  value:         z.number().finite().nonnegative(),
  rating:        z.enum(['good', 'needs-improvement', 'poor']),
  id:            z.string().max(64),            // web-vitals attribution id (not PII)
  navigationType: z.string().max(32).optional(), // 'navigate'|'reload'|'back-forward'
  routeTemplate: z.string().max(200),            // e.g. '/camps/[slug]', NOT '/camps/abc-123'
})
```

`routeTemplate` is set by the client (see reporter) by stripping dynamic segments — it must NEVER contain a raw camp slug, user id, or any path segment that could identify a person or record.

**Input:** JSON body matching `VitalPayloadSchema`.

**Output (success 204 No Content):** empty body. The endpoint is fire-and-forget from the browser's perspective (`sendBeacon`). No data is returned.

**Processing:** validate → extract IP from `x-forwarded-for` for rate-limit key (never logged) → stamp `deployShA` from `process.env.VERCEL_GIT_COMMIT_SHA ?? 'local'` → emit one structured log line:

```json
{
  "level": "info",
  "event": "cwv_vital",
  "metric": "LCP",
  "value": 1842.3,
  "rating": "good",
  "routeTemplate": "/camps/[slug]",
  "navigationType": "navigate",
  "deployShA": "a1b2c3d",
  "vitalsId": "v3-..."
}
```

No `userId`, no `email`, no raw URL with IDs, no session data in the log. Consistent with `.claude/rules/observability.md` (allowlist fields, no PII).

**Errors:**

| Code | Condition |
|---|---|
| 204 | success (no body) |
| 400 | zod validation failed — bad metric name, NaN value, etc. Body: `{ error: { code: 'VALIDATION_ERROR', message: string } }` |
| 429 | rate limit exceeded — Body: `{ error: { code: 'RATE_LIMITED', retryAfter: number } }` |
| 500 | internal — generic message only, detail logged server-side |

401/403/404/409 are deliberately omitted: the endpoint is public, no resource is fetched or mutated.

---

## Instrumentation points

### 1. `components/vitals-reporter.tsx`

- `"use client"` — mounted once in `app/layout.tsx` (inside `<Providers>`, after hydration).
- Uses `web-vitals` npm package (`onLCP`, `onINP`, `onCLS`, `onTTFB`, `onFCP`).
- Each callback fires `navigator.sendBeacon('/api/vitals', JSON.stringify(payload))`.
- `routeTemplate` is derived client-side: `window.location.pathname` with numeric/uuid segments replaced by `[id]` and known slug patterns replaced by `[slug]`. A simple regex is sufficient; do not over-engineer.
- Does NOT import anything from Prisma or any server module.
- Renders `null` (no DOM output visible to the user — AC-1).

Mount point in `app/layout.tsx`:
```
<Providers>
  <LanguageProvider>
    <VitalsReporter />   {/* new — renders null, fires sendBeacon */}
    {children}
    <Toaster />
  </LanguageProvider>
</Providers>
```

### 2. `app/api/vitals/route.ts`

- `export async function POST(req: Request)` — no `auth()` call (public).
- Imports `VitalPayloadSchema` from `lib/validations/vitals.ts`.
- Rate-limit key: `vitals:${ip}` using existing `checkRateLimit` from `lib/rate-limit.ts` (limit: 200, windowMs: 15*60*1000).
- Emits one `console.log(JSON.stringify({level:'info', event:'cwv_vital', ...}))` line.
- Returns `new Response(null, { status: 204 })` on success.
- No Prisma import.

### 3. `lib/prisma.ts` — query logging (gated)

Extend the singleton to support query event logging when `PRISMA_QUERY_LOG=1`:

```ts
const prismaClientSingleton = () => {
  const client = new PrismaClient({
    log: process.env.PRISMA_QUERY_LOG === '1'
      ? [{ emit: 'event', level: 'query' }]
      : [],
  });
  if (process.env.PRISMA_QUERY_LOG === '1') {
    client.$on('query', (e) => {
      console.log(JSON.stringify({
        level: 'debug',
        event: 'prisma_query',
        durationMs: e.duration,
        // model extracted from e.query via simple regex — never log e.params (PII risk)
        model: e.query.match(/FROM "(\w+)"/i)?.[1] ?? 'unknown',
      }));
    });
  }
  return client;
};
```

- `PRISMA_QUERY_LOG=1` is set in `.env.local` (dev) and added to Vercel staging env only for the capture window, then removed.
- NEVER log `e.params` (contains query parameter values — potential PII/Financial data).
- NEVER enable in production.

### 4. Route-timing helper — `lib/route-timing.ts` (new, thin)

A lightweight wrapper for catalog read/write handlers (listing + detail routes) to emit RED metrics:

```ts
// Shape — exact implementation is backend's job
export async function withTiming<T>(
  label: string,   // e.g. 'catalog_list' | 'camp_detail'
  fn: () => Promise<T>
): Promise<T> {
  const start = performance.now();
  try {
    const result = await fn();
    const durationMs = performance.now() - start;
    console.log(JSON.stringify({ level: 'info', event: 'route_timing', label, durationMs, status: 'ok' }));
    return result;
  } catch (err) {
    const durationMs = performance.now() - start;
    console.log(JSON.stringify({ level: 'error', event: 'route_timing', label, durationMs, status: 'error' }));
    throw err;
  }
}
```

Applied to: the catalog listing handler (the primary N-query suspect) and the camp detail handler. Wraps the service/Prisma call only — not the full route handler (auth/zod remain outside).

### 5. `next.config.ts` — bundle analyzer

```ts
import withBundleAnalyzer from '@next/bundle-analyzer';

const withAnalyzer = withBundleAnalyzer({
  enabled: process.env.ANALYZE === '1',
  openAnalyzer: false,
});

const nextConfig: NextConfig = { /* existing config */ };

export default withAnalyzer(nextConfig);
```

Dev usage: `ANALYZE=1 npm run build` — generates `.next/analyze/client.html` + `server.html`. Add `@next/bundle-analyzer` as a dev-dependency. The analyzer is never enabled in Vercel builds (env var not set).

---

## 128-camp loader — `scripts/load-mock-staging.mjs`

Idempotent script that reads `prisma/data/mock-staging-all.json` and upserts 65 hosts + 128 campsites into the staging DB. Used to satisfy AC-2.

**Key design constraints:**
- MUST use `upsert` keyed by `email` (hosts) and `nameThSlug` (campsites) — never `deleteMany` the catalog (shared staging DB safety; existing non-mock data must not be destroyed).
- Hosts: upsert by `email`; bcrypt password with 12 rounds (same pattern as existing `app/api/seed/route.ts`).
- Campsites: upsert by `nameThSlug`; set `isPublished: true`; create a `Location` row per campsite (upsert by lat+lon within 0.001 degree or create new — see implementation note).
- Options (MasterData): the JSON stores options as CSV strings per group (`accessTypes`, `facilities`, `externalFacilities`, `equipment`, `activities`, `terrain`). The loader must split each CSV, look up `MasterData.code`, and use the `connect` operator to wire `options` — it does NOT upsert MasterData codes (those are owned by the master seed).
- Images: use `imageManifest` (array of `{path, role, alt}`) to create `Image` rows via `createMany` with `skipDuplicates: true` (keyed on `url + campSiteId`). The `logo` field on CampSite is set from the manifest entry with `role === 'logo'`.
- Spots: create with `createMany` + `skipDuplicates: true` on `name + campSiteId`.
- The script is idempotent: run it multiple times = same result.

**npm script** added to `package.json`:
```json
"db:load:staging": "node scripts/load-mock-staging.mjs"
```

**Implementation note on Location upsert:** `Location` has no unique constraint suitable for upsert by lat/lon. The loader should `findFirst` by `lat`+`lon` (within tolerance) and create only if not found, OR create unconditionally and accept duplicate Location rows per run (idempotent at the campsite level via `nameThSlug` upsert). The simpler path is: upsert the campsite by `nameThSlug`, and on create also create a Location; on update, do not touch Location. This avoids duplicate Location rows on repeat runs.

**Boundary:** this is a Node.js script (ESM), not an API route. It imports `@prisma/client` directly (no server boundary). It must be run with staging `DATABASE_URL` set (`.env.staging` or Vercel env export). It MUST NOT be callable from the browser or from a production API route.

---

## Baseline capture procedure (AC-3)

Run AFTER the loader has populated 128 camps on the real staging URL (`campvibe-staging.vercel.app`). Every number must be real; no fabrication (`.claude/rules/performance.md` metric honesty).

### Steps

1. **Bundle size (first-load JS)**
   - `ANALYZE=1 npm run build` locally (or on a branch build).
   - Record: first-load JS for `/` and `/camps/[slug]` from `@next/bundle-analyzer` output.

2. **Lighthouse (synthetic CWV)**
   - Run Lighthouse mobile ×3 on `campvibe-staging.vercel.app/` and one camp detail page.
   - Take the median LCP/INP/CLS/TTFB from the 3 runs.
   - Tool: Lighthouse CLI (`npx lighthouse <url> --preset=perf --output=json --throttling-method=devtools`).

3. **Prisma query log (query timing)**
   - Enable `PRISMA_QUERY_LOG=1` on Vercel staging env for the capture window.
   - Make 3–5 requests to the listing page and a detail page; extract `prisma_query` log lines from the Vercel log dashboard.
   - Record: min/median/max `durationMs` per `model`.
   - Run `EXPLAIN ANALYZE` on the listing query (the primary Prisma query for `CampSite.findMany`) via `psql` or a DB client against the staging DB.

4. **Web-vitals field samples**
   - With `PRISMA_QUERY_LOG=1` still enabled and after a few real page loads, extract `cwv_vital` log lines from Vercel logs.
   - Record: LCP/INP/CLS values + rating per route template.

5. **Record in `baseline.md`** (stored at `docs/delivery/performance-and-freshness/data-layer-performance-and-freshness/CAM-187-meas-1-measure-baseline-cwv-query-bundle/baseline.md`):

```
| Metric               | Before (MEAS-1) | After (CACHE-1) | Tool                         | Date / SHA        |
|----------------------|-----------------|-----------------|------------------------------|-------------------|
| LCP / (home)         |                 |                 | Lighthouse mobile p50 of ×3  | 2026-xx-xx / SHA  |
| INP / (home)         |                 |                 | Lighthouse mobile p50 of ×3  |                   |
| CLS / (home)         |                 |                 | Lighthouse mobile p50 of ×3  |                   |
| LCP / (camp detail)  |                 |                 | Lighthouse mobile p50 of ×3  |                   |
| First-load JS (home) |                 |                 | @next/bundle-analyzer        |                   |
| Listing query p50    |                 |                 | prisma_query log / EXPLAIN   |                   |
| Detail query p50     |                 |                 | prisma_query log             |                   |
```

"After" cells are left empty until CACHE-1 (or whichever optimization story runs next). Every "Before" cell must be a real measured number; leave it blank if not yet captured rather than fabricating.

---

## Atomic story split

MEAS-1 is borderline for a single PR at ~400 lines. Proposed split:

| Sub-story | Content | Depends on | Pure-code or needs staging DB |
|---|---|---|---|
| **MEAS-1a** | `components/vitals-reporter.tsx` + `app/api/vitals/route.ts` + `lib/validations/vitals.ts` + mount in `layout.tsx` + `api-schema.json` update | nothing | pure-code (CI passes without staging) |
| **MEAS-1b** | `lib/prisma.ts` query-log gate (`PRISMA_QUERY_LOG`) + `lib/route-timing.ts` + applied to catalog handlers | MEAS-1a merged | pure-code (gated; no staging needed to merge) |
| **MEAS-1c** | `next.config.ts` bundle analyzer + `@next/bundle-analyzer` dev-dep | MEAS-1a merged | pure-code |
| **MEAS-1d** | `scripts/load-mock-staging.mjs` + `npm run db:load:staging` | MEAS-1b merged (needs query-log to verify) | needs staging DB to verify AC-2 |
| **MEAS-1e** | Baseline capture: run loader, run Lighthouse ×3, extract logs, fill `baseline.md` table | MEAS-1d done on staging | staging DB required (AC-3 verification step, not a code PR) |

MEAS-1e is not a code PR — it is the manual staging verification step that closes AC-3 and moves the story to Done.

Dependencies order: 1a → (1b + 1c in parallel) → 1d → 1e.

Each of 1a–1d is ≤ ~200 lines (well within the ≤400 limit).

---

## Migration impact

No Prisma migration. Schema diff: none.

Reversibility: fully reversible. All additions are either new files (delete to revert) or gated behind env vars (`PRISMA_QUERY_LOG`, `ANALYZE`). No existing table is touched.

Staging DB safety: the loader uses upsert — it does not call `deleteMany` on any table. Existing staging data (other test accounts, approved KYC records, etc.) is preserved.

---

## Security notes

- `/api/vitals` accepts no PII. Rate-limited. Returns no data. IP used only for rate-limit key; never logged.
- `routeTemplate` strips dynamic path segments before sending — the browser must not send a raw slug or ID to the endpoint.
- `PRISMA_QUERY_LOG=1` must not be enabled in production. `e.params` is never logged (contains query parameter values that may include Financial/PII data).
- `load-mock-staging.mjs` is a Node script, not an API route; it cannot be called from the browser. It runs only against staging DB (never prod). Bcrypt 12 rounds for host passwords.
- `@next/bundle-analyzer` is a devDependency only; `ANALYZE` env var is never set in Vercel production builds.
- No secrets are added to this story. `VERCEL_GIT_COMMIT_SHA` is a public build-time env var (not a secret).

Rules that apply: `.claude/rules/observability.md` (structured log, no PII, allowlist fields) · `.claude/rules/security.md` (no params in logs, seed-route guard, no secret in client bundle) · `.claude/rules/api.md` (zod boundary, error shape, rate limit) · `.claude/rules/performance.md` (metric honesty: every number must be real).

---

## Open trade-off for owner to decide at G2

**Trade-off T-1: Vitals log retention window**

Vercel Hobby/Pro retains logs for 30 days. If the optimization sprint (MEAS-1 → CACHE-1 → PERF-*) spans more than 30 days, the baseline log lines may expire before the "After" numbers are captured.

Options:
- (a) Accept 30 days — sufficient for a sprint cadence. If it expires, re-run the baseline capture (MEAS-1e is idempotent). No cost.
- (b) Export logs to a free-tier external drain (Axiom free: 0.5 GB/day retained 30 days; Logflare: free tier) — adds a Vercel log drain integration, zero code change, ~30 min setup.
- (c) Add the `WebVital` Prisma model as a follow-on story when a durable store is needed.

**Owner must choose.** Default (if no answer): option (a) — accept 30-day window; re-capture if it expires. No cost, no additional work for MEAS-1.

**Impact of each path:** (a) zero cost, risk of re-capture; (b) ~30 min setup, free-tier, persistent; (c) adds a migration + story, highest durability. None block MEAS-1 from proceeding.

---

## Links

`../../feature.md` (## Architecture overview) · `../epic.md` · `story.md` · `prisma/schema.prisma` · `schema/api-schema.json` · `docs/adr/ADR-007` (this ADR, vitals storage decision)

## Changelog
- v1 (2026-06-26) — G2 technical design created

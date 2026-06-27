# API Security Reference — CampVibe

> **As-built security posture of every API route + the cross-cutting security model.**
> Reference data for the project — read alongside `.claude/rules/security.md` (the *standard*) and `.claude/rules/api.md` (the *contract*). This file documents *what is actually enforced* per endpoint.
>
> **Last audited:** 2026-06-27 (security agents, read-only, against `staging`). **Routes covered:** 38.
> **Maintenance:** re-run the audit (or update the relevant row) whenever a route's auth/validation/rate-limit changes. Each gap cites `file.ts:line` so it can be verified or fixed.

---

## 1. Security Model (cross-cutting)

### 1.1 Middleware, CSP & headers — `middleware.ts`, `next.config.ts`

- **Per-request CSP nonce** (`middleware.ts:63–65`): 16-byte `crypto.getRandomValues` + `btoa` (Edge-safe, no `Buffer`); placed on `x-nonce` for SSR `<script>` stamping.
- **CSP** (`middleware.ts:42–57`, enforced — not Report-Only): `script-src 'nonce-{n}' 'strict-dynamic' 'unsafe-inline' https:` · `style-src 'self' 'unsafe-inline'` · `img-src 'self' data: blob: *.public.blob.vercel-storage.com *.tile.openstreetmap.org` · `connect-src 'self' + OSM` · `object-src 'none'` · `frame-ancestors 'none'` · `base-uri 'self'` · `form-action 'self'` · `upgrade-insecure-requests`.
- **Static headers** (`next.config.ts:53–74`, all routes): `X-Content-Type-Options: nosniff` · `Referrer-Policy: strict-origin-when-cross-origin` · `X-Frame-Options: DENY` · `Permissions-Policy: camera=(), microphone=(), geolocation=()` · `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` · `Cross-Origin-Opener-Policy: same-origin`. Sprites get `Cache-Control: immutable` (`next.config.ts:77–83`).
- **API routes excluded from the middleware matcher** (`middleware.ts:108`) — `/api/*` return JSON, get no CSP (intentional).
- **Route protection** (`middleware.ts:74–86`): NextAuth `auth((req)=>…)` form does **not** auto-invoke `authorized`, so the middleware explicitly calls `isRouteAllowed(pathname, isLoggedIn)` (`lib/auth.config.ts:26`). **Only `/dashboard/*` is gated**; all other pages are public. (CAM-203 lesson: re-verify route protection after any auth/middleware change.)

### 1.2 Authentication & session — NextAuth v5 (`lib/auth.ts`, `lib/auth.config.ts`)

- **Split architecture:** `lib/auth.config.ts` = Edge-safe fragment (no Prisma/bcrypt); `lib/auth.ts` = Node provider + callbacks.
- **Session shape:** `userId` (`token.sub`) + `role` are minted into the JWT at sign-in from the DB and projected onto `session.user` (`lib/auth.ts:107–114`). **Identity/role come from the server JWT, never from a client payload.** `trigger==='update'` refreshes from DB.
- **`authorize` credentials flow** (`lib/auth.ts:28–77`): (1) IP rate-limit 10/15min (`auth:login:<ip>`); (2) zod email+password; (3) Prisma lookup (password hash selected only for compare, never serialized); (4) `bcrypt.compare`.
- **Registration** (`lib/actions.ts`): new users always `role: CAMPER`; bcrypt **cost 12**.

### 1.3 Authorization helpers — `lib/auth-utils.ts`

- **`requireAuth()`** — `auth()` server-side; `401` if no `session.user.id`. Called first by every protected route.
- **`requireCampSitePermission(id, code)`** (`:62–116`) — eval order: platform ADMIN → operator (`operatorId === userId`) → active `CampSiteTeamMember` with effective permission. Used by `campsites/[id]*`.
- **`requireCampSiteOwnership(id)`** (`:32–54`) — compares `campSite.operator.email === session.user.email`; **no ADMIN bypass, no team delegation**. Used by `campgrounds/[id]`. (Divergence noted in §4.)
- **Default-deny** throughout; non-public records return **`404` not `403`** (no existence leak).

### 1.4 Team permission model — `lib/team-permissions.ts`

- **`TeamRole`** = `OWNER | ADMIN | MANAGER | STAFF | VIEWER`. **13 `PermissionCode`s** (`CAMPSITE_*`, `BOOKING_*`, `TEAM_*`, `ANALYTICS_VIEW`, `FINANCIAL_VIEW`).
- **`getEffectivePermissions`**: empty `permissions[]` → role defaults; non-empty → overrides role; unknown codes filtered out (server-computed, DB-sourced).
- **Level 1 (manage the team — invite/update/remove): owner-only today** (`operatorId === userId`); the `TEAM_*` codes exist but aren't yet checked ("only owner for now").
- **Level 2 (what a member can do): `BOOKING_VIEW/UPDATE`, `CAMPSITE_UPDATE/DELETE`, `FINANCIAL_VIEW`** enforced in `operator/*` + `bookings/[id]`.

### 1.5 Rate limiting — `lib/rate-limit.ts`

- In-process sliding-window (`Map<string, number[]>`); returns 429 + `Retry-After`. **Documented limitation:** per-instance — resets on cold start, **not shared across serverless instances** = best-effort vs a single warm instance, not distributed abuse. Shared store deferred (CAM-210 decision: no Upstash; reuse Postgres or Vercel Firewall at launch).
- **Keys in use:** `auth:login:<ip>` (10/15m) · `booking:create:<userId>` (20/m) · `review:create:<userId>` (5/h) · `campsite:create:<userId>` (10/h, shared campsites+campgrounds) · `upload:<userId>` (20/15m) · `campgrounds:list:<ip>` (100/15m) · `wishlist:write:<userId>` (100/15m) · `status:{approve,reject}:<ip>` (20/m) · `status:stream:<ip>` (5/m) · `vitals:<ip>` (200/15m).

### 1.6 Seed guard — `lib/seed-guard.ts`

- **`assertSeedAllowed(session)`** (used by `seed`, `bulk-seed`, `scrape-seed` as the first action): (1) `NODE_ENV==='production' && ALLOW_DANGEROUS_SEED!=='1'` → 403; (2) no session → 403; (3) `role!=='ADMIN'` → 403. Env-injectable for testability.

### 1.7 Image optimization — `next.config.ts`

- `images.remotePatterns` = **only** `*.public.blob.vercel-storage.com` (unsplash dropped — CAM-213). `dangerouslyAllowSVG: false`. `qualities:[75]`, trimmed device/image sizes, 31-day cache (bounds denial-of-wallet).

### 1.8 Secrets & env model

- **Secrets (never client-bundled, no `NEXT_PUBLIC_`):** `AUTH_SECRET`/`NEXTAUTH_SECRET`, `LINEAR_WEBHOOK_SECRET`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `TELEGRAM_WEBHOOK_SECRET`, `STATUS_TOKEN`, `GH_DISPATCH_TOKEN`, `LINEAR_API_KEY`, `BLOB_READ_WRITE_TOKEN`, `ALLOW_DANGEROUS_SEED`, `DATABASE_URL`. Separate staging/prod values.
- Only `NEXT_PUBLIC_*` reaches the client bundle; none of the above use it.

### 1.9 Error-handling policy — `lib/api-utils.ts`

- `apiError` surfaces `details` to the client **only for `status < 500`**; on `500` it logs server-side and returns a generic message. Applied consistently. No stack/SQL/secret in any client error.

---

## 2. Endpoint reference (quick table)

Legend — **Auth:** Public / Session / Token / Secret / HMAC / ADMIN. **RL:** rate-limit. ✅ hardened · 🟡 acceptable (gap noted) · 🔵 public read.

| Endpoint | Method | Auth | Authz / ownership | Validation (zod) | RL | Verdict |
|---|---|---|---|---|---|---|
| `/api/campsites` | GET | Public | published-only `where` | `catalogQuerySchema` | — | 🔵 |
| `/api/campsites` | POST | Session | `operatorId=self`; `isVerified` ADMIN-only | `campSiteSchema` | 10/h | ✅ |
| `/api/campsites/[id]` | GET | Lazy | visibility gate, 404 on hidden | url id | — | 🟡 |
| `/api/campsites/[id]` | PUT/DELETE | Session | `requireCampSitePermission` | `campSiteSchema.partial()` | — | 🟡 |
| `/api/campsites/[id]/availability` | GET | Lazy | visibility gate | date presence only | — | 🟡 |
| `/api/campsites/[id]/spots` | GET/POST | Lazy/Session | visibility / `CAMPSITE_UPDATE` | `spotSchema` (campSiteId from url) | — | ✅ |
| `/api/campsites/[id]/spots/[spotId]` | GET/PUT/DELETE | Lazy/Session | perm + `{spotId, campSiteId}` IDOR guard | `spotSchema.partial()` | — | ✅ |
| `/api/campgrounds` | GET | Public | published-only `where` | none at boundary | 100/15m IP | 🟡 |
| `/api/campgrounds` | POST | Session | `operatorId=self`; ADMIN `isVerified` | `campSiteSchema` | 10/h (shared) | ✅ |
| `/api/campgrounds/[id]` | GET | Lazy | visibility gate | url id | — | 🟡 |
| `/api/campgrounds/[id]` | PUT/DELETE | Session | `requireCampSiteOwnership` (email, no ADMIN bypass) | `campSiteSchema.partial()` | — | 🟡 |
| `/api/campgrounds/[id]/availability` | GET | Lazy | visibility gate | date presence only | — | 🟡 |
| `/api/location` | POST | Session | **any authed user** (no role) | **none** | — | 🟡 gap |
| `/api/locations/search` | GET | Public | read-only ref data | none (parameterized `$queryRaw`) | — | 🔵 |
| `/api/reviews` | POST | Session | verified-stay gate; `authorId=self` | `reviewBodySchema` | 5/h | ✅ |
| `/api/wishlist` | GET/POST | Session | scoped `{userId}` | `wishlistBodySchema` (POST) | 100/15m (write) | ✅ |
| `/api/wishlist/[campSiteId]` | DELETE | Session | `deleteMany {userId,campSiteId}` | uuid param | 100/15m | ✅ |
| `/api/wishlist/ids` | GET | Session | scoped `{userId}` | — | — | ✅ |
| `/api/upload` | POST | Session | any authed | MIME allow + 5MB + **magic-byte** | 20/15m | ✅ |
| `/api/bookings` | GET | Session | scoped `{userId}`, cap 100 | — | — | ✅ |
| `/api/bookings` | POST | Session | `userId=self`; serializable tx; server-priced | `bookingSchema` (≤30 nights) | 20/m | ✅ |
| `/api/bookings/[id]` | GET | Session | `getOwnedBooking` (404 no-leak) | url id | — | ✅ |
| `/api/bookings/[id]` | PATCH | Session | camper-cancel / operator / `BOOKING_UPDATE` / ADMIN | `BookingStatusEnum` | — | ✅ |
| `/api/operator/bookings` | GET | Session | owned ∪ `BOOKING_VIEW` sites; 403 else | status/sort coerced | — | ✅ |
| `/api/operator/dashboard` | GET | Session | DB-sourced role; `FINANCIAL_VIEW` gates revenue | limit clamped [1,20] | — | ✅ |
| `/api/auth/[...nextauth]` | GET/POST | Public | auth layer | zod email+pw | 10/15m IP | ✅ |
| `/api/user/profile` | GET/PATCH | Session | scoped `{email}`; pw excluded; no `role` field | `updateProfileSchema` (image allowlist) | — | ✅ |
| `/api/access/dashboard` | GET | Session | DB-sourced role; boolean only | — | — | ✅ |
| `/api/team/invitations` | GET | Session | scoped `{userId}` | — | — | ✅ |
| `/api/team/invitations/[id]` | PATCH | Session | invite-owner check (404/403) | `enum ACCEPT/DECLINE` | — | ✅ |
| `/api/team/members` | GET/POST | Session | **owner-only** (`operatorId===userId`) | `AddMemberSchema` | — | ✅ (PII log gap) |
| `/api/team/members/[id]` | PATCH/DELETE | Session | owner-only; OWNER record guarded | `UpdateMemberSchema` | — | ✅ |
| `/api/status/approve` | POST | Token | token-only | `ID_RE` | 20/m | 🟡 open-fallback |
| `/api/status/reject` | POST | Token | token-only | `ID_RE` + reason ≤2000 | 20/m | 🟡 open-fallback |
| `/api/status/stream` | GET | Token | **token required (no fallback)** | — | 5/m | ✅ |
| `/api/status/pulse` | POST | Token | token-only | — | **none** | 🟡 open-fallback |
| `/api/status/version` | GET | Token | token-only | — | none | 🟡 open-fallback |
| `/api/status/issue/[id]` | GET | Token | token-only | `ID_RE` | none | 🟡 open-fallback |
| `/api/seed` | GET | ADMIN+env | `assertSeedAllowed` | — | — | ✅ (bcrypt 10) |
| `/api/bulk-seed` | POST | ADMIN+env | `assertSeedAllowed` (destructive) | — | — | ✅ |
| `/api/scrape-seed` | POST | ADMIN+env | `assertSeedAllowed`; hardcoded URLs (no SSRF) | — | — | ✅ |
| `/api/vitals` | POST | Public | telemetry | `VitalPayloadSchema` + 2KB cap | 200/15m IP | ✅ |
| `/api/telegram-webhook` | POST | Secret hdr | hard-fail if secret unset | `ID_RE` on callback | none | ✅ (untrusted free-text → dispatch) |
| `/api/linear-webhook` | POST | HMAC | `timingSafeEqual`, hard-fail | typed, no zod | none | ✅ |

---

## 3. Notable per-endpoint detail

The table is the quick reference; the items below carry the security-relevant nuances worth knowing.

### 3.1 Camp / content / media
- **`POST /api/campsites` + `/campgrounds`** — `operatorId` is forced to the session user even though `campSiteSchema` *accepts* an `operatorId` field from the body (silently overridden — safe but misleading). `isVerified` is forced `false` unless `role==='ADMIN'`. Share one rate-limit bucket (`campsite:create:<userId>`).
- **`campsites/[id]` PUT/DELETE** — `requireCampSitePermission` (ADMIN / operator / team-member-with-permission). The final Prisma `update/delete` is keyed on `{ id }` only; ownership is verified in the pre-check (two-step, not a single `where:{id,operatorId}` — see §4 TOCTOU). `(body as any).province` at PUT bypasses zod for the location sub-update (parameterized, low risk).
- **`spots/[spotId]` PUT/DELETE** — two-layer IDOR guard: campsite permission **+** `findFirst({id:spotId, campSiteId:id})` before mutate. Strongest authz pattern in the codebase.
- **`POST /api/location`** — **only `requireAuth`, no role gate, no zod** → any authenticated user can write arbitrary `province/region/lat/lon` rows. Low exploit risk (no PII, parameterized) but allows table pollution. (Gap.)
- **`GET /api/locations/search`** — the `$queryRaw` fallback uses a **tagged template (parameterized), not `$queryRawUnsafe`** → no SQLi. Public, no rate-limit, no length cap on `q`.
- **`POST /api/reviews`** — verified-stay gate (`CONFIRMED` booking scoped to `userId+campSiteId`) + session `authorId` + zod + 5/h. `visitDate` future-date not rejected (minor).
- **`POST /api/upload`** — MIME allow-list + 5MB + **magic-byte signature check before Blob write** (forged MIME rejected, never stored) + filename sanitize + 20/15m. Local-fs fallback is ephemeral on Vercel (operational, not security).

### 3.2 Booking / auth / user / team
- **`POST /api/bookings`** — client `userId` overridden by session; all availability/capacity/pricing computed **server-side inside a Serializable transaction** (retry on P2034); **crystallizes 16 snapshot fields** at creation (ADR-005) so later host edits don't alter old bookings. Strong.
- **`PATCH /api/bookings/[id]`** — 4-tier authz (camper-cancel-only / operator / `BOOKING_UPDATE` team / ADMIN). `(session.user as any).role` cast is functional (role is DB-sourced via JWT). Two-step fetch-then-update (TOCTOU, §4).
- **`operator/dashboard`** — role read from **DB** (`prisma.user.findUnique`), stronger than the session-token cast; `totalRevenue` gated on `FINANCIAL_VIEW`/owner/ADMIN.
- **`auth` / `lib/actions.ts`** — registration bcrypt **cost 12**; login rate-limited; no user-enumeration (same null path for bad email vs bad password). **Open-redirect gap:** `authenticate()` takes `redirectTo` from FormData and passes it to `redirect()` with no same-origin check (`lib/actions.ts:28–29`). (Gap — §4.)
- **`user/profile` PATCH** — field allow-list (no mass-assignment); `image` validated against an allow-list (`https?://` or `/uploads/...`, rejects `..`/`javascript:`); **`role` not updatable** (no self-elevation).
- **`team/members`** — owner-only management; **OWNER role cannot be assigned via API** (enum excludes it) and the owner record is guarded against role-change/removal. `permissions[]` is stored without write-time validation (filtered on read — harmless). **PII log gap:** `console.log` emits `session.user.email` to server logs on GET (`team/members/route.ts:31–33`) + uses emoji (against house style).

### 3.3 Platform / ops / webhooks
- **Status routes** — `stream` correctly **hard-fails when `STATUS_TOKEN` is unset**; `approve`/`reject`/`pulse`/`version`/`issue/[id]` keep an **open-fallback** (`if(!required) return true`) → publicly callable if the env var is missing. On staging/prod `STATUS_TOKEN` is set (mitigated by config), but the code-level inconsistency is a gap. `pulse`/`version`/`issue` also have **no rate-limit**.
- **`seed`/`bulk-seed`/`scrape-seed`** — all gated by `assertSeedAllowed` (env + ADMIN). `scrape-seed` fetches **hardcoded** URLs (not client-supplied) → **not SSRF**; fs writes are ephemeral on Vercel. `seed` creates an operator with bcrypt **cost 10** (seed-only, below the ≥12 standard).
- **`vitals`** — real byte-length body cap (2KB), zod, 200/15m, **IP used only as RL key, never logged**, no PII in the schema. Clean public telemetry.
- **`telegram-webhook`** — verifies `x-telegram-bot-api-secret-token` (**hard-fail if secret unset**); free-text reply is forwarded to GitHub `repository_dispatch` as `client_payload` → **untrusted LLM/agent input the receiving Action must treat as such**. No rate-limit, no try/catch on external calls.
- **`linear-webhook`** — **HMAC-SHA256 over the raw body** (read before parse) with **`crypto.timingSafeEqual`**, hard-fail on missing secret/sig. Correct pattern. No body cap.

---

## 4. Known gaps & hardening backlog (factual, from the 2026-06-27 audit)

None are Critical. Ranked roughly by attention:

| # | Gap | Where | Severity | Note |
|---|---|---|---|---|
| 1 | **Open redirect** — `redirectTo` from FormData → `redirect()` with no same-origin check | `lib/actions.ts:28–29` | Medium | CWE-601; an attacker can craft a login link that bounces to an external site post-auth. Allow-list to same-origin paths. |
| 2 | **Status routes open-fallback** when `STATUS_TOKEN` unset (approve/reject/pulse/version/issue) | `app/api/status/*` | Medium (config-mitigated) | Env var IS set on staging/prod, so currently closed; align these with `stream` (hard-fail) so a missing env var can't open them. |
| 3 | **`POST /api/location`** no role gate + no zod | `app/api/location/route.ts:5` | Low | Any authed user can pollute the Location table. Add zod + restrict to operator/admin. |
| 4 | **PII in server logs** — `console.log(session.user.email)` + emoji | `app/api/team/members/route.ts:31–33` | Low | Server-side only (no client exposure) but violates observability field-hygiene + no-emoji standard. Remove. |
| 5 | **In-process rate-limiter** is per-instance (not shared) | `lib/rate-limit.ts` | Low (by decision) | Best-effort only; CAM-210 deferred the shared store (no Upstash) to pre-launch. |
| 6 | **TOCTOU** two-step fetch-then-`update where:{id}` (ownership pre-verified, not atomic) | `bookings/[id]`, `team/invitations/[id]`, `team/members/[id]` | Low | No privilege escalation (authz checked on pre-fetch); not atomic under high concurrency. |
| 7 | **`requireCampSiteOwnership` divergence** — email-based, no ADMIN bypass / no team delegation (vs `requireCampSitePermission`) | `lib/auth-utils.ts:32–54` (used by `campgrounds/[id]`) | Low | ADMIN can't delete a campground via that route; team members can't update. Functional, not a breach. Consider unifying on `requireCampSitePermission`. |
| 8 | **bcrypt cost 10** in seed-created accounts (standard ≥12) | `app/api/seed/route.ts:21` | Low | Seed-only, ADMIN+env gated; not user-facing registration (which uses 12). |
| 9 | **`npm audit`**: 3 moderate (postcss via next/next-auth chain), **0 high/critical** | toolchain | Low | Fix needs a breaking Next downgrade; build-time path, not a user-data path. Track upstream. |
| 10 | Public reads have **no rate-limit** (`campsites` GET, `campsites/[id]*`, `locations/search`) | various | Low | On Hobby the platform caps; revisit with WAF at Pro. |

> **Confirmed-good (no gap):** seed/scrape ADMIN+env guard · webhook signature verification (Telegram secret + Linear HMAC timing-safe) · security headers + nonce CSP · no-existence-leak 404s · server-authoritative pricing + booking snapshot · upload magic-byte · `user/profile` no-role-self-elevation · `$queryRaw` parameterized.

---

## 5. Cross-references

- `.claude/rules/security.md` — the security **standard** (6-area audit, STRIDE, OWASP rules) every story is graded against.
- `.claude/rules/api.md` — the per-endpoint **contract** checklist (validate → authz → query → shape → errors).
- `docs/delivery/LESSONS.md` — promoted security lessons (CAM-202/203/208/209/211/213).
- Epic **CAM-208** (Trust, Security & Platform) — the abuse/cost-hardening work that established most of the rate-limits + the self-host image posture.

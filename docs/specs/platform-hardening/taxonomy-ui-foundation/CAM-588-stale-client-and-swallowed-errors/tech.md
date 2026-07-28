---
linear: CAM-588
feature: Platform hardening
epic: taxonomy-ui-foundation
persona: PLATFORM
artifact: tech
owner: backend
status: draft
version: v1
updated: 2026-07-28
---
# Tech — Stale client while running + swallowed DB error on the camp detail page (CAM-588)

## Data model
No `prisma/schema.prisma` / `prisma/migrations/**` change. No new tables/fields.

## Defect #1 — a running dev server notices its client went stale

**Mechanism.** `scripts/verify-prisma-client-fresh.mjs` (CAM-579) proves freshness by comparing a normalized hash of `prisma/schema.prisma` against the schema copy `prisma generate` embeds in its own output — a **disk-vs-disk** comparison. That comparison is not useful for a process that is *already running*: after a migration lands and `prisma generate` re-runs, the two on-disk files match again, yet the Node process that started earlier still holds the OLD generated client in its module cache (Next.js does not hot-reload a generated client). Disk-vs-disk always "self-heals" to OK the moment someone regenerates — which is exactly why the real incident was confusing.

The fix instead compares **disk-vs-a-point-in-time snapshot**: `scripts/dev-with-prisma-watch.mjs` hashes `prisma/schema.prisma` (+ `prisma/delivery/schema.prisma` if present) once, at the moment it starts (the same instant `predev`'s existing disk-vs-disk check has just confirmed the generated client is fresh — so this snapshot IS the state the client-in-memory was generated against). It then watches `prisma/schema.prisma` and `prisma/migrations/` (`fs.watch`, recursive where supported) for the lifetime of the dev server. On any change, after a 300ms debounce, it re-hashes and compares against the frozen baseline (not against the embedded-client copy) — a divergence means the in-memory client is now provably stale, *regardless* of whether the files on disk have since been re-synced. It prints one loud, unmissable banner naming the changed path and telling the developer to restart; it does **not** kill or auto-restart the process (out of scope — see `story.md`).

`scripts/verify-prisma-client-fresh.mjs` is refactored (additive only) to export its `normalize`/`hash` helpers as named exports, guarded so the file's existing CLI behavior (exit 1 with the STOP block, used by `predev`/`pretypecheck`/`pretest`) is unchanged when run directly — the guard is `import.meta.url === pathToFileURL(process.argv[1]).href`. The watcher imports only `normalize`/`hash`; it does not duplicate the hashing logic.

**Wiring.** `package.json`'s `dev` script changes from `"next dev"` to `"node scripts/dev-with-prisma-watch.mjs"`, which spawns the real `next dev` binary (resolved via `require.resolve('next/dist/bin/next')` through `createRequire`, not a shell `.bin` symlink, for portability) with `stdio: 'inherit'` (preserves the interactive TTY — keypress shortcuts, colors — exactly as running `next dev` directly) and forwards any extra CLI args. `predev` is untouched and still fires automatically (npm's pre-hook convention matches on the script *name*, not its contents) before the wrapper starts. Signals (`SIGINT`/`SIGTERM`) are forwarded to the child explicitly and the parent exits with the child's code/signal, so `Ctrl+C` behaves identically to today.

**Dev-only guarantee.** The script's first action is `if (process.env.NODE_ENV === 'production') process.exit(1)` (defense-in-depth; nothing on the production path ever invokes this file — `build`/`vercel-build`/`start` call `next build`/`next start` directly, never this script). No watcher and no per-request check is added anywhere in `app/**`/`lib/**`.

## Defect #2 — a database error is no longer a 404

**Contract.** `app/campgrounds/[slug]/page.tsx`'s `getCampBySlug` call keeps its `try`, but the `catch` no longer calls `notFound()`. It logs one structured, allowlisted line (`event: "camp_detail_load_failed"`, `slug`, `message` — the Prisma error's own `.message`, never a raw stack, never a connection string) to the server log, then re-throws the original error. The re-thrown error is *not* caught anywhere else in the page, so it propagates through the Server Component render and is picked up by Next.js's nearest error boundary — `app/error.tsx` (root, already exists, already "use client", already renders `ErrorState variant="error"` with the generic Thai copy `เกิดข้อผิดพลาด` / `มีข้อผิดพลาดที่ไม่คาดคิดเกิดขึ้น...` and never `error.message`/stack to the client). No new error page, no new copy — this story only stops the earlier misroute to `notFound()`.

`if (!campSite) notFound();` (genuine "no such slug") and the SEC-1 gate (`if (!canViewCampSite(campSite, session)) notFound();`) are **unmodified** — both still call `notFound()` exactly as before. SEC-1 in particular must keep returning an *identical* 404 to the "genuinely doesn't exist" case (anti-enumeration); this story does not touch `canViewCampSite` or its call site.

**Why this satisfies the security line (`.claude/rules/security.md`).** The distinction is: loud-on-the-server (structured `console.error` line with slug + message, server log only) vs. safe-to-the-user (the *existing* generic `ErrorState variant="error"` copy, which `app/error.tsx` already guarantees never surfaces `error.message`/stack — enforced there before this story, unchanged by it). Nothing new is exposed to the client; a database error simply stops being *disguised* as a 404.

## API contract
No route/endpoint changes. `getCampBySlug` (`lib/catalog-cache.ts`) is unchanged — it already lets a thrown Prisma error propagate (no try/catch inside the cache wrapper); the swallow lived entirely in the page, one call site.

## ADRs
None — this is a bug fix to existing control flow + a dev-tooling addition, not a new architectural decision.
Confirmation: `__tests__/cam-588-*.test.ts` asserts (a) a thrown `getCampBySlug` error propagates rather than resolving to the not-found sentinel, (b) `campSite === null` still resolves to the not-found sentinel, (c) SEC-1 (`canViewCampSite` false) still resolves to the not-found sentinel, (d) the watcher's drift function returns "stale" only when the current hash differs from the frozen baseline, and returns "fresh" for a normalized no-op change.

## Links
`docs/specs/platform-hardening/taxonomy-ui-foundation/CAM-579-worktree-isolation/story.md` (the process-START guard this extends) · `scripts/verify-prisma-client-fresh.mjs` · `app/error.tsx` · `app/not-found.tsx` · `story.md`

## Changelog
- v1 (2026-07-28) — created

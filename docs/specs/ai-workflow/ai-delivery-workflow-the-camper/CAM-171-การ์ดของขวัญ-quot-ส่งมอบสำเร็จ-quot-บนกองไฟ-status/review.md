---
artifact: review
ticket: CAM-171
title: 'การ์ดของขวัญ "ส่งมอบสำเร็จ" บนกองไฟ (/status/map)'
version: 1
date: 2026-06-25
status: In Progress
reviewer: Security (The Camper)
verdict: PASS
---

# Security Review — CAM-171

## Verdict: PASS

No Critical findings. Zero new API routes, zero DB access, zero network calls. All data rendered via React text nodes (no XSS sink). localStorage stores opaque story ids only. npm audit: 0 high/critical.

---

## 6-Area Audit

| # | Area | Finding | Severity |
|---|---|---|---|
| 1 | Input / Injection | No user input crosses a trust boundary. `DELIVERY_GIFT_CSS` is a compile-time static template literal — the only `${}` interpolation is `${count}` (an integer: `unseen.length`), never a user-supplied value. No raw SQL (n/a — no DB layer). No zod needed (no boundary input). | Info — clean |
| 2 | Auth / Authz | Pure client-side, read-only, view-only feature. No API route added. No session, no mutation, no privilege level involved. The component only reads from the `epics` prop already passed to the map scene (data already visible on the delivery board). Default-deny n/a (no protected action). | Info — n/a |
| 3 | Data / Information Disclosure | localStorage key `cv-map-delivery-seen` stores **opaque story ids only** (e.g. `["CAM-123", "CAM-124"]`). No secret, no PII, no token, no email, no `authorId`. The modal surface fields are `id`, `title`, `epic` (label string), and `completedAt` — all from `MapEpicStory`, which contains no PII. No new field is exposed vs what the delivery board already renders publicly. All modal content rendered as React text nodes (`{item.title}`, `{item.epic}`, `{COPY.dateLabel}`) — no `dangerouslySetInnerHTML` on user data. | Info — clean |
| 4 | Infra / Config | `DELIVERY_GIFT_CSS` is concatenated into the existing pre-existing `<style dangerouslySetInnerHTML>` scene block (same pattern as `SCENE_CSS` + `HUD_CSS`). The CSS string is a static module-level constant — no runtime input is interpolated into it. No new security header changes. Seed/scrape/bulk-seed routes unchanged; `assertSeedAllowed` guard confirmed in place (blocks production unless `ALLOW_DANGEROUS_SEED=1`, requires session + ADMIN role). | Info — clean |
| 5 | 3rd-party / Deps | `npm audit --omit=dev` result: **0 high, 0 critical** (3 moderate in `postcss` via `next`/`next-auth` — pre-existing, not introduced by this story, no fix available without a breaking Next.js downgrade). No new npm dependency added by this story. | Info — 0 high/critical |
| 6 | AI / LLM | Not applicable — this story adds no LLM call, prompt, agent action, or AI integration. | N/A |

---

## STRIDE Analysis

| Threat | Surface in diff | Assessment |
|---|---|---|
| Spoofing | n/a — no auth surface | Not applicable |
| Tampering | localStorage `cv-map-delivery-seen` is client-writable | Acceptable: the data only controls which ids are shown as "unseen" (cosmetic indicator). A user modifying their own localStorage can only cause their own badge to show/hide. No server mutation, no privilege escalation. |
| Repudiation | No server-side event emitted | Acceptable: this is a purely cosmetic client state (view-once indicator). No action of record occurs. |
| Information Disclosure | Modal renders story title + epic label + completedAt | Confirmed: these fields are already public on the delivery board rendered on the same page. No new field exposed. No PII, no secrets. |
| Denial of Service | Unbounded `unseen` array / badge cap | Badge capped at `9+`. `selectDeliveries` iterates the already-loaded `epics` prop — no unbounded network call. SSR guards prevent localStorage throw from breaking the page. |
| Elevation of Privilege | No API call, no mutation, no role check needed | Not applicable. |

---

## Specific Checks

### Information Disclosure (localStorage)
- Key: `cv-map-delivery-seen`
- Value written: JSON array of story id strings — opaque identifiers (e.g. `["s_abc123"]`), no PII, no tokens.
- Read path: `readSeenIds()` — SSR-safe (`typeof window` guard), no-throw `try/catch`, malformed JSON falls back to empty `Set`.
- Conclusion: **clean**.

### XSS — Modal rendering
- `item.title` → `<div className="delivery-story-title">{item.title}</div>` — React text node, HTML-escaped by React.
- `item.epic` → `<span>{COPY.epicLabel}: {item.epic}</span>` — React text node.
- `formatThaiDate(item.completedAt)` → `toLocaleDateString()` output used as React text node.
- `COPY.*` constants → hardcoded Thai/English strings, no user input.
- **No `dangerouslySetInnerHTML` on any user-derived value.**
- Conclusion: **no XSS surface**.

### CSS injection via `dangerouslySetInnerHTML`
- `DELIVERY_GIFT_CSS` is a module-level `const` template literal with zero runtime interpolation.
- The single `${}` (`${count}`) in the file is inside the `COPY.indicatorLabel` function — used as an `aria-label` prop value (React attribute, not injected into the style block).
- Conclusion: **static CSS, no injection vector**.

### No new attack surface
- No new `app/api/` route.
- No Prisma/DB access.
- No `fetch`/`axios`/`XMLHttpRequest` call.
- No new npm dependency.
- Conclusion: **zero new attack surface**.

### Seed/scrape routes (pre-release check)
- `app/api/seed`, `app/api/bulk-seed`, `app/api/scrape-seed` all import `assertSeedAllowed` from `lib/seed-guard.ts`.
- Guard blocks in `NODE_ENV === 'production'` unless `ALLOW_DANGEROUS_SEED=1` is explicitly set, and additionally requires a valid session with ADMIN role.
- **Confirmed guarded for this release.**

---

## npm audit

```
npm audit --omit=dev (run: 2026-06-25)

postcss <8.5.10 — Severity: moderate (XSS via unescaped </style> in stringify output)
  └─ next (9.3.4-canary.0 – 16.3.0-canary.5) → next-auth (<=0.0.0-pr.11562.ed0fce23 || >=4.11.0)

3 moderate severity vulnerabilities — 0 high — 0 critical
Fix requires npm audit fix --force (would downgrade Next.js to 9.3.3 — breaking change, not acceptable)
```

Result: **0 high, 0 critical.** The 3 moderate findings are pre-existing (not introduced by this story) and have no actionable non-breaking fix at this time.

---

## Secret Scan

Grep across all new/modified files in scope:
- `lib/map-delivery.ts` — no secrets, no tokens, no env references.
- `app/status/map/delivery-gift.tsx` — no secrets, no tokens, no `process.env`, no `NEXT_PUBLIC_*` with sensitive values.
- `locales/translations.json` additions — UI copy strings only.
- `app/status/map/campsite-scene.tsx` changes — import line + CSS concatenation + component mount only.

Result: **no secrets or PII in the diff.**

---

## Findings Summary

| Severity | Count | Items |
|---|---|---|
| Critical | 0 | — |
| Important | 0 | — |
| Suggestion | 1 | (Info) The `postcss` moderate advisory is pre-existing. Track for resolution when Next.js ships a non-breaking fix. |
| Info | 5 | All 6 areas reviewed — all clean. |

---

## Next Steps

PASS — may merge into `staging`. No fix required before merge. Handoff to quality-gate / merge.

Pre-G5 (promote staging→prod) re-check:
- Re-confirm `assertSeedAllowed` guard on seed/scrape routes remains in place.
- Re-run `npm audit --omit=dev` — confirm still 0 high/critical.

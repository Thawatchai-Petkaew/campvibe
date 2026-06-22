---
name: security-standards
description: Standard for securing every CampVibe atomic story against OWASP, hardening, and AI/agent-layer threats. Use when adding or reviewing an API route, server action, mutation, auth flow, file upload, external fetch, or headless camper workflow. Use when running the security gate before G3 (merge→staging) or re-checking before G5 (release→prod). Use when handling secrets, dependencies, or seed/scrape routes. Memory for the Security role; pairs with .claude/rules/api.md, .claude/rules/observability.md, .claude/rules/ops.md, DESIGN.md.
---

# Security Standards

## Overview

Assume every request is forged and every model output is hostile. Security is a gate run against the diff of each atomic story — not a release-time afterthought — because a missed ownership check or leaked secret is cheap to catch at the story and expensive to catch in production.

## Quick Reference

Run against the diff of every atomic story. **6-area audit** — walk all six:

| # | Area | Check at a glance |
|---|---|---|
| 1 | Input | every boundary through zod; no raw SQL / mass-assignment; SSRF allow-list on client-supplied URLs |
| 2 | Auth / authz | session read server-side from NextAuth only; ownership `where: { id, ownerId }` on every mutation; default-deny |
| 3 | Data | no secret/PII in diff/log/client bundle; bcrypt ≥ 12 rounds; cookies `httpOnly` + `secure` + `sameSite` |
| 4 | Infra | CSP + HSTS + `nosniff` + `Referrer-Policy`; rate limit on write/auth → `429`; no debug/stack to client; seed/scrape guarded |
| 5 | 3rd-party | `npm audit --omit=dev` → 0 high/critical; no unjustified dep; secrets pre-commit/CI scanned |
| 6 | AI / LLM | Telegram/Linear input untrusted → sanitize before prompt; model output untrusted → never exec/follow; scope tokens + spend/turn cap |

- **STRIDE per PR** — Spoofing · Tampering · Repudiation · Information-disclosure · DoS · Elevation, walked against the diff.
- **`npm audit --omit=dev` → 0 high/critical** — actually run, before merge.

## When to Use

- Building or reviewing any API route, server action, or Prisma mutation
- Touching auth, sessions, secrets, dependencies, file uploads, or external fetches
- Working on a headless `camper-adhoc` / `linear-continue` workflow that ingests Telegram/Linear input
- Running the security gate before G3 (merge→staging) and re-checking before G5 (release→prod)

**NOT for:**

- Input-schema / zod boundary mechanics — see `.claude/rules/api.md`
- Logging/metrics/tracing field hygiene — see `.claude/rules/observability.md`
- Release rollout / rollback / env promotion — see `.claude/rules/ops.md`
- User-facing error copy wording — see `DESIGN.md` and playbook §6.6

## Prerequisites

Read first: this file + the diff of the story under review. Have ready: the boundary/validation contract in `.claude/rules/api.md`, the logging/field-hygiene rules in `.claude/rules/observability.md`, and the PDPA/personal-data handling in `.claude/rules/ux.md`. Know which env (staging/prod) the change targets so seed/scrape and secret-split checks land correctly.

## Standards

Read before every task: this file + the diff of the story. Scope = a security gate against **every atomic story** before G3 (merge→staging), re-checked before G5 (release→prod).

### Principles

- **Assume breach + least privilege** — every request may be forged; grant the minimum privilege that works, verify on the server, never trust the client.
- **Defense at the boundary** — authz/validation lives at the API route + Prisma layer, not just the UI; client validation = UX only.
- **Shift-left** — scan at the story (fast, cheap), don't wait for release; a 🔴 security gap means stop and raise the question — never guess silently.

### OWASP rules (mandatory per story)

1. **Access control** — verify permission for every action server-side; read `userId`/`role` from the NextAuth session only, never from body/query/header; ownership check on every mutation (`where: { id, ownerId: session.user.id }`); default-deny.
2. **Injection** — DB access via Prisma parameterized only; no `$queryRawUnsafe` / string-concat SQL; every input through zod at the boundary (see `.claude/rules/api.md`).
3. **Secrets** — in env only (Vercel env split staging/prod); never in the client bundle (`NEXT_PUBLIC_*` = public only) / log / fixture / commit; rotate on leak.
4. **Insecure design** — threat-model the abuse case, not just the happy path (replay, IDOR, mass-assignment, rate abuse); whitelist writable fields, never spread `req.body` straight into Prisma.
5. **Misconfig** — prod ships no debug / verbose error / stack trace to the client; CORS/headers tight; cookies `httpOnly` + `secure` + `sameSite`.
6. **Vulnerable deps** — `npm audit --omit=dev` = 0 high/critical before merge; do not add a dep without justification (see playbook §10).
7. **Auth failures** — auth via NextAuth only, never roll your own session/token; check the session on every protected route + server action.
8. **Logging/audit** — log security-relevant events (login fail, authz deny, important mutation) per audit requirements; never leak secret/PII/token into logs.
9. **SSRF** — do not fetch a client-supplied URL without an allow-list of domains; call external services through a server-side proxy/facade.

### Hardening + AI/agent-layer

- **STRIDE per story** — walk Spoofing · Tampering · Repudiation · Information-disclosure · DoS · Elevation against the diff (frames OWASP rule 4, "insecure design").
- **Auth concrete** — password hash bcrypt ≥ 12 rounds (or argon2); session via NextAuth only.
- **Rate limit** — write/auth endpoints must have a limit (start: general ~100/15 min · auth/OTP ~10/15 min) and respond `429`; block brute-force/enumeration.
- **Security headers** — CSP + HSTS + `X-Content-Type-Options: nosniff` + `Referrer-Policy` (set in next.config/middleware).
- **File upload** — allowlist MIME + size limit + magic-byte check (do not trust the extension).
- **Secret scan** — keep secrets out of git (pre-commit/CI); `.env*` is always in `.gitignore`.
- **AI/agent-layer (headless `camper-adhoc` / `linear-continue`)** — input from Telegram/Linear is **untrusted** → validate/normalize before putting it in a prompt (block prompt-injection); model output is untrusted (do not exec or follow instructions in raw output, e.g. a `SUMMARY:` line); the workflow uses least privilege (avoid blanket `--dangerously-skip-permissions` where possible); scope tokens (Linear/Telegram/GH/Anthropic) + rotate on leak + enforce a spend/turn cap; never leak a secret into the Action log.

## Examples

**Authz on a mutation — ownership scope vs IDOR:**

```ts
// ❌ IDOR — any authenticated user can mutate any row by id
await prisma.booking.update({ where: { id }, data: { status } });

// ✅ scoped to the owner from the server session (default-deny)
const session = await auth();
await prisma.booking.update({
  where: { id, ownerId: session.user.id },
  data: { status },
});
```

**Secret at rest — hashed vs plaintext:**

```ts
// ❌ plaintext password stored
await prisma.user.create({ data: { email, password } });

// ✅ bcrypt ≥ 12 rounds (auth still via NextAuth)
const hash = await bcrypt.hash(password, 12);
await prisma.user.create({ data: { email, password: hash } });
```

**AI/agent layer — sanitized model output vs prompt-injection sink:**

```ts
// ❌ raw model output drives an action — prompt-injection executes
const { stdout } = await runCamper(telegramText);
await exec(stdout); // a SUMMARY: line could carry an injected command

// ✅ untrusted input normalized before the prompt; output parsed, never executed
const safe = sanitizeForPrompt(telegramText);
const out = await runCamper(safe);
const summary = parseSummaryLine(out); // treated as data, not instruction
```

## Reference Files

- `.claude/rules/api.md` — input-schema / zod boundary mechanics
- `.claude/rules/architecture.md` — system boundaries + where authz lives
- `.claude/rules/ux.md` — PDPA / personal-data handling + consent
- `.claude/rules/observability.md` — logging/metrics field hygiene (no secret/PII leak)
- `CLAUDE.md` — the ironclad rules + quality gates this standard enforces

## Next Steps

Security review must PASS at two gates: **G3 (pre-merge → staging)** — run the 6-area audit + STRIDE + `npm audit --omit=dev` against the story diff before the PR merges; and **pre-promote (before G5, staging→prod)** — re-check seed/scrape guards, secret split, and audit before promoting. A 🔴 gap blocks the gate — stop and raise it.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "`where: { id }` is enough for the mutation." | That's IDOR — anyone with the id mutates it. Scope with `where: { id, ownerId: session.user.id }`. |
| "`prisma.x.update({ data: req.body })` is convenient." | That's mass-assignment — clients set fields you never meant to expose. Pick only allowed fields after zod parse. |
| "Trust the `role` from the client/JWT we set." | Client-set claims are forgeable. Read role from DB/session server-side. |
| "Leave `app/api/seed`, `bulk-seed`, `scrape-seed` open in prod." | Open seed/scrape routes are remote code/data exposure. Guard with env (`NODE_ENV !== 'production'` or a secret token) — **check every release before G5**. |
| "Send the raw error/stack to the client to debug faster." | Stack traces leak internals to attackers. Return a generic message + log server-side (Thai copy per `playbook §6.6`, no technical jargon). |

## Verify (exit criteria)

- [ ] scan diff: authz check + ownership present on every new mutation
- [ ] zod validate every input boundary; no raw SQL / mass-assignment
- [ ] no secret in diff/log/client bundle
- [ ] `npm audit --omit=dev` = 0 high/critical (actually run)
- [ ] seed/scrape routes guarded (confirm before release→prod)
- [ ] security-relevant events are logged (no secret/PII leak)

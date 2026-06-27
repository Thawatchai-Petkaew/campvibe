# ADR-008: Google OAuth login — JWT-only upsert (no adapter), link-by-email

Status: ACCEPTED
Date: 2026-06-27
Supersedes: n/a
Related: CAM-233 (AUTH-G1 discovery), CAM-234 (AUTH-G1 build), docs/design/google-oauth-login.html

---

## Context

CampVibe uses NextAuth v5 with a single `CredentialsProvider` and **JWT sessions** — there is no Prisma adapter, no `Account` table, and no `Session` table. The session strategy is `strategy: "jwt"` (`lib/auth.ts`). `User.password` is already `String?` (nullable) in `prisma/schema.prisma`, so a user without a password is already representable in the schema.

The product goal is "Sign in with Google" to reduce signup friction for new campers. The scope is **login-only**: we do not call any Google API on behalf of the user post-login, so no stored refresh token or OAuth `Account` row is needed.

Two constraints govern the decision:

1. **No unnecessary migration** — the current schema has no `Account`, `Session`, or `VerificationToken` tables. Adding them requires a migration, seeding changes, and session-plumbing changes that are out of scope for login-only.
2. **No breaking change for existing Credentials users** — existing users have a hashed `password`; removing or replacing the `CredentialsProvider` breaks them.

The live auth configuration lives in `lib/auth.ts` and the Edge-safe config split in `lib/auth.config.ts`.

---

## Decision

**Approach A — Add `GoogleProvider`; upsert `User` by email in the `jwt` callback; keep JWT strategy; no Prisma adapter; no new tables; no migration.**

Concretely:

1. Add `GoogleProvider` alongside the existing `CredentialsProvider` in `lib/auth.ts`. Both providers coexist; existing password-login is unaffected.

2. In the `jwt` callback, detect a Google sign-in event (`account?.provider === "google"`). Run an `upsert` on `User` keyed by `email`:
   - **New user** (no existing row at that email): create with `name`, `image` from Google profile, `role: CAMPER`, `password: null`.
   - **Existing user** (email already registered via Credentials): return the existing row as-is — the Google sign-in links to that account. `allowDangerousEmailAccountLinking: true` is set on the provider so NextAuth does not reject the email collision.

3. The JWT payload shape is unchanged: `{ id, email, name, image, role }`. No new claims.

4. Session strategy remains `strategy: "jwt"`. No Prisma adapter is added. No `Account`, `Session`, or `VerificationToken` table is created.

5. `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are added as env vars, split per env (staging/prod) in Vercel, never committed.

6. Redirect URI allowlist at the Google Cloud Console is locked to the staging and production origins. The existing open-redirect guard in the auth middleware (`lib/auth.config.ts`) is reused unchanged.

---

## Alternatives

### Approach B — Prisma adapter + `Account` / `Session` / `VerificationToken` tables

Add `@auth/prisma-adapter`, migrate the schema to add the four NextAuth adapter tables, and let NextAuth manage session + account linking natively.

**Rejected for this story.** We do not call Google APIs post-login (no refresh token needed), so an `Account` row provides no runtime value. The adapter change also requires a schema migration, a seeding update, a session-strategy change from JWT to database sessions (or a hybrid), and re-verification of every protected route. This is significant scope for login-only. Revisit if we later add magic-link / OTP (which genuinely requires `VerificationToken`) or if we need to call Google APIs on behalf of users.

### Reject-not-link (no `allowDangerousEmailAccountLinking`)

If a user who registered with Credentials tries to sign in with Google at the same email, NextAuth returns an `OAuthAccountNotLinked` error by default. This is the safest option from an account-takeover standpoint.

**Rejected for UX.** The error is opaque to the user ("Try signing in with a different account"), gives no recovery path, and breaks the common flow of a user who previously registered by email and now clicks "Sign in with Google". The risk of account takeover is low because Google verifies ownership of the email before issuing the OAuth token. Link-by-email trusts Google's verified email claim — an acceptable trust boundary for this product.

### Google-only (remove `CredentialsProvider`)

Remove password login entirely and make Google the only provider.

**Rejected.** Breaking for every existing user who registered with a password. Not on the roadmap.

---

## Consequences

**Positive:**
- No schema migration, no new tables. Fully reversible: removing the `GoogleProvider` from `lib/auth.ts` returns to the Credentials-only state with no data cleanup required.
- No stored OAuth `Account` row, no refresh token, no Google API surface to secure.
- Session shape (`id / email / name / image / role`) is unchanged — all downstream consumers (`useSession`, server components, API route auth checks) need no update.
- New campers can sign up with one click; existing Credentials users at the same email are linked transparently.
- Credentials provider stays alongside Google — no regression for existing password users.

**Negative / maintenance costs:**
- Link-by-email (`allowDangerousEmailAccountLinking: true`) means a bad actor who controls a Google account at `user@example.com` can link to an existing CampVibe account at the same email. Mitigation: Google verifies email ownership before issuing the token; this is the standard trust model for email-based OAuth linking.
- No `Account` row means we cannot distinguish "this user registered via Google" from "this user registered via Credentials and later linked Google" at the DB level. Acceptable for the current scope; revisit if the product needs provider-level audit.
- Future magic-link / OTP requires `VerificationToken`, which requires revisiting this decision and adding the Prisma adapter (Approach B above). This ADR must be marked SUPERSEDED at that point.
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` must be added to both staging and prod Vercel env configs before the feature goes live. Prod is **HELD** pending privacy-policy update (Google profile data — email, name, avatar — is PII per PDPA; a privacy-policy update is required before prod).

**Migration:**
No schema change. No database migration. No data backfill.
Files changed: `lib/auth.ts` (add `GoogleProvider` + `jwt` upsert logic) + Vercel env vars (staging + prod).
Reversible: yes — remove the `GoogleProvider` from `lib/auth.ts` to return to Credentials-only. No data cleanup required (any User rows created via Google upsert remain valid Credentials-compatible rows).

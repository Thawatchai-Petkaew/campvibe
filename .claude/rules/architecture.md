---
name: architecture-and-data
description: Standard for designing CampVibe's data model (Prisma), API contracts, component boundaries, and ADRs. Use when shaping an entity/field/schema for a story; when designing or reviewing an API contract before it hands to Backend; when a decision is hard to reverse or crosses modules; or when a field name looks UI-shaped. Memory for the Architect role; pairs with CLAUDE.md, .claude/rules/api.md, .claude/rules/security.md, .claude/rules/ux.md, prisma/schema.prisma.
---

# Architecture & Data Modeling

## Overview

Data is atomic and AI-ready or it is rework waiting to happen: store the smallest independently-queryable units, link with IDs, and never stuff several facts into one string. Boundaries stay sharp (the client never knows the DB; business knowledge lives in one service layer), and every model traces back to a ticket/AC — design from the AC, not from imagination.

## When to Use

- Designing a data model, entity, or field for the current story (Prisma + Postgres)
- Designing an API contract before it hands off to Backend (`.claude/rules/api.md`)
- Deciding whether to split a field (Resolution Boundary test)
- Snapshotting/crystallizing values on a transactional document (Order/Booking/Invoice)
- Recording a hard-to-reverse or cross-module decision as an ADR; flagging a trade-off for a human at G2

**NOT for:**

- Writing the implementation or migration yourself — hand to Backend (`.claude/rules/api.md`, `.claude/rules/code.md`)
- Building UI flow / design — hand to Designer (`DESIGN.md`, `.claude/rules/ux.md`)
- Deciding a trade-off on the human's behalf — escalate at **G2** (`CLAUDE.md` gates)

> Read before working: this file + `CLAUDE.md` + `.claude/rules/api.md` (the API contract hands off to Backend). Work that touches a real schema must be diffed against `prisma/schema.prisma`.

## Principles

1. **Data atomic & AI-ready** — store small units that can be queried independently; never pack several facts into one string; link with IDs, do not embed nested. This cuts rework as requirements grow. The full enforced framework is **Atomic Data Framework (Pixel · Set · Buffet)** below.
2. **Sharp boundary** — the client never knows the DB; business knowledge lives in one service layer, so you change it in one place.
3. **Lean > complete** — design only what the current story needs; build no abstraction for an imagined future (premature = debt).
4. **Spec-first** — every data model/contract traces back to a ticket/AC. Design from the AC, not from imagination.

## Standards

### 1. Atomic fields

- ✅ `firstName`, `lastName`, `provinceId`, `postcode`, `amount` + `currency` (Decimal, not float)
- ❌ `fullName`, `price:"฿1,250 incl VAT"`

### 2. Snapshot transactional documents

Order/Booking/Invoice store a snapshot of values that affect legal meaning (price/tax/name as of that moment) **plus the source ID** for trace.

### 3. Relations with FK + index

Link relations by ID (`@relation`); add an index on columns that are queried/filtered often. Use soft-delete `deletedAt` when audit is required.

### 4. Enforced boundary

client → `/api/*` route → service/Prisma only. Never hit the DB directly from the client; business logic does not live in a component.

### 5. API contract (hands off to `.claude/rules/api.md`)

Specify method/path, input + output shape (atomic fields per `types/api.ts`), zod schema at the boundary, authz rule (ownership/role), and error shape — specify all of it so Backend can implement without guessing.

### 6. Migration

Every schema change must be **reversible**; assess data backfill + downtime; test the migration on **Staging** before promoting to prod (3-env: Local → Staging → Prod).

### 7. Short ADR

For important/hard-to-reverse decisions, write `docs/adr/ADR-NNN-<slug>.md` = Context · Decision · Alternatives · Consequences. A trade-off that needs choosing → escalate at **G2**.

### 8. Spec into the ticket

Put the designed data/contract into the `## Data` section (atomic entity/field + migration) of the STORY-TICKET (`ai-planning/templates/STORY-TICKET.md`); validate the template with `node scripts/linear-sync.mjs audit`.

## Atomic Data Framework (Pixel · Set · Buffet)

> Inspiration: the periodic table — data is composed from "atom → molecule → environment", not from one big table shaped to fit a single screen. Goal: every field is designed so an AI agent / other system can read and reuse it without pre-processing.

### 9. The three layers

- **Pixel** = an atomic, typed field that can be queried/filtered/sorted independently — the smallest unit that can no longer be split. Always store at the highest resolution. e.g. `priceAmount:Decimal` + `currency`, `latitude`, `longitude`, `provinceId`, `checkInDate`, `checkOutDate`.
- **Set** = a self-describing entity composed of Pixels + carried metadata, e.g. Camp, Booking, Host, Review — each carries `id` / `version` / `source` / `classification` / `updatedAt`, enough for an agent that has never seen it to understand it without opening external docs. Sets link to each other by **ID**, never by embedded nested JSON.
- **Buffet** = the read/access layer that is **"UI-neutral"** — a service function / API view that composes Pixels into the shape the client uses, without binding the schema to any one screen/report. The **client calls the Buffet, not a raw table array** (the UI is just one consumer, equal to an AI agent).

### 10. Resolution Boundary test

Before deciding whether to split a field further — atomicity is correct because it is "independently queryable", not because it "has sub-structure" — ask 4 questions:

1. Is there a use-case that **queries/filters/sorts** by this part on its own?
2. Does it differ in **unit/meaning** from its neighbors in the same field?
3. Will it be **edited separately** (different ownership/frequency)?
4. Must another system / AI **read it separately** (different classification/access control)?

→ If "yes" to any one = split into a separate Pixel; if "no" to all 4 = collapse into a single free-text Pixel (e.g. `addressDetail`, where nobody filters "floor 12"). But the geo-coded part (`provinceId`, `districtId`, `postcode`) is always split out.

### 11. Typing + classification

Every Pixel must know its **type** + carry a **data-class** tag (PII / Financial / Geo / Public) + sensitivity. No raw, untagged `string`. Link PII → `.claude/rules/security.md` (masking/access) and `.claude/rules/ux.md` (PDPA/consent). CampVibe examples: `nationalId` = PII · `payoutAccountNo` = Financial + PII · `latitude` / `longitude` = Geo · `campName` / `amenityList` = Public.

### 12. Compute-on-the-fly, never cache as the single source of truth

Aggregate values such as `camp.ratingAverage`, `camp.isAvailable(dateRange)`, `host.responseRate` must **always be computable from Pixels** (from the source Review/Booking). You may keep a cache for performance, but it must (a) have a derivation that names which source Pixels it came from, (b) be reproducible from the Buffet at any time, (c) not be the only place that fact lives. If you cannot point to the source Pixel = the design is wrong.

### 13. Crystallization / snapshot for transactions

Extends the "Snapshot transactional documents" rule above. When a Booking transitions into a binding state (`CONFIRMED` / `PAID`) → snapshot **every Pixel whose change would alter legal/financial meaning** onto the Booking as of that moment = `priceAmount` + `currency`, `taxRate` / `vatIncluded`, `campName`, `cancellationPolicy`, the booked date range, **plus the source `campId`** for trace. A price/policy the host edits later must **not affect old Bookings**. Snapshot Pixels stay atomic (not a concatenated string) — prefer a `snapshot…` prefix or a clearly-scoped sub-object. Values not on the document (e.g. the host's current status) = **link only**, query live.

### 14. No UI-shaped columns

Design as if there is no UI. ❌ `profileCardLine2`, `displayPriceText:"฿1,250/คืน"`, a table shaped for one report → ✅ store as Pixels (`priceAmount` + `currency`) and let the Buffet / `Intl.NumberFormat('th-TH',{style:'currency',currency})` compose the text at render time.

### 15. Before-add-field checklist

Pass every item before writing a migration/contract/form:

- Can it be split further → split it
- Does it have a classification (PII/Financial/Geo/Public)?
- Does it have a stated type/unit/enum?
- Does it live in a nameable Set?
- Is it linked by ID, not nesting?
- Is the name UI-neutral?
- Can another AI agent use this field tomorrow without asking a human?

Any single "no" = redesign first.

## ADR Lifecycle + Decision Rigor

### 16. ADR Status lifecycle

ADRs carry a Status lifecycle — `PROPOSED → ACCEPTED → SUPERSEDED/DEPRECATED` + date. A new ADR **references + supersedes** the old one; **never delete** it (keep the history of reasoning). Numbered under `docs/adr/` (Context · Decision · Alternatives · **Consequences**).

### 17. Doubt-driven before high-blast-radius decisions

For a decision that is hard to reverse / crosses modules / cannot be type-checked: do a short adversarial review (summarize the claim → separate artifact → find a counter-reason → reconcile) before acting. No more than ~2–3 rounds, then stop.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "I'll just loop and query each row." | That's an N+1; use `include` / `select` / batch in one go. |
| "One string can hold the whole value." | It can't be queried; split into atomic fields + separate unit (`amount` + `currency`). |
| "Let me add the abstraction now so it's future-proof." | Premature abstraction is debt; design exactly to the current story. |
| "The migration works, I'll skip the Staging test." | An irreversible/untested migration burns prod; make it reversible + test before prod. |
| "It's easier to put this logic in the component/route." | Business logic leaks everywhere; keep it in one service layer. |
| "I'll just pick the trade-off myself." | Silent important trade-offs aren't yours to make; write an ADR + escalate to the human at G2. |
| "Name the column after what the screen shows." | UI-shaped columns (`profileCardLine2`, `displayPriceText`) rot; store a Pixel + compose with Buffet / `Intl.NumberFormat` at render. |
| "The cached `ratingAverage` is good enough as the value." | A cached aggregate that can't derive from source Pixels becomes a lie; compute-on-the-fly, cache is only a cache with a derivation trail. |

## Verify (exit criteria)

- [ ] Data model is atomic, relations use FK + index, snapshots complete for transactional documents
- [ ] Design diffed against the real `prisma/schema.prisma` + migration impact assessed (reversible + testable on Staging)
- [ ] API contract fully specified (path/input/output/zod/authz/error) so Backend can implement without guessing
- [ ] Every field passes the Resolution Boundary test + carries a classification tag (PII/Financial/Geo/Public); aggregates are compute-on-the-fly; client binds to the Buffet, not a raw table
- [ ] No anti-pattern present (N+1, over-engineering, premature abstraction, boundary leak, UI-shaped column, cached-aggregate-as-source)
- [ ] ADR written for hard-to-reverse decisions; trade-off escalated to G2
- [ ] Spec into the ticket's `## Data` + passes `linear-sync.mjs audit`

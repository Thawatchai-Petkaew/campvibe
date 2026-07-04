# ADR-001 — Localized content storage

**Status:** Proposed (G2 pending) — **verified NOT shipped** (2026-07-04 PO audit): `prisma/schema.prisma` still carries `nameTh`/`nameEn` paired columns and no `model Translation` exists, even though the ticket-DB story CAM-102 (S5) shows `Done`. That Done state came from the legacy Linear import (`created — → DONE by import:linear`), not a verified build of this ADR's decision — the multi-region half of S5 (`Country`/`AdminArea`) shipped, the i18n/Translation half did not. Left as Proposed pending an explicit re-scope or re-run of this story; do not treat CAM-102's `Done` state as evidence this ADR shipped. · **Epic:** Atomic Schema (CAM-96) · **Story:** S5 (CAM-102)

## Context
Content is currently stored as paired columns `nameTh`/`nameEn` (CampSite, MasterData, ThailandLocation). The owner wants **real multi-region / multi-language** support now, not just Thai+English. Paired columns are "UI-shaped" — they bake the supported locale set into column names and need a migration + N nullable columns per new language, which `.claude/rules/architecture.md` explicitly names as an anti-pattern ("table ปั้นมาให้พอดีหน้าจอเดียว", "link by ID, not nested JSON").

## Decision
Introduce a generic **`Translation { id, entityType, entityId, field, locale, value, source, createdAt, updatedAt }`** with `@@unique([entityType, entityId, field, locale])` and indexes `@@index([entityType, entityId])` + `@@index([locale, entityType, field])`.
- `locale` is **BCP-47** (`th`, `en`, `zh-Hans`…). Adding a language = inserting rows, **zero schema migration**.
- `entityType`/`field` are **enums** (bounded, AI-readable), not free strings.
- SEO hreflang (`.claude/rules/seo.md`): "which locales exist for entity X" = `SELECT DISTINCT locale` — trivial.
- **Slugs stay separate** as scalar `@unique` routing keys (a `CampSiteSlug{campSiteId, locale, slug}` follow-up), not in Translation.

## Alternatives
- **Paired columns (status quo):** each locale is an independently indexable Pixel, but UI-shaped and caps locale scaling (migration per language). Rejected for a multi-locale product.
- **JSON locale map** (`{"th":…,"en":…}`): fails Resolution-Boundary Q1 — cannot index/`WHERE`/`ORDER BY` a single locale at the DB level; violates "no nested JSON". Rejected.
- **Per-entity translation tables** (`CampSiteTranslation`, …): real FKs + cascade, but table-per-entity sprawl. Viable fallback if the polymorphic-FK trade-off is rejected.

## Consequences
- ✅ Open-locale scaling, locale-atomic SEO/search, conforms to atomic framework.
- ⚠️ **Load-bearing trade-off:** `entityType + entityId` is a **polymorphic (soft) FK** — Prisma cannot enforce referential integrity; cascade-on-delete must be handled in the service layer (or a DB trigger). This is the one place we deliberately relax the "FK + index" rule. **The human must accept this at G2** (else fall back to per-entity translation tables).
- Migration: drop `nameTh`/`nameEn`, seed writes Translation rows (pre-launch → clean reset).

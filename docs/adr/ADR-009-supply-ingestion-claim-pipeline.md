# ADR-009 — Seed intake + owner claim + promote-to-public workflow

**Status:** Proposed · **Epic:** Supply ingestion / owner claim · **Story:** S8

## Context
CampVibe wants to bootstrap campsite supply before every owner self-registers. The current experimental scraper path writes directly into `CampSite`, invents fallback values, and can publish seeded records immediately. That is useful for local demos, but it mixes three very different states:

1. raw upstream discovery (`we found a page/profile`)
2. normalized draft (`we think this is a campsite`)
3. public marketplace listing (`safe to show and book`)

This creates risk in trust, provenance, deduplication, and future owner-claim flows.

## Decision
Introduce a dedicated `discover -> fetch -> normalize -> review -> claim -> promote` pipeline that is separate from public `CampSite` records.

### New lifecycle
1. **Discover**  
   Store upstream pages/profiles in `IngestionSource`.
2. **Normalize**  
   Map one or more sources into a `SeededCampSite` draft. Missing fields remain null.
3. **Review**  
   Admin/manual checks update draft `status`, `sourceConfidence`, `completenessScore`, and `needsManualReview`.
4. **Claim**  
   A host submits a `ClaimRequest` against a seeded draft and proves ownership using phone/email/social/page evidence.
5. **Promote**  
   Only after review/claim do we create or attach a real `CampSite`, setting `SeededCampSite.promotedCampSiteId`.
6. **Publish / Verify**  
   Existing `CampSite.isPublished` and `CampSite.isVerified` rules still govern public visibility and trust badge.

### Data separation
- `IngestionSource` = upstream fetch/provenance record
- `SeededCampSite` = normalized internal draft candidate
- `CampSite` = real public marketplace record

### Media separation
- `SeededImage` stores source-media references for drafts
- public `Image` gallery remains attached only to `CampSite` / `Spot` / `Review`

### Claim separation
- `ClaimRequest` is a workflow record, not a `User -> CampSite` binding
- successful claim is what triggers promotion/assignment into the real public model

## Alternatives

### 1. Scrape directly into `CampSite`
Rejected. It blurs provenance with public truth, makes dedupe harder, and encourages fake completeness defaults.

### 2. Keep ingestion only in JSON files outside the DB
Rejected. Easier short-term, but poor for review tooling, auditability, dedupe, and multi-step claim workflows.

### 3. Use `CampSite.isPublished = false` as the only “draft” state
Rejected. A seeded candidate and a host-owned draft are not the same thing. They need different metadata, provenance, and permissions.

## Consequences
- ✅ Upstream discovery becomes auditable and reversible.
- ✅ We can scrape/import incomplete data without polluting public listings.
- ✅ Owner claim becomes a first-class workflow instead of an ad-hoc admin action.
- ✅ We can support multiple sources per campsite draft before promotion.
- ✅ Future bots can ingest from websites/directories without violating trust rules by auto-publishing.
- ⚠️ Adds new tables and lifecycle complexity.
- ⚠️ Promotion needs explicit application logic to map `SeededCampSite` into `CampSite`.
- ⚠️ Dedupe strategy is still application-level; schema only provides the seam.

## Operational rules
- Missing data stays null; do not invent fallback values just to satisfy draft completeness.
- Social/profile links may be stored as upstream references, but publishing still depends on review/claim.
- `CampSite` remains the only record type that can participate in booking/search/public listing.
- Upstream scraping must respect source policies and provenance capture.

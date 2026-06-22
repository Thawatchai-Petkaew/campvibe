# Supply Ingestion Workflow

This document explains how external campsite data should enter CampVibe after the
database split between `IngestionSource`, `SeededCampSite`, and public `CampSite`.

## Goal
Bootstrap supply safely:
- collect upstream data from websites/directories/social references
- keep incomplete data as drafts
- let owners claim and complete their listing
- avoid publishing scraped data directly

## Pipeline

### 1. Discover
Input:
- source URL
- source type (`WEBSITE`, `DIRECTORY`, `FACEBOOK_PAGE`, `TIKTOK_PROFILE`, etc.)
- optional upstream reference id

Write:
- `IngestionSource`

Rules:
- record provenance first
- do not create public listings here
- keep `robotsAllowed`, `licenseNote`, `rawPayloadPath` if known

### 2. Fetch
Input:
- one `IngestionSource`

Write:
- `fetchStatus`
- `fetchedAt`
- `rawPayloadPath`
- `contentHash`
- `lastError` on failure

Rules:
- keep the raw upstream payload for debugging/re-parsing
- use content hash to avoid reparsing unchanged pages

### 3. Normalize
Input:
- raw payload from one or more sources

Write:
- `SeededCampSite`
- `SeededCampSiteSource`
- `SeededImage`

Rules:
- missing data stays null
- no fake coordinates, fake prices, fake facilities
- map only what is observable with reasonable confidence

## Minimum draft contract
These fields are enough to create a draft:
- `nameTh` or `nameEn`
- at least one source link
- at least one location hint (`province`, `district`, `address`, or coordinates)

## Recommended normalized fields
- identity: `nameTh`, `nameEn`, `slugCandidate`
- content: `description`
- contact: `phone`, `lineId`, `facebookUrl`, `facebookMessageUrl`, `tiktokUrl`
- location: `latitude`, `longitude`, `address`, `province`, `district`, `countryCode`
- commercial: `bookingMethod`, `priceLow`, `priceHigh`, `priceCurrency`, `ownershipType`
- quality: `sourceConfidence`, `completenessScore`, `needsManualReview`

## Review
Admin/operator tooling should be able to:
- compare multiple sources linked to one draft
- reject obvious spam/duplicates
- mark draft as `READY_TO_CLAIM`
- merge duplicate drafts before promotion

## Claim
Owner submits a `ClaimRequest` with proof:
- `PHONE`
- `EMAIL`
- `FACEBOOK_PAGE`
- `TIKTOK_PROFILE`
- `LINE_ID`
- `MANUAL_REVIEW`

Rules:
- claim does not mutate public `CampSite` automatically
- successful claim unlocks promotion

## Promote
Promotion creates or links a real `CampSite` from `SeededCampSite`.

Mapping guidance:
- only promote fields with acceptable confidence
- public media should be copied into `Image`
- preserve `promotedCampSiteId` for traceability

## Publish
Promotion is not the same as publish.

After promotion:
- owner/admin can finish missing fields
- `CampSite.isPublished` controls public visibility
- `CampSite.isVerified` remains platform/admin-controlled

## What not to do
- do not auto-publish scraped records
- do not invent placeholder values just to fill required fields
- do not attach a scraped draft directly to an operator without a claim step
- do not treat social/profile references as proof of ownership by themselves

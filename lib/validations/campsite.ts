import { z } from 'zod';
import { imageInputSchema, imageUrlValue } from './image';
import { latitudeSchema, longitudeSchema } from './location';

/**
 * CAM-619 — per-array caps for the host write path (POST/PUT
 * app/api/campsites*), each bounding a client-controlled array BEFORE it
 * reaches `resolveOptionConnect`'s `code: { in: [...] } }` Prisma query
 * (lib/api-utils.ts) — the exact "cap a client-controlled array length
 * before the query" lesson `.claude/rules/security.md`'s CAM-344 row states,
 * which `lib/ai/tools/compare-camps.ts` (Decision 4) and
 * `lib/validations/ai-chat.ts` already apply to every model-facing array.
 * The MasterData-group bounds are each that group's CURRENT row count in
 * the live DB (verified 2026-07-28 via `prisma.masterData.groupBy`) — the
 * most a host could ever legitimately pick from that group's fixed option
 * list, since no more codes than that exist to pick. Adding a new code to an
 * existing group is a data-only change (no migration — see the campsite-
 * taxonomy-epic memory); bump the matching constant here in that same PR.
 */
export const MAX_ACCESS_TYPES = 4; // 'Access type' group
export const MAX_ACCOMMODATION_TYPES = 5; // 'Accommodation type' group
export const MAX_FACILITIES = 19; // 'Internal facility' group
export const MAX_EXTERNAL_FACILITIES = 4; // 'External facility' group
export const MAX_EQUIPMENT = 11; // 'Equipment for rent' group
export const MAX_ACTIVITIES = 10; // 'Activity' group
export const MAX_TERRAIN = 12; // 'Terrain' group
export const MAX_ANNOTATED_FEATURES = 5; // 'Annotated features' group
export const MAX_CAMPER_STYLE = 4; // 'Camper style' group
export const MAX_STAY_CONNECTED = 3; // 'Stay connected' group
export const MAX_MARKING_METHOD = 2; // 'Marking method' group
export const MAX_DRIVEWAY = 3; // 'Driveway' group

/**
 * CAM-619 — `images`/`tags` are NOT MasterData-backed (images: a media
 * gallery relation; tags: host-typed free-text CSV), so their bound is a
 * real-usage ceiling, not "count of a fixed option list". Live DB check
 * (2026-07-28, 795 published camps): the largest real gallery is 30 images;
 * the most tags on any one camp is 4 (`tagsPlaceholder` in locales shows a
 * 3-tag example). Capped well above both real maxima — closes the
 * unbounded-array surface without constraining any real host.
 */
export const MAX_CAMPSITE_IMAGES = 50;
export const MAX_CAMPSITE_TAGS = 20;

/**
 * CAM-619 — one-time additive fee + camp price-range bound, matching the
 * shared "0-100,000 THB per night" catalog rule (.claude/rules/ux.md §2,
 * `pricePerNight`) that `extraFeeAmount` below already enforces verbatim.
 * `priceLow`/`priceHigh` are the host's per-night MIN/MAX price
 * (`CampgroundForm.tsx`'s "minPrice"/"maxPrice" labels) — the SAME kind of
 * value, just missing the bound until now.
 */
const PRICE_RANGE_ERROR = 'ราคาต้องอยู่ระหว่าง 0–100,000 บาท';

/**
 * CAM-619 BR — priceLow<=priceHigh, kept OUTSIDE the zod object shape (never
 * a top-level `.refine()`/`.superRefine()` on `campSiteSchema` itself) on
 * purpose: `campSiteSchema.partial()` is called by BOTH
 * `app/api/campsites/[id]/route.ts` (PUT) AND `components/CampgroundForm.tsx`
 * (the client-side pre-check, outside this story's allowed file surface) —
 * wrapping the object in a refine turns it into a `ZodEffects` with NO
 * `.partial()` method, which would break both call sites at compile time.
 * `null`/`undefined` on either side always passes (nothing to compare yet).
 *
 * Called from BOTH `POST /api/campsites` (create) and `PUT
 * /api/campsites/[id]` (update) — a persisted `priceLow > priceHigh` is a
 * real defect (the card renders an inverted range) on either write path, not
 * just at creation. History: this WAS briefly scoped to create-only after
 * `e2e/regression/ac1-edit-round-trip.spec.ts` 400'd on a PUT (its
 * `priceLow: "777"` fixture happened to exceed the seeded camp's stored
 * `priceHigh: 600`); the fixture, not the guard, was the actual defect — the
 * spec's own intent ("an edit round-trips") holds for any in-band value, so
 * the fixture was corrected instead (see that spec's own comment). Follow-up
 * (tracked, not built here — see tech.md): `CampgroundForm.tsx` should run
 * this same check client-side before submitting, so a host who edits only
 * one price field never sees a 400 naming the field they didn't touch.
 */
export function isPriceOrderValid(data: { priceLow?: number | null; priceHigh?: number | null }): boolean {
  return data.priceLow == null || data.priceHigh == null || data.priceLow <= data.priceHigh;
}

export const PRICE_ORDER_ERROR = 'ราคาต่ำสุดไม่สามารถมากกว่าราคาสูงสุดได้';

// CAM-527: reconciled down to the 4 codes that actually exist as `Campground type`
// MasterData rows (prisma/seed.ts) — the only codes the host form can ever pick and
// the only codes searchable/displayable via that group. The 3 previously-superset
// members are gone: one had no MasterData row and no i18n key anywhere (would render
// as a raw code); the other two belong to OTHER MasterData groups entirely (Terrain,
// Access type — see AccessTypeEnum just below, which correctly keeps its own member) —
// keeping them here would let a stray campSiteType write render a terrain/access label
// as a site type.
export const CampSiteTypeEnum = z.enum([
  "CAGD", // Campgrounds
  "CACP", // Car Camping
  "GLAMP", // Glamping
  "VIEW", // Scenic view
]);

export const AccessTypeEnum = z.enum([
  "BAOT", // Boat Access
  "DRIV", // Drive-in
  "HIKE", // Hike-in
  "WALK", // Walk-in
]);

// CAM-536: TSIT replaced the old TENT member (`MasterData.code` is a global
// @id, not scoped per group — TENT already belonged to `Equipment for rent`).
// CAM-538: the horse-camp member (HCMP, itself CAM-536's rename of the old
// HORS collision) is DROPPED entirely — a US-origin `AccommodationTypeEnum`
// member inherited from the original v1 spec with no Thai camp relevance.
// The remaining 5 members are the real, self-explanatory set: see
// prisma/seed.ts for the display names + `locales/translations.json`'s
// `filterDescription` for the one-line clarifying hint under each option,
// and `scripts/backfill-cam-538-drop-horse-camp.mjs` for the CSV cleanup on
// existing CampSite.accommodationTypes data.
export const AccommodationTypeEnum = z.enum([
  "CABI", // Cabin
  "DISP", // Dispersed camping (no marked pitch)
  "GROU", // Group
  "RECR", // Recreation
  "TSIT", // Tent site (marked pitch) (CAM-536)
]);

export const BookingMethodEnum = z.enum([
  "ONLI", // Online
  "ONCA", // On Call
  "ONST", // On Site
]);

export const OwnershipTypeEnum = z.enum([
  "PRIVATE", // เอกชน
  "NATIONAL_PARK", // อุทยานแห่งชาติ
]);

// CAM-654 (epic CAM-648, ADR-014): only PER_PERSON/PER_SITE are host-settable.
// PER_TENT exists on the Prisma `PricingUnit` enum (CAM-650) purely so that
// enum stays reversible in one migration (see ADR-014 §1) — no client sends a
// tent count today, so it stays excluded at this boundary. A request carrying
// PER_TENT fails zod validation (400), same as any other unrecognised enum
// value. Shared by both campSiteSchema (below) and spotSchema
// (lib/validations/spot.ts) so the two forms can never drift on which values
// are selectable.
export const PriceUnitEnum = z.enum(["PER_PERSON", "PER_SITE"]);

// PREP-2 (CAM-268): closed cancellation-policy set (ADR-003) — see
// lib/cancellation-policy.ts for the Thai/EN copy per value.
export const CancellationPolicyEnum = z.enum([
  "FLEXIBLE",
  "MODERATE",
  "STRICT",
  "NON_REFUNDABLE",
]);

// CAM-615 (root fix): a Prisma column that is nullable AND user-editable gets
// `.nullable()` here so the host can send an explicit `null` to CLEAR it, not
// just `.optional()` (undefined = key omitted = "skip", by design — see
// app/api/campsites/[id]/route.ts). Measured audit: campSiteSchema carried
// `.nullable()` on exactly 4 fields (extraFeeAmount/extraFeeLabel/
// cancellationPolicy/logo, CAM-341/CAM-360) and bare `.optional()` on every
// other clearable field — this is the third time that exact gap shipped, so
// every remaining clearable field below is widened in this one pass instead
// of per-field as each bug gets reported (that hand-rolling is WHY there was
// a third time). A guard (`scripts/check-clearable-fields.mjs`, report-mode)
// now checks this file + spot.ts against prisma/schema.prisma so a NEW
// nullable column with no `.nullable()` counterpart is caught, not shipped
// silently. Fields deliberately NOT widened (no reachable "clear" action, or
// a different clearing idiom entirely) are documented in that script's
// ALLOWLIST, not left silently bare: tags (array->CSV; clears via an empty
// array + `?? null` at the write site) · groundType (per-key counter object;
// 0 already writes as 0) · ownershipType (two-way toggle UI, no deselect).
export const campSiteSchema = z.object({
  nameTh: z.string().min(1, "Name (TH) is required"),
  nameEn: z.string().optional().nullable(),
  nameThSlug: z.string().min(1, "Slug (TH) is required").optional(),
  nameEnSlug: z.string().min(1, "Slug (EN) is required").optional(),
  description: z.string().optional().nullable(),

  // CAM-520: scalar column, single choice. Required on create; the PUT
  // `.partial()` wrap makes it optional on update (see the two route
  // handlers). No `.default()` — an omitted create must fail loud (EC-1
  // is enforced by the form's create-default, not a silent server default).
  campSiteType: CampSiteTypeEnum,

  // Accepting arrays from frontend, will be joined to CSV for DB.
  // CAM-619: every array below is capped (see the MAX_* constants above) —
  // was uncapped before, the exact "cap a client-controlled array length
  // before the query" gap CAM-344 already closed on the AI input branch.
  accessTypes: z.array(AccessTypeEnum).max(MAX_ACCESS_TYPES).default([]),
  accommodationTypes: z.array(AccommodationTypeEnum).max(MAX_ACCOMMODATION_TYPES).default([]),
  facilities: z.array(z.string()).max(MAX_FACILITIES).default([]), // Internal
  externalFacilities: z.array(z.string()).max(MAX_EXTERNAL_FACILITIES).optional(),
  equipment: z.array(z.string()).max(MAX_EQUIPMENT).optional(),
  activities: z.array(z.string()).max(MAX_ACTIVITIES).optional(),
  terrain: z.array(z.string()).max(MAX_TERRAIN).optional(),
  // CAM-515 (S3) — Annotated features, the FIRST new MasterData group
  // (ALCO/FIRE/FIWD/ADAA/RESV): rules/rights the camp carries, not a
  // physical facility. Same CSV-on-write shape as the taxonomy arrays above.
  annotatedFeatures: z.array(z.string()).max(MAX_ANNOTATED_FEATURES).optional(),
  // CAM-516 (S4) — Camper style, the SECOND new MasterData group
  // (CHIC/GENR/DIFT/IDMT): host-declared vibe/style, not a rule/right. Same
  // CSV-on-write shape as the taxonomy arrays above.
  camperStyle: z.array(z.string()).max(MAX_CAMPER_STYLE).optional(),
  // CAM-521 (S8) — final taxonomy slice, 3 NEW MasterData groups delivered
  // host-input + camper-detail-display ONLY (deliberately NOT searchable —
  // see BR-4, no search-campsites/campsite-filters/catalog wiring). Same
  // CSV-on-write shape as the taxonomy arrays above.
  stayConnected: z.array(z.string()).max(MAX_STAY_CONNECTED).optional(),
  markingMethod: z.array(z.string()).max(MAX_MARKING_METHOD).optional(),
  driveway: z.array(z.string()).max(MAX_DRIVEWAY).optional(),

  // CAM-619: was a bare `z.number()` — no range, no `.finite()` — while the
  // SAME host pin's coordinates were already bounded -90..90/-180..180 on
  // `POST /api/location` (lib/validations/location.ts). CAM-575's
  // `campsite_coords_sync` DB trigger derives `Location.lat/lon` FROM these
  // two fields, so the unguarded write here silently overwrote the guarded
  // one moments later — a bad value (999, Infinity) persisted into distance
  // sorting, province centroids, "ใกล้ X" proximity, the map pin, and the
  // directions link. Shared schema (not a re-derived copy of the bound) —
  // see lib/validations/location.ts's own comment.
  latitude: latitudeSchema,
  longitude: longitudeSchema,

  checkInTime: z.string().min(1),
  checkOutTime: z.string().min(1),
  bookingMethod: BookingMethodEnum,

  // CAM-619: was `z.number().optional().nullable()` — no `.min(0)`, no
  // upper bound, no priceLow<=priceHigh ordering — while `spotSchema
  // .pricePerNight` IS `.min(0)` and `extraFeeAmount` a few lines below is
  // `.min(0).max(100000)`. Bound matches the same "0-100,000 THB per night"
  // catalog rule (.claude/rules/ux.md §2). The priceLow<=priceHigh ordering
  // itself is enforced OUTSIDE this object (see `isPriceOrderValid` above —
  // a top-level `.refine()` here would break `.partial()`, which BOTH route
  // handlers and the client form call).
  priceLow: z.number().finite().min(0, PRICE_RANGE_ERROR).max(100000, PRICE_RANGE_ERROR).optional().nullable(),
  priceHigh: z.number().finite().min(0, PRICE_RANGE_ERROR).max(100000, PRICE_RANGE_ERROR).optional().nullable(),

  // CAM-654: the Prisma column is NOT NULL with @default(PER_SITE) (CAM-650) —
  // like campSiteType/ownershipType, there is no reachable host action that
  // clears it back to "unset", so this stays `.optional()` only (no
  // `.nullable()`; see scripts/check-clearable-fields.mjs's ALLOWLIST-style
  // reasoning for ownershipType above). Absent on the wire = unchanged
  // (PUT's `.partial()`) / DB column default PER_SITE (POST create, when the
  // host form omits it — never happens today since the create form always
  // sends PER_PERSON, see CampgroundForm.tsx).
  priceUnit: PriceUnitEnum.optional(),

  locationId: z.string().uuid(),
  operatorId: z.string().uuid().optional(),

  address: z.string().optional().nullable(),
  directions: z.string().optional().nullable(),
  videoUrl: z.string().url().optional().or(z.literal('')).nullable(),

  // Contact Information
  phone: z.string().optional().nullable(),
  lineId: z.string().optional().nullable(),
  facebookUrl: z.string().url().optional().or(z.literal('')).nullable(),
  facebookMessageUrl: z.string().url().optional().or(z.literal('')).nullable(),
  tiktokUrl: z.string().url().optional().or(z.literal('')).nullable(),

  feeInfo: z.string().optional().nullable(),
  toiletInfo: z.string().optional().nullable(),
  minimumAge: z.number().int().min(0).optional().nullable(),

  // PREP-2 (CAM-268): atomic one-time additive fee + closed cancellation policy.
  // Bound mirrors the existing pricePerNight catalog row (.claude/rules/ux.md §2).
  // CAM-341 clearing fix: all three accept an explicit `null` (in addition to
  // being omittable via .optional()) so a host can clear a previously-set value.
  // undefined = key omitted, skip (partial update untouched) · null = clear the
  // column · a value = set it. Do not conflate undefined and null (PUT relies on
  // this distinction — see app/api/campsites/[id]/route.ts).
  extraFeeAmount: z
    .number()
    .min(0, "ค่าธรรมเนียมต้องอยู่ระหว่าง 0–100,000 บาท")
    .max(100000, "ค่าธรรมเนียมต้องอยู่ระหว่าง 0–100,000 บาท")
    .nullable()
    .optional(),
  extraFeeLabel: z.string().max(100, "ชื่อค่าธรรมเนียมต้องไม่เกิน 100 ตัวอักษร").nullable().optional(),
  cancellationPolicy: CancellationPolicyEnum.nullable().optional(),

  partner: z.string().optional().nullable(),
  nationalPark: z.string().optional().nullable(),
  // CAM-358: root-relative paths (the /api/upload dev-fallback shape + legacy
  // rows already in the DB) are valid alongside an absolute URL — see
  // lib/validations/image.ts `imageUrlValue`. Empty stays valid (no logo set).
  // CAM-360 clearing fix (same class as CAM-341): also accepts an explicit
  // `null` so a host clearing the logo can round-trip to the PUT route and
  // actually clear the column. undefined = key omitted, skip (partial update
  // untouched) · null = clear the column · '' = no logo set · a valid URL =
  // set it. See app/api/campsites/[id]/route.ts.
  logo: imageUrlValue.optional().or(z.literal('')).nullable(),
  // CAM-352: union input — accepts a legacy bare url string OR {url, kind};
  // both normalize to {url, kind} (see lib/validations/image.ts). The shared
  // <ImageUpload> component also feeds the camp gallery, so it must accept
  // the same shape the widened imageCreateNested/imageReplaceNested persist.
  // CAM-619: capped at MAX_CAMPSITE_IMAGES (was fully uncapped).
  images: z.array(imageInputSchema).max(MAX_CAMPSITE_IMAGES).optional(),
  // CAM-615: tags stays `.optional()` (no `.nullable()`) on purpose — it is an
  // array serialized to CSV on write (see arrayToCsv in lib/api-utils.ts), so
  // "clear all tags" is expressed by sending an empty array, not `null`. The
  // bug fixed here lived in the WRITE SITE instead: `arrayToCsv([])` returns
  // `undefined`, which the old `tags: arrayToCsv(data.tags)` mapping let
  // Prisma treat as "skip" — an intentional "remove every tag" silently
  // no-op'd. The route now writes `arrayToCsv(data.tags) ?? null`. See
  // scripts/check-clearable-fields.mjs's ALLOWLIST for why this (and
  // groundType/ownershipType below) are excluded from the `.nullable()` guard.
  // CAM-619: capped at MAX_CAMPSITE_TAGS (was fully uncapped).
  tags: z.array(z.string()).max(MAX_CAMPSITE_TAGS).optional(),

  // Status fields
  isVerified: z.boolean().optional(),
  isActive: z.boolean().optional(),
  isPublished: z.boolean().optional(),

  // Capacity & Ground Type
  maxGuestsPerDay: z.number().int().min(1).optional().nullable(),
  maxTentsPerDay: z.number().int().min(1).optional().nullable(),
  // CAM-615: groundType stays `.optional()` only — it is a per-key numeric
  // counter (STONE/GRASS/CONCRETE/WOOD), never an all-or-nothing clearable
  // value; the host form always writes a real 0 for an untouched key, never
  // an empty object. See the ALLOWLIST note above.
  groundType: z.record(z.string(), z.number().int().min(0)).optional(), // {"STONE": 5, "GRASS": 10, ...}

  // Ownership & Pricing
  // CAM-615: ownershipType stays `.optional()` only — the host form is a
  // two-way toggle (PRIVATE / NATIONAL_PARK) with no third "not specified"
  // option, so there is no reachable host action that would clear it. See
  // the ALLOWLIST note above; flag to product before adding a clear path.
  ownershipType: OwnershipTypeEnum.optional(),
  isFree: z.boolean().optional(),
  
  // Pet & Display Settings
  petFriendly: z.boolean().optional(),
  useSpotView: z.boolean().optional(),
});

export type CampSiteInput = z.infer<typeof campSiteSchema>;

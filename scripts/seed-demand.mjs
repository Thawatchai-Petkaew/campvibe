#!/usr/bin/env node
// seed-demand.mjs — CAM demand-seeding toolkit (Stage 1): campers -> bookings -> reviews.
//
// Guarded, reproducible, idempotent. Reads LIVE camps+spots from the DB (never invents
// one) and upserts:
//   ~150 campers   (9 personas, bank-only tag — NEVER a DB column) + the hero account
//                  (camper@campvibe.com) enriched with a hand-pinned history.
//   ~2,600 bookings across 4 cohorts (reviewedCompleted/unreviewedCompleted/future/
//                  cancelled) with ADR-005 snapshot fields, mirroring the API create
//                  path / prisma/seed-bookings.ts:137-149.
//   ~1,050 reviews (1:1 with reviewedCompleted bookings, verified=true) — aspect
//                  profile derived from each camp's REAL fields, text composed from
//                  prisma/data/aspect-bank.json (or the LLM cache, reviews-generated.json,
//                  when present), rating correlated with sentiment.
// NO deleteMany, ever. Idempotent by construction: every User/Booking/Review is upserted
// by a stable key derived from its own inputs (email / a uuidv5-style deterministic id /
// bookingId), so a byte-identical re-run produces byte-identical row counts.
//
// SAFETY GUARD — refuses unless ALL of:
//   SEED_DEMAND=1                              (explicit destructive-write opt-in)
//   DATABASE_URL is set
//   target does NOT look like production (url contains "prod", NODE_ENV/VERCEL_ENV=production)
// Logs only scheme+hostname (never path/query/credentials) — see describeUrlShape (db-reset.mjs).
//
// DRY_RUN=1 — skips the guard AND every Prisma/DB call entirely; reads camps from the
// committed prisma/data/mock-staging-all.json instead and prints the cohort/rating counts
// + a few sample composed reviews. Safe to run anywhere, anytime, at zero cost.
//
// Usage:
//   DRY_RUN=1 node scripts/seed-demand.mjs                                   (free, no DB)
//   SEED_DEMAND=1 DATABASE_URL=<non-prod> npm run db:seed:demand             (real run)
//   … then: npm run reconcile:ratings                                       (mandatory final step)
import fs from 'fs';
import path from 'path';
import { createHash } from 'crypto';
import { fileURLToPath } from 'url';
import { describeUrlShape } from './db-reset.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

// ---- mulberry32 (same algorithm as scripts/gen-mock-data.mjs), parametrized per-key --
function mulberry32(seed) {
  let s = seed >>> 0;
  return function rnd() {
    s |= 0; s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/** FNV-1a-style 32-bit hash of a stable string key — the "sub-seed by hashing the stable key" every entity's PRNG derives from, so generation is 100% ORDER-INDEPENDENT (re-runs, DB row-order changes, or a different iteration order all produce the identical output for the same key). */
function hashSeed(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

// ---- deterministic uuidv5-style id (RFC4122 v5 shape, sha1-derived) ------------------
const NAMESPACE_HEX = 'a3f1c2d45b6e4a109c3f7d8e9f0a1b2c'; // fixed 16-byte namespace — arbitrary but constant across every run
function deterministicUuid(key) {
  const nsBytes = Buffer.from(NAMESPACE_HEX, 'hex');
  const hash = createHash('sha1').update(Buffer.concat([nsBytes, Buffer.from(key, 'utf8')])).digest();
  const bytes = Buffer.from(hash.subarray(0, 16));
  bytes[6] = (bytes[6] & 0x0f) | 0x50; // version 5
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // RFC4122 variant
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function addDays(d, n) { const r = new Date(d); r.setUTCDate(r.getUTCDate() + n); return r; }
/**
 * Midnight UTC "today" — NOT `new Date()` directly. A booking's deterministic id
 * (deterministicUuid) is hashed from its checkIn ISO string, so if `now` carried the
 * wall-clock hour/minute/second/ms, two invocations even a few seconds apart would
 * hash to DIFFERENT ids for the "same" logical booking — breaking the idempotency
 * contract (Prove-It: this was measured — two consecutive DRY_RUN calls produced
 * different rating distributions and review text because every id silently changed).
 * Truncating to the day keeps every run on the same UTC calendar day byte-identical;
 * a run on a later day intentionally shifts the past/future windows (the whole point
 * of "N days ago from today"), which re-upserts by each booking's own new deterministic
 * id — never a duplicate PK collision, by construction.
 */
function today() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}
function loadJson(rel) { return JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8')); }
function splitCsv(v) { return typeof v === 'string' ? v.split(',').map((s) => s.trim()).filter(Boolean) : []; }

// ---- prod guard -----------------------------------------------------------------------
function checkGuard() {
  const allow = process.env.SEED_DEMAND === '1';
  const url = process.env.DATABASE_URL || '';
  const looksProd = /prod/i.test(url) || process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production';
  if (!allow) return { ok: false, message: '✗ refusing: set SEED_DEMAND=1 to confirm running the demand seeder' };
  if (!url) return { ok: false, message: '✗ refusing: DATABASE_URL is not set' };
  if (looksProd) return { ok: false, message: '✗ refusing: target looks like PRODUCTION — demand seeder blocked for safety' };
  return { ok: true, url };
}

// ---- camp loading (unified CampRecord shape — DB-backed or the free JSON fallback) ----
function toCampRecord(raw, source) {
  return {
    id: raw.id,
    nameTh: raw.nameTh,
    nameEn: raw.nameEn ?? null,
    nameThSlug: raw.nameThSlug,
    nameEnSlug: raw.nameEnSlug,
    province: raw.province ?? null,
    facilities: raw.facilities,
    terrain: raw.terrain,
    accessTypes: raw.accessTypes,
    tags: raw.tags,
    petFriendly: !!raw.petFriendly,
    toiletInfo: raw.toiletInfo ?? null,
    minimumAge: raw.minimumAge ?? 0,
    priceLow: raw.priceLow,
    isFree: !!raw.isFree,
    checkInTime: raw.checkInTime ?? '14:00',
    checkOutTime: raw.checkOutTime ?? '12:00',
    spots: raw.spots ?? [],
    _source: source,
  };
}

async function loadCampsFromDb(prisma) {
  const rows = await prisma.campSite.findMany({
    where: { isPublished: true, isActive: true, deletedAt: null },
    orderBy: { nameThSlug: 'asc' }, // stable order — NOT relied on for determinism (every entity sub-seeds by its own key), just for readable logs
    select: {
      id: true, nameTh: true, nameEn: true, nameThSlug: true, nameEnSlug: true,
      priceLow: true, isFree: true, petFriendly: true, toiletInfo: true, minimumAge: true,
      checkInTime: true, checkOutTime: true, tags: true,
      location: { select: { province: true } },
      options: { select: { code: true, group: true } },
      spots: { where: { deletedAt: null }, select: { id: true, name: true, pricePerNight: true, maxCampers: true } },
    },
  });
  return rows.map((c) =>
    toCampRecord(
      {
        id: c.id, nameTh: c.nameTh, nameEn: c.nameEn, nameThSlug: c.nameThSlug, nameEnSlug: c.nameEnSlug,
        province: c.location?.province ?? null,
        facilities: c.options.filter((o) => o.group === 'Internal facility').map((o) => o.code),
        terrain: c.options.filter((o) => o.group === 'Terrain').map((o) => o.code),
        accessTypes: c.options.filter((o) => o.group === 'Access type').map((o) => o.code),
        tags: splitCsv(c.tags),
        petFriendly: c.petFriendly, toiletInfo: c.toiletInfo, minimumAge: c.minimumAge,
        priceLow: c.priceLow ? Number(c.priceLow) : null, isFree: c.isFree,
        checkInTime: c.checkInTime, checkOutTime: c.checkOutTime,
        spots: c.spots.map((s) => ({ id: s.id, name: s.name, pricePerNight: Number(s.pricePerNight), maxCampers: s.maxCampers })),
      },
      'db'
    )
  );
}

/** Free fallback (DRY_RUN and self-verify): the committed Stage 0 mock dataset — a real, rich 298-camp/77-province sample, never a toy fixture. */
function loadCampsFromMockJson() {
  const data = loadJson('prisma/data/mock-staging-all.json');
  const camps = [];
  for (const h of data.hosts ?? []) for (const c of h.campsites ?? []) camps.push(c);
  camps.sort((a, b) => a.nameThSlug.localeCompare(b.nameThSlug));
  return camps.map((c) =>
    toCampRecord(
      {
        id: c.nameThSlug, nameTh: c.nameTh, nameEn: c.nameEn, nameThSlug: c.nameThSlug, nameEnSlug: c.nameEnSlug, province: c.province,
        facilities: splitCsv(c.facilities), terrain: splitCsv(c.terrain), accessTypes: splitCsv(c.accessTypes), tags: splitCsv(c.tags),
        petFriendly: c.petFriendly, toiletInfo: c.toiletInfo, minimumAge: c.minimumAge,
        priceLow: c.priceLow ?? null, isFree: c.isFree,
        checkInTime: c.checkInTime, checkOutTime: c.checkOutTime,
        spots: (c.spots ?? []).map((s, i) => ({ id: `${c.nameThSlug}#${i}`, name: s.name, pricePerNight: s.pricePerNight, maxCampers: s.maxCampers })),
      },
      'mock-json'
    )
  );
}

// ---- campers ----------------------------------------------------------------------------
function weightedPick(entries, weightOf, rnd) {
  const total = entries.reduce((s, e) => s + weightOf(e), 0);
  let r = rnd() * total;
  for (const e of entries) { r -= weightOf(e); if (r <= 0) return e; }
  return entries[entries.length - 1];
}

function buildCampers(config, personasData) {
  const campers = [];
  for (let i = 0; i < config.camperCount; i++) {
    const email = `demo-camper-${String(i + 1).padStart(3, '0')}@camper.demo.campvibe.local`;
    const rnd = mulberry32(hashSeed(`camper|${email}`));
    const persona = weightedPick(personasData.personas, (p) => p.weight, rnd);
    const nameEntry = personasData.namePool[Math.floor(rnd() * personasData.namePool.length)];
    campers.push({ email, name: `${nameEntry.first} ${nameEntry.last} (ตัวอย่าง)`, personaKey: persona.key });
  }
  return campers;
}

// ---- aspect-consistency engine (derives each camp's REAL strengths/weaknesses) --------
function buildAspectProfile(camp) {
  const strengths = new Set(); const weaknesses = new Set();
  const fac = new Set(camp.facilities);
  const terr = new Set(camp.terrain);
  const acc = new Set(camp.accessTypes);
  const tagsStr = (camp.tags || []).join(' ');

  if (fac.has('WIFI') || fac.has('ELEC')) strengths.add('wifi_power'); else weaknesses.add('wifi_power');

  if (fac.has('SHOW') && /สะอาด|แยกชายหญิง/.test(camp.toiletInfo || '')) strengths.add('toilet_clean');
  else if (fac.has('TOIL')) strengths.add('toilet_clean');
  else weaknesses.add('toilet_clean');

  if ((camp.minimumAge ?? 0) === 0) strengths.add('family'); else weaknesses.add('family');

  if (camp.petFriendly) strengths.add('pet'); else weaknesses.add('pet');

  if (terr.has('BEAC') || terr.has('RIVE') || terr.has('MTNS')) strengths.add('photo_view');

  if (acc.has('DRIV')) strengths.add('access_beginner');
  if ((acc.has('HIKE') || acc.has('BAOT')) && !acc.has('DRIV')) weaknesses.add('access_beginner');

  if (/สงบ|เงียบ/.test(tagsStr)) strengths.add('quiet');
  else if ((terr.has('FORE') || terr.has('MTNS')) && !terr.has('BEAC')) strengths.add('quiet');

  if (camp.isFree || (camp.priceLow != null && camp.priceLow <= 400)) strengths.add('value');
  else if (camp.priceLow != null && camp.priceLow >= 1200) weaknesses.add('value');

  // staff/noise have no backing real field — deliberately left camp-agnostic; their
  // sentiment follows the review's overall rating instead (pickAspectsAndSentiment).
  return { strengths, weaknesses };
}

function pickAspectsAndSentiment(camp, persona, rating, rnd) {
  const profile = buildAspectProfile(camp);
  const biasEntries = Object.entries(persona.aspectBias || {});
  if (biasEntries.length === 0) return [];
  const n = rating >= 4 ? 1 + Math.floor(rnd() * 2) : rating === 3 ? 1 + Math.floor(rnd() * 2) : 1 + Math.floor(rnd() * 3);
  const pool = biasEntries.map(([aspect, weight]) => ({ aspect, weight }));
  const chosen = [];
  for (let k = 0; k < n && pool.length; k++) {
    const total = pool.reduce((s, x) => s + x.weight, 0);
    let r = rnd() * total, idx = 0;
    for (; idx < pool.length - 1; idx++) { r -= pool[idx].weight; if (r <= 0) break; }
    chosen.push(pool[idx].aspect);
    pool.splice(idx, 1);
  }
  return chosen.map((aspect) => {
    const isWeak = profile.weaknesses.has(aspect);
    const isStrong = profile.strengths.has(aspect);
    let sentiment;
    if (rating >= 4) sentiment = isWeak ? 'mixed' : 'pos';
    else if (rating === 3) sentiment = 'mixed';
    else sentiment = isStrong ? 'mixed' : 'neg';
    return { aspect, sentiment };
  });
}

function composeReviewText(chosen, personaKey, aspectBank, rnd) {
  const parts = chosen
    .map(({ aspect, sentiment }) => {
      const override = aspectBank.personaOverrides?.[personaKey]?.[aspect]?.[sentiment];
      const pool = override && override.length ? override : aspectBank[aspect]?.[sentiment];
      if (!pool || !pool.length) return null;
      return pool[Math.floor(rnd() * pool.length)];
    })
    .filter(Boolean);
  if (parts.length === 0) return 'พักที่นี่มาแล้ว บรรยากาศโดยรวมดี'; // safe, never-empty fallback (>=10 chars)
  return parts.join(' ');
}

function pickRating(rnd, dist) {
  const entries = Object.entries(dist);
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let r = rnd() * total;
  for (const [rating, w] of entries) { r -= w; if (r <= 0) return Number(rating); }
  return Number(entries[entries.length - 1][0]);
}

// ---- Zipf popularity ranking (order-independent — ranked by a hash of the camp's OWN
// stable key, never by array/DB row order) -----------------------------------------------
function computeZipfRanking(camps, exponent) {
  const scored = camps.map((c) => ({ camp: c, score: hashSeed(`pop|${c.nameThSlug}`) }));
  scored.sort((a, b) => a.score - b.score);
  return scored.map(({ camp }, i) => ({ camp, rank: i + 1, weight: 1 / Math.pow(i + 1, exponent) }));
}

function personaBoost(camp, persona) {
  if (!persona.prefersFacilityCodes?.length) return 1;
  const hit = persona.prefersFacilityCodes.some((code) => camp.facilities.includes(code));
  return hit ? 1.6 : 0.8;
}

function pickCampForPersona(ranking, persona, rnd) {
  let pool = ranking;
  if (persona.prefersPetFriendly === true) {
    const filtered = ranking.filter((r) => r.camp.petFriendly);
    if (filtered.length) pool = filtered;
  }
  if (persona.requiresMinimumAgeMax !== null && persona.requiresMinimumAgeMax !== undefined) {
    const filtered = pool.filter((r) => (r.camp.minimumAge ?? 0) <= persona.requiresMinimumAgeMax);
    if (filtered.length) pool = filtered;
  }
  const weighted = pool.map((r) => ({ camp: r.camp, weight: r.weight * personaBoost(r.camp, persona) }));
  const total = weighted.reduce((s, w) => s + w.weight, 0);
  let r = rnd() * total;
  for (const w of weighted) { r -= w.weight; if (r <= 0) return w.camp; }
  return weighted[weighted.length - 1].camp;
}

function pickDates(cohortName, config, rnd) {
  const now = today();
  let checkIn;
  if (cohortName === 'future') {
    const days = config.futureWindowDaysMin + Math.floor(rnd() * (config.futureWindowDaysMax - config.futureWindowDaysMin + 1));
    checkIn = addDays(now, days);
  } else if (cohortName === 'cancelled') {
    const days = config.cancelledWindowDaysMin + Math.floor(rnd() * (config.cancelledWindowDaysMax - config.cancelledWindowDaysMin + 1));
    checkIn = addDays(now, days);
  } else {
    const days = config.pastWindowDaysMin + Math.floor(rnd() * (config.pastWindowDaysMax - config.pastWindowDaysMin + 1));
    checkIn = addDays(now, -days);
  }
  const nights = config.nightsMin + Math.floor(rnd() * (config.nightsMax - config.nightsMin + 1));
  return { checkIn, checkOut: addDays(checkIn, nights), nights };
}

function pickFutureStatus(rnd, weights) {
  const entries = Object.entries(weights);
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let r = rnd() * total;
  for (const [status, w] of entries) { r -= w; if (r <= 0) return status; }
  return entries[entries.length - 1][0];
}

function pickSpotAndPrice(camp, rnd) {
  if (camp.spots && camp.spots.length > 0) {
    const spot = camp.spots[Math.floor(rnd() * camp.spots.length)];
    return { spotId: spot.id, spotName: spot.name ?? null, unitPrice: spot.pricePerNight ?? 0 };
  }
  return { spotId: null, spotName: null, unitPrice: camp.isFree ? 0 : (camp.priceLow ?? 500) };
}

/** Mirrors the API create path / prisma/seed-bookings.ts:137-149 (ADR-005 crystallized snapshot). */
function buildBookingRecord({ cohortName, seq, camper, camp, persona, config, rnd, status }) {
  const { checkIn, checkOut, nights } = pickDates(cohortName, config, rnd);
  const { spotId, spotName, unitPrice } = pickSpotAndPrice(camp, rnd);
  const guests = persona.partySize.min + Math.floor(rnd() * (persona.partySize.max - persona.partySize.min + 1));
  const totalPrice = unitPrice * nights; // unit*nights, no guest multiplier — same convention as the API/seed-bookings.ts
  const checkInIso = checkIn.toISOString();
  const id = deterministicUuid(`${camper.email}|${camp.nameThSlug}|${checkInIso}|${cohortName}|${seq}`);
  const createdAt = addDays(checkIn, -(1 + Math.floor(rnd() * 30)));
  return {
    id, cohortName, camperEmail: camper.email, personaKey: persona.key, campSiteId: camp.id, spotId,
    checkInDate: checkIn, checkOutDate: checkOut, guests, totalPrice, nights, status,
    snapshotCampName: camp.nameTh, snapshotCampNameEn: camp.nameEn, snapshotSpotName: spotName,
    snapshotUnitAmount: unitPrice, snapshotSubtotalAmount: totalPrice, snapshotTotalAmount: totalPrice,
    snapshotCheckInTime: camp.checkInTime, snapshotCheckOutTime: camp.checkOutTime, createdAt,
  };
}

function allocateCohort(cohortName, count, campers, personasByKey, rankingFull, config) {
  const bookings = [];
  for (let i = 0; i < count; i++) {
    const rnd = mulberry32(hashSeed(`booking|${cohortName}|${i}`));
    const camper = campers[Math.floor(rnd() * campers.length)];
    const persona = personasByKey.get(camper.personaKey);
    const camp = pickCampForPersona(rankingFull, persona, rnd);
    const status = cohortName === 'future' ? pickFutureStatus(rnd, config.futureStatusWeights)
      : cohortName === 'cancelled' ? 'CANCELLED' : 'COMPLETED';
    bookings.push(buildBookingRecord({ cohortName, seq: i, camper, camp, persona, config, rnd, status }));
  }
  return bookings;
}

/**
 * The reviewedCompleted cohort is special: it's the ONLY source of reviews, and the
 * plan's "leave ~6-8 camps with 0 reviews" means every OTHER eligible camp must get
 * at least one — a plain Zipf-weighted random pick over ~290 camps for only ~1050
 * bookings would leave a long, UNINTENTIONAL zero-review tail (Prove-It: this was
 * measured at 104 zero-review camps in DRY_RUN before this two-phase fix). Phase 1
 * guarantees exactly one booking per eligible (non-zero-review-designated) camp;
 * phase 2 spends the remaining budget via the same Zipf popularity weighting, so
 * popular camps still accumulate visibly more reviews than the long tail.
 */
function allocateReviewedCohort(count, campers, personasByKey, rankingReviewed, config) {
  const bookings = [];
  let seq = 0;
  for (const { camp } of rankingReviewed) {
    const rnd = mulberry32(hashSeed(`booking|reviewedCompleted|cover|${camp.nameThSlug}`));
    const camper = campers[Math.floor(rnd() * campers.length)];
    const persona = personasByKey.get(camper.personaKey);
    bookings.push(buildBookingRecord({ cohortName: 'reviewedCompleted', seq: seq++, camper, camp, persona, config, rnd, status: 'COMPLETED' }));
  }
  const remaining = Math.max(0, count - rankingReviewed.length);
  for (let i = 0; i < remaining; i++) {
    const rnd = mulberry32(hashSeed(`booking|reviewedCompleted|extra|${i}`));
    const camper = campers[Math.floor(rnd() * campers.length)];
    const persona = personasByKey.get(camper.personaKey);
    const camp = pickCampForPersona(rankingReviewed, persona, rnd);
    bookings.push(buildBookingRecord({ cohortName: 'reviewedCompleted', seq: seq++, camper, camp, persona, config, rnd, status: 'COMPLETED' }));
  }
  return bookings;
}

function buildReviewForBooking(booking, camp, personasByKey, aspectBank, reviewsCache, config) {
  const rnd = mulberry32(hashSeed(`review|${booking.id}`));
  const rating = pickRating(rnd, config.ratingDistribution);
  const cache = reviewsCache?.camps?.[camp.nameThSlug];
  let content;
  if (cache?.texts?.length) {
    content = cache.texts[Math.floor(rnd() * cache.texts.length)];
  } else {
    const persona = personasByKey.get(booking.personaKey);
    const chosen = pickAspectsAndSentiment(camp, persona, rating, rnd);
    content = composeReviewText(chosen, booking.personaKey, aspectBank, rnd);
  }
  return { bookingId: booking.id, camperEmail: booking.camperEmail, campSiteId: booking.campSiteId, rating, content, visitDate: booking.checkOutDate };
}

function buildHeroEnrichment(camps, config, personasData, personasByKey, aspectBank, reviewsCache) {
  const campBySlug = new Map(camps.map((c) => [c.nameEnSlug, c]));
  const persona = personasByKey.get('couple') ?? personasData.personas[0];
  const camper = { email: config.heroEmail, personaKey: persona.key };
  const bookings = [];
  const reviews = [];

  (config.heroCamps?.completedSlugs ?? []).forEach((slug, idx) => {
    const camp = campBySlug.get(slug);
    if (!camp) { console.warn(`[seed-demand] hero camp slug not found (skipped): ${slug}`); return; }
    const rnd = mulberry32(hashSeed(`hero|completed|${slug}`));
    const booking = buildBookingRecord({ cohortName: 'reviewedCompleted', seq: idx, camper, camp, persona, config, rnd, status: 'COMPLETED' });
    bookings.push(booking);
    reviews.push(buildReviewForBooking(booking, camp, personasByKey, aspectBank, reviewsCache, config));
  });

  const upcomingSlug = config.heroCamps?.upcomingSlug;
  const upcomingCamp = upcomingSlug ? campBySlug.get(upcomingSlug) : null;
  if (upcomingCamp) {
    const rnd = mulberry32(hashSeed('hero|upcoming'));
    bookings.push(buildBookingRecord({ cohortName: 'future', seq: 0, camper, camp: upcomingCamp, persona, config, rnd, status: 'CONFIRMED' }));
  } else if (upcomingSlug) {
    console.warn(`[seed-demand] hero upcoming camp slug not found (skipped): ${upcomingSlug}`);
  }

  return { bookings, reviews };
}

function printDryRunSummary(campers, bookings, reviews, camps) {
  const byStatus = {}; for (const b of bookings) byStatus[b.status] = (byStatus[b.status] || 0) + 1;
  const byRating = {}; for (const r of reviews) byRating[r.rating] = (byRating[r.rating] || 0) + 1;
  const byPersona = {}; for (const c of campers) byPersona[c.personaKey] = (byPersona[c.personaKey] || 0) + 1;
  const reviewedCampIds = new Set(reviews.map((r) => r.campSiteId));
  const zeroReviewCamps = camps.filter((c) => !reviewedCampIds.has(c.id));

  console.log('[seed-demand] DRY_RUN summary (no DB touched, no network call):');
  console.log(`  camps loaded = ${camps.length} (source: ${camps[0]?._source ?? 'n/a'})`);
  console.log(`  campers = ${campers.length}  by persona:`, byPersona);
  console.log(`  bookings = ${bookings.length}  by status:`, byStatus);
  console.log(`  reviews = ${reviews.length}  by rating:`, byRating);
  console.log(`  camps with 0 reviews in this sample = ${zeroReviewCamps.length} (target ~${JSON.parse(fs.readFileSync(path.join(ROOT, 'prisma/data/demand-config.json'), 'utf8')).zeroReviewCampCount})`);
  console.log('  sample reviews:');
  for (const r of reviews.slice(0, 3)) console.log(`    [${r.rating}★] ${r.content}`);
}

async function hashSharedPassword(plain) {
  const { default: bcrypt } = await import('bcryptjs').catch(() => import('bcrypt'));
  return bcrypt.hash(plain, 12);
}

async function persist(prisma, campers, bookings, reviews, config) {
  const emailToUserId = new Map();
  const passwordHash = await hashSharedPassword(config.sharedDevPassword);

  let campersUpserted = 0;
  for (const camper of campers) {
    const user = await prisma.user.upsert({
      where: { email: camper.email },
      update: { name: camper.name },
      create: { email: camper.email, password: passwordHash, name: camper.name, phone: null, role: 'CAMPER' },
      select: { id: true, email: true },
    });
    emailToUserId.set(camper.email, user.id);
    campersUpserted++;
  }

  const heroUser = await prisma.user.findUnique({ where: { email: config.heroEmail }, select: { id: true } });
  if (heroUser) emailToUserId.set(config.heroEmail, heroUser.id);
  else console.warn(`[seed-demand] hero account ${config.heroEmail} not found — its extra bookings/reviews are skipped`);

  let bookingsUpserted = 0;
  for (const b of bookings) {
    const userId = emailToUserId.get(b.camperEmail);
    if (!userId) continue;
    await prisma.booking.upsert({
      where: { id: b.id },
      update: { status: b.status }, // re-run: only status may legitimately resync; every ADR-005 snapshot field is frozen and must not drift
      create: {
        id: b.id, userId, campSiteId: b.campSiteId, spotId: b.spotId,
        checkInDate: b.checkInDate, checkOutDate: b.checkOutDate, guests: b.guests,
        totalPrice: b.totalPrice, currency: 'THB', status: b.status,
        snapshotCampName: b.snapshotCampName, snapshotCampNameEn: b.snapshotCampNameEn, snapshotSpotName: b.snapshotSpotName,
        snapshotUnitAmount: b.snapshotUnitAmount, snapshotSubtotalAmount: b.snapshotSubtotalAmount,
        snapshotTaxRate: 0, snapshotTaxAmount: 0, snapshotVatInclusive: false,
        snapshotTotalAmount: b.snapshotTotalAmount, snapshotCurrency: 'THB', snapshotNights: b.nights,
        snapshotCheckInTime: b.snapshotCheckInTime, snapshotCheckOutTime: b.snapshotCheckOutTime, snapshotTimezone: 'Asia/Bangkok',
        createdAt: b.createdAt,
      },
    });
    bookingsUpserted++;
  }

  let reviewsUpserted = 0;
  for (const r of reviews) {
    const userId = emailToUserId.get(r.camperEmail);
    if (!userId) continue;
    await prisma.review.upsert({
      where: { bookingId: r.bookingId },
      update: { rating: r.rating, content: r.content, verified: true },
      create: { campSiteId: r.campSiteId, authorId: userId, bookingId: r.bookingId, rating: r.rating, content: r.content, visitDate: r.visitDate, verified: true },
    });
    reviewsUpserted++;
  }

  console.log(`[seed-demand] persisted: campers=${campersUpserted} bookings=${bookingsUpserted} reviews=${reviewsUpserted}`);
}

async function main() {
  const dryRun = process.env.DRY_RUN === '1';

  if (!dryRun) {
    const guard = checkGuard();
    if (!guard.ok) { console.error(guard.message); process.exit(1); }
    console.log(`[seed-demand] target: ${describeUrlShape(guard.url)}`);
  }

  const personasData = loadJson('prisma/data/personas.json');
  const aspectBank = loadJson('prisma/data/aspect-bank.json');
  const config = loadJson('prisma/data/demand-config.json');
  let reviewsCache = { camps: {} };
  try { reviewsCache = loadJson('prisma/data/reviews-generated.json'); } catch { /* cache absent/invalid — bank-only fallback */ }

  const personasByKey = new Map(personasData.personas.map((p) => [p.key, p]));

  let prisma = null;
  let camps;
  if (dryRun) {
    camps = loadCampsFromMockJson();
  } else {
    const { PrismaClient } = await import('@prisma/client');
    prisma = new PrismaClient();
    camps = await loadCampsFromDb(prisma);
    if (camps.length === 0) {
      console.error('[seed-demand] no published camps found in the DB — run `npm run db:load:staging` first.');
      await prisma.$disconnect();
      process.exit(1);
    }
  }

  const campers = buildCampers(config, personasData);
  const ranking = computeZipfRanking(camps, config.zipfExponent);
  const zeroReviewSlugs = new Set(ranking.slice(-config.zeroReviewCampCount).map((r) => r.camp.nameThSlug));
  const rankingReviewed = ranking.filter((r) => !zeroReviewSlugs.has(r.camp.nameThSlug));

  const cohortBookings = [];
  for (const [cohortName, count] of Object.entries(config.cohorts)) {
    if (cohortName === 'reviewedCompleted') {
      cohortBookings.push(...allocateReviewedCohort(count, campers, personasByKey, rankingReviewed, config));
    } else {
      cohortBookings.push(...allocateCohort(cohortName, count, campers, personasByKey, ranking, config));
    }
  }

  const campById = new Map(camps.map((c) => [c.id, c]));
  const reviews = cohortBookings
    .filter((b) => b.cohortName === 'reviewedCompleted')
    .map((b) => buildReviewForBooking(b, campById.get(b.campSiteId), personasByKey, aspectBank, reviewsCache, config));

  const hero = buildHeroEnrichment(camps, config, personasData, personasByKey, aspectBank, reviewsCache);
  const allBookings = [...cohortBookings, ...hero.bookings];
  const allReviews = [...reviews, ...hero.reviews];

  if (dryRun) {
    printDryRunSummary(campers, allBookings, allReviews, camps);
    return;
  }

  await persist(prisma, campers, allBookings, allReviews, config);
  await prisma.$disconnect();
  console.log('[seed-demand] done. NEXT: run `npm run reconcile:ratings` to recompute avgRating/reviewCount from these reviews.');
}

main().catch(async (err) => {
  console.error('[seed-demand] fatal:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});

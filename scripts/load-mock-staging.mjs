/**
 * CAM-187 MEAS-1d — Idempotent 128-camp staging loader.
 *
 * Reads prisma/data/mock-staging-all.json and upserts:
 *   - 65 hosts (by email)
 *   - 128 campsites (by nameThSlug)
 *
 * SAFETY GUARANTEES:
 *   - NEVER calls deleteMany on any table (shared staging DB)
 *   - All writes are upsert or createMany with skipDuplicates:true
 *   - Idempotent: run multiple times = same result
 *
 * Usage (requires DATABASE_URL pointing at staging):
 *   node scripts/load-mock-staging.mjs
 *   npm run db:load:staging
 *
 * NEVER run against production DB.
 * Bcrypt 12 rounds for host passwords (matches existing seed pattern).
 */

import { PrismaClient } from '@prisma/client';
import { createHash } from 'crypto';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// ─────────────────────────────────────────────────────────────
// Bcrypt — dynamic import to work in ESM without bundler
// ─────────────────────────────────────────────────────────────
const { default: bcrypt } = await import('bcryptjs').catch(() => import('bcrypt'));

// F-3: fixed dev password hashed at load time — never read from JSON.
// The JSON carries "__SET_AT_LOAD__" as a sentinel; this constant is the
// actual value used. bcrypt cost 12 per security standards.
const DEV_PASSWORD = 'CampVibe-dev-2025!';
const DEV_PASSWORD_HASH = await bcrypt.hash(DEV_PASSWORD, 12);

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DATA_PATH = join(__dirname, '../prisma/data/mock-staging-all.json');

// ─────────────────────────────────────────────────────────────
// MEAS-1: Unsplash image pool
//
// The themed /seed/ images referenced in imageManifest have not been generated yet.
// We use a curated pool of real Unsplash URLs so the 128-camp staging load
// produces a realistic visual baseline for MEAS-1 measurements.
// Swap back when public/seed images exist (imageManifest holds the prompts).
// ─────────────────────────────────────────────────────────────

// MEAS-1: themed /seed images not generated yet — using Unsplash pool for a realistic
// baseline; swap back when public/seed images exist (imageManifest holds the prompts).
const UNSPLASH_POOL = [
  // Tent / campfire / camp setup
  'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=1200', // tents in a green field
  'https://images.unsplash.com/photo-1478131143081-80f7f84ca84d?w=1200', // campfire at night
  'https://images.unsplash.com/photo-1487730116645-74489c95b41b?w=1200', // tent at sunrise
  'https://images.unsplash.com/photo-1445308394109-4ec2920981b1?w=1200', // mountain tents foggy
  'https://images.unsplash.com/photo-1510312305653-8ed496efae75?w=1200', // tent on beach
  // Forest / jungle
  'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=1200', // forest light rays
  'https://images.unsplash.com/photo-1448375240586-882707db888b?w=1200', // dense forest path
  'https://images.unsplash.com/photo-1516912481808-3406841bd33c?w=1200', // tent among tall trees
  // Mountain / highland
  'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1200', // mountain panorama
  'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1200', // alpine peaks sunset
  'https://images.unsplash.com/photo-1519331379826-f10be5486c6f?w=1200', // hiking ridge
  'https://images.unsplash.com/photo-1454496522488-7a8e488e8606?w=1200', // mountain camp misty
  // Lake / river / waterside
  'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?w=1200', // lakeside camp
  'https://images.unsplash.com/photo-1523987355523-c7b5b0dd90a7?w=1200', // river forest camp
  'https://images.unsplash.com/photo-1476611338391-6f395a0dd82e?w=1200', // lake reflection tents
  // Stars / night sky / milky way
  'https://images.unsplash.com/photo-1531366936337-7c912a4589a7?w=1200', // milky way over tent
  'https://images.unsplash.com/photo-1464207687429-7505649dae38?w=1200', // starry night campsite
  // Nature / meadow / sunrise
  'https://images.unsplash.com/photo-1501854140801-50d01698950b?w=1200', // green meadow sunrise
];

const POOL_SIZE = UNSPLASH_POOL.length; // 18

/**
 * Deterministically pick N URLs from UNSPLASH_POOL for a given camp.
 * Uses a hash of nameThSlug so:
 *   - Different camps get different starting offsets (visual variety)
 *   - Re-runs produce the same result (idempotent)
 *   - 3–5 images per camp (gallery) plus 1 logo (first picked URL)
 */
function pickPoolUrls(nameThSlug, count) {
  // FNV-1a-style integer hash — fast, no crypto needed for this purpose
  let hash = 2166136261;
  for (let i = 0; i < nameThSlug.length; i++) {
    hash ^= nameThSlug.charCodeAt(i);
    hash = (hash * 16777619) >>> 0; // keep 32-bit unsigned
  }
  const offset = hash % POOL_SIZE;
  const result = [];
  for (let i = 0; i < count; i++) {
    result.push(UNSPLASH_POOL[(offset + i) % POOL_SIZE]);
  }
  return result;
}

/**
 * How many gallery images to assign a camp — deterministic (3–5) based on slug hash.
 * Spread across the range so the load feels varied.
 */
function galleryCount(nameThSlug) {
  let h = 0;
  for (let i = 0; i < nameThSlug.length; i++) h = (h * 31 + nameThSlug.charCodeAt(i)) >>> 0;
  return 3 + (h % 3); // 3, 4, or 5
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

/** Split a CSV option string into an array of non-empty codes. */
function splitCsv(value) {
  if (!value || typeof value !== 'string') return [];
  return value.split(',').map((s) => s.trim()).filter(Boolean);
}

/** Build MasterData connect array from multiple CSV option fields. */
function buildOptionsConnect(camp) {
  const codes = [
    ...splitCsv(camp.accessTypes),
    ...splitCsv(camp.facilities),
    ...splitCsv(camp.externalFacilities),
    ...splitCsv(camp.equipment),
    ...splitCsv(camp.activities),
    ...splitCsv(camp.terrain),
  ];
  // Deduplicate
  return [...new Set(codes)].map((code) => ({ code }));
}

/**
 * Build Image createMany data using the Unsplash pool.
 *
 * MEAS-1: imageManifest paths (/seed/...) are NOT used as image URLs here —
 * those files do not exist yet. The manifest is preserved in memory for future
 * themed generation (option B). We assign 3–5 real Unsplash URLs instead.
 *
 * Images table has (url, campSiteId) — skipDuplicates on createMany handles re-runs.
 */
function buildImageRows(campSiteId, _imageManifest, nameThSlug) {
  const count = galleryCount(nameThSlug);
  const urls = pickPoolUrls(nameThSlug, count);
  return urls.map((url, idx) => ({
    url,
    alt: null,
    sortOrder: idx,
    campSiteId,
  }));
}

/**
 * Extract logo URL — uses first Unsplash pool entry for this camp's slug.
 *
 * MEAS-1: imageManifest logo path (/seed/...) does not exist yet; use pool instead.
 */
function extractLogo(imageManifest, nameThSlug) {
  // imageManifest argument kept for API compatibility; not used for the URL.
  // When /seed images are generated, swap: return imageManifest.find(i => i.role === 'logo')?.path
  return pickPoolUrls(nameThSlug, 1)[0];
}

/** Simple hash of email for deterministic but non-reversible key display in logs. */
function hashKey(value) {
  return createHash('sha256').update(value).digest('hex').slice(0, 8);
}

// ─────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────

async function main() {
  const prisma = new PrismaClient();

  console.log('[load-mock-staging] Reading JSON...');
  const raw = readFileSync(DATA_PATH, 'utf-8');
  const data = JSON.parse(raw);

  const { meta, hosts } = data;
  console.log(`[load-mock-staging] ${meta.totalHosts} hosts / ${meta.totalCampsites} campsites — variant: ${meta.variant}`);

  let hostsUpserted = 0;
  let campsUpserted = 0;
  let imagesCreated = 0;
  let spotsCreated = 0;
  let skippedOptions = 0;

  for (const hostData of hosts) {
    // ── 1. Upsert host ──────────────────────────────────────
    // Use the pre-hashed constant — never read a password from the JSON (F-3).
    const passwordHash = DEV_PASSWORD_HASH;

    const host = await prisma.user.upsert({
      where: { email: hostData.email },
      update: {
        name: hostData.name,
        phone: hostData.phone,
        image: hostData.image,
        role: hostData.role,
        isHostRegistered: hostData.isHostRegistered ?? false,
        hostRegisteredAt: hostData.hostRegisteredAt
          ? new Date(hostData.hostRegisteredAt)
          : null,
        businessType: hostData.businessType ?? null,
        businessName: hostData.businessName ?? null,
        taxId: hostData.taxId ?? null,
        businessAddress: hostData.businessAddress ?? null,
      },
      create: {
        email: hostData.email,
        password: passwordHash,
        name: hostData.name,
        phone: hostData.phone,
        image: hostData.image,
        role: hostData.role,
        isHostRegistered: hostData.isHostRegistered ?? false,
        hostRegisteredAt: hostData.hostRegisteredAt
          ? new Date(hostData.hostRegisteredAt)
          : null,
        businessType: hostData.businessType ?? null,
        businessName: hostData.businessName ?? null,
        taxId: hostData.taxId ?? null,
        businessAddress: hostData.businessAddress ?? null,
      },
      select: { id: true, email: true },
    });
    hostsUpserted++;

    // ── 2. Upsert each campsite ──────────────────────────────
    for (const camp of hostData.campsites ?? []) {
      // Resolve MasterData options — look up existing codes, skip unknown
      const requestedCodes = buildOptionsConnect(camp);
      let resolvedOptions = [];
      if (requestedCodes.length > 0) {
        const foundCodes = await prisma.masterData.findMany({
          where: { code: { in: requestedCodes.map((c) => c.code) } },
          select: { code: true },
        });
        const foundSet = new Set(foundCodes.map((m) => m.code));
        const unknown = requestedCodes.filter((c) => !foundSet.has(c.code));
        if (unknown.length > 0) {
          skippedOptions += unknown.length;
          console.warn(
            `[load-mock-staging] ${camp.nameThSlug}: skipping unknown MasterData codes: ${unknown.map((c) => c.code).join(', ')}`
          );
        }
        resolvedOptions = foundCodes;
      }

      // Upsert campsite by nameThSlug (unique key)
      const campSite = await prisma.campSite.upsert({
        where: { nameThSlug: camp.nameThSlug },
        update: {
          nameTh: camp.nameTh,
          nameEn: camp.nameEn ?? null,
          nameEnSlug: camp.nameEnSlug ?? camp.nameThSlug,
          description: camp.description ?? '',
          campSiteType: camp.campSiteType ?? 'CAGD',
          accommodationTypes: camp.accommodationTypes ?? 'TENT',
          latitude: camp.latitude,
          longitude: camp.longitude,
          address: camp.address ?? null,
          directions: camp.directions ?? null,
          checkInTime: camp.checkInTime ?? '14:00',
          checkOutTime: camp.checkOutTime ?? '12:00',
          bookingMethod: camp.bookingMethod ?? 'ONLI',
          priceLow: camp.priceLow ?? null,
          priceHigh: camp.priceHigh ?? null,
          priceCurrency: camp.priceCurrency ?? 'THB',
          feeInfo: camp.feeInfo ?? null,
          toiletInfo: camp.toiletInfo ?? null,
          minimumAge: camp.minimumAge ?? 0,
          maxGuestsPerDay: camp.maxGuestsPerDay ?? null,
          maxTentsPerDay: camp.maxTentsPerDay ?? null,
          groundType: camp.groundType ?? null,
          phone: camp.phone ?? null,
          lineId: camp.lineId ?? null,
          facebookUrl: camp.facebookUrl ?? null,
          tiktokUrl: camp.tiktokUrl ?? null,
          tags: Array.isArray(camp.tags) ? camp.tags.join(',') : camp.tags ?? null,
          ownershipType: camp.ownershipType ?? 'PRIVATE',
          isFree: camp.isFree ?? false,
          petFriendly: camp.petFriendly ?? false,
          isActive: camp.isActive ?? true,
          isPublished: true,
          logo: extractLogo(camp.imageManifest, camp.nameThSlug),
          options: { set: resolvedOptions },
          operatorId: host.id,
        },
        create: {
          nameTh: camp.nameTh,
          nameEn: camp.nameEn ?? null,
          nameThSlug: camp.nameThSlug,
          nameEnSlug: camp.nameEnSlug ?? camp.nameThSlug,
          description: camp.description ?? '',
          campSiteType: camp.campSiteType ?? 'CAGD',
          accommodationTypes: camp.accommodationTypes ?? 'TENT',
          latitude: camp.latitude,
          longitude: camp.longitude,
          address: camp.address ?? null,
          directions: camp.directions ?? null,
          checkInTime: camp.checkInTime ?? '14:00',
          checkOutTime: camp.checkOutTime ?? '12:00',
          bookingMethod: camp.bookingMethod ?? 'ONLI',
          priceLow: camp.priceLow ?? null,
          priceHigh: camp.priceHigh ?? null,
          priceCurrency: camp.priceCurrency ?? 'THB',
          feeInfo: camp.feeInfo ?? null,
          toiletInfo: camp.toiletInfo ?? null,
          minimumAge: camp.minimumAge ?? 0,
          maxGuestsPerDay: camp.maxGuestsPerDay ?? null,
          maxTentsPerDay: camp.maxTentsPerDay ?? null,
          groundType: camp.groundType ?? null,
          phone: camp.phone ?? null,
          lineId: camp.lineId ?? null,
          facebookUrl: camp.facebookUrl ?? null,
          tiktokUrl: camp.tiktokUrl ?? null,
          tags: Array.isArray(camp.tags) ? camp.tags.join(',') : camp.tags ?? null,
          ownershipType: camp.ownershipType ?? 'PRIVATE',
          isFree: camp.isFree ?? false,
          petFriendly: camp.petFriendly ?? false,
          isActive: camp.isActive ?? true,
          isPublished: true,
          logo: extractLogo(camp.imageManifest, camp.nameThSlug),
          options: { connect: resolvedOptions },
          operator: { connect: { id: host.id } },
          // Location — create inline on first upsert
          location: {
            create: {
              country: 'Thailand',
              province: camp.province ?? null,
              lat: camp.latitude,
              lon: camp.longitude,
            },
          },
        },
        select: { id: true, nameThSlug: true },
      });
      campsUpserted++;

      // ── 3. Images (createMany + skipDuplicates) ────────────
      const imageRows = buildImageRows(campSite.id, camp.imageManifest, camp.nameThSlug);
      if (imageRows.length > 0) {
        const result = await prisma.image.createMany({
          data: imageRows,
          skipDuplicates: true,
        });
        imagesCreated += result.count;
      }

      // ── 4. Spots (createMany + skipDuplicates) ─────────────
      // Image model has no composite unique on (name + campSiteId) in schema
      // so we use a findFirst guard before creating to keep it idempotent.
      for (const spot of camp.spots ?? []) {
        const existing = await prisma.spot.findFirst({
          where: { name: spot.name, campSiteId: campSite.id },
          select: { id: true },
        });
        if (!existing) {
          await prisma.spot.create({
            data: {
              zone: spot.zone ?? null,
              name: spot.name,
              viewType: spot.viewType ?? null,
              maxCampers: spot.maxCampers ?? null,
              maxTents: spot.maxTents ?? null,
              environment: spot.environment ?? null,
              pricePerNight: spot.pricePerNight ?? 0,
              priceCurrency: spot.priceCurrency ?? 'THB',
              nearFacilities: spot.nearFacilities ?? null,
              campSiteId: campSite.id,
            },
          });
          spotsCreated++;
        }
      }
    }
  }

  await prisma.$disconnect();

  console.log('[load-mock-staging] Done.');
  console.log(`  Hosts upserted:    ${hostsUpserted}`);
  console.log(`  Camps upserted:    ${campsUpserted}`);
  console.log(`  Images created:    ${imagesCreated} (skipDuplicates)`);
  console.log(`  Spots created:     ${spotsCreated} (skip-if-exists)`);
  if (skippedOptions > 0) {
    console.log(`  Options skipped:   ${skippedOptions} (unknown MasterData codes)`);
  }
}

main().catch((err) => {
  console.error('[load-mock-staging] Fatal error:', err.message ?? err);
  process.exit(1);
});

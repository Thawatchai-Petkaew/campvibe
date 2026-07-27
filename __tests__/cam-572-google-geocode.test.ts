/**
 * cam-572-google-geocode.test.ts — CAM-572
 * (platform-hardening/taxonomy-ui-foundation)
 *
 * Pins `lib/geo/google-geocode.ts` — the ONE shared low-level Google
 * Geocoding API fetch primitive consolidated from TWO independently
 * hand-rolled script copies: `scripts/backfill-cam-562-subdistrict-
 * geocode.mjs`'s reverse-mode `callGoogleGeocode(lat, lon)` and
 * `scripts/backfill-cam-571-coordinates-inside-thailand.mjs`'s forward-mode
 * `callGoogleGeocodeForward(address)`. Both scripts now delegate to
 * `callGoogleGeocodeCore` here (see tech.md for the full inventory and the
 * enumerated diff of what each prior copy learned that the other didn't).
 *
 * `app/api/geocode/_shared.ts::callGoogleGeocode` (CAM-554, the TS-route
 * caller) was this story's one deliberate, documented exception — left
 * unconsolidated because `__tests__/cam-554-geocode-routes.test.ts`
 * source-inspected that exact file's own text for the key-safety invariant
 * (see tech.md "Why `_shared.ts::callGoogleGeocode` stays a separate,
 * documented exception"). CAM-585 rewrote those 2 assertions to pin the
 * invariant BEHAVIOURALLY instead and finished the move: `_shared.ts` is now
 * a thin translation on top of `callGoogleGeocodeCore` too, so the "exactly
 * 2 places" consolidation-count test below is updated to "exactly 1" as the
 * intended, disclosed consequence (same pattern as CAM-581 BR-5 updating a
 * backlog assertion in place once the backlog it tracked hit its target).
 * `__tests__/cam-562-geocode-backfill.test.ts` /
 * `__tests__/cam-571-coordinates-inside-thailand.test.ts` remain the
 * integration-level proof (run UNEDITED, still green) that each caller's
 * own contract survived the consolidation; this file is the unit-level
 * proof of the shared primitive itself, plus the consolidation-count and
 * key-safety invariants the ticket's done_when requires.
 *
 * Coverage matrix (qa.md §7): normal · null/empty · boundary · error/
 * validation · concurrent/ordering (n/a - no shared mutable state).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { callGoogleGeocodeCore, extractComponent, type GoogleAddressComponent } from '@/lib/geo/google-geocode';
import { callGoogleGeocode as cam562CallGoogleGeocode } from '../scripts/backfill-cam-562-subdistrict-geocode.mjs';
import { callGoogleGeocodeForward as cam571CallGoogleGeocodeForward } from '../scripts/backfill-cam-571-coordinates-inside-thailand.mjs';

const root = path.resolve(__dirname, '..');
const src = (rel: string) => fs.readFileSync(path.join(root, rel), 'utf-8');

// ===========================================================================
// Google address_components fixtures (same style as cam-554/cam-562)
// ===========================================================================
const CNX_FULL_EN: GoogleAddressComponent[] = [
  { long_name: 'Chiang Mai Province', short_name: 'Chiang Mai', types: ['administrative_area_level_1', 'political'] },
  { long_name: 'Amphoe Mueang Chiang Mai', short_name: 'Mueang Chiang Mai', types: ['administrative_area_level_2', 'political'] },
  { long_name: 'Tambon Si Phum', short_name: 'Si Phum', types: ['sublocality_level_1', 'sublocality', 'political'] },
  { long_name: 'Thailand', short_name: 'TH', types: ['country', 'political'] },
];
const CNX_PROVINCE_ONLY_NO_DISTRICT: GoogleAddressComponent[] = [
  { long_name: 'Chiang Mai Province', short_name: 'Chiang Mai', types: ['administrative_area_level_1', 'political'] },
  { long_name: 'Thailand', short_name: 'TH', types: ['country', 'political'] },
];

const googleOk = (results: unknown[]) => ({ ok: true, json: async () => ({ status: 'OK', results }) });
const googleZeroResults = () => ({ ok: true, json: async () => ({ status: 'ZERO_RESULTS', results: [] }) });

const TEST_KEY = 'test-fake-key-never-leaked';
const GOOGLE_FIXTURES = new Map<string, () => unknown>();

beforeEach(() => {
  GOOGLE_FIXTURES.clear();
  process.env.GOOGLE_GEOCODING_API_KEY = TEST_KEY;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      const u = new URL(url);
      const key = u.searchParams.get('latlng') ?? u.searchParams.get('address') ?? '';
      const factory = GOOGLE_FIXTURES.get(key);
      if (!factory) throw new Error(`test bug: no fixture registered for ${key}`);
      return factory();
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.GOOGLE_GEOCODING_API_KEY;
});

// ===========================================================================
// (a) extractComponent — pure extraction, priority order (the shared copy)
// ===========================================================================
describe('CAM-572 (a) — extractComponent: priority-ordered address-component extraction', () => {
  it('[normal] returns the long_name for the first matching type', () => {
    expect(extractComponent(CNX_FULL_EN, ['administrative_area_level_1'])).toBe('Chiang Mai Province');
  });

  it('[normal] tries types in priority order (sublocality_level_1 before locality)', () => {
    expect(extractComponent(CNX_FULL_EN, ['sublocality_level_1', 'administrative_area_level_3', 'locality'])).toBe('Tambon Si Phum');
  });

  it('[null/empty] no matching type returns null', () => {
    expect(extractComponent(CNX_PROVINCE_ONLY_NO_DISTRICT, ['administrative_area_level_2'])).toBeNull();
  });
});

// ===========================================================================
// (b) callGoogleGeocodeCore — status handling + key safety
// ===========================================================================
describe('CAM-572 (b) — callGoogleGeocodeCore: status handling + key safety', () => {
  it('[normal] OK status returns the full results array, zeroResults:false', async () => {
    GOOGLE_FIXTURES.set('18,99', () => googleOk([{ address_components: CNX_FULL_EN, geometry: { location: { lat: 18, lng: 99 } } }]));
    const result = await callGoogleGeocodeCore({ latlng: '18,99', language: 'th' });
    expect(result).toEqual({ ok: true, zeroResults: false, results: [{ address_components: CNX_FULL_EN, geometry: { location: { lat: 18, lng: 99 } } }] });
  });

  it('[null/empty] ZERO_RESULTS returns zeroResults:true, results:[], never guesses', async () => {
    GOOGLE_FIXTURES.set('22,99', () => googleZeroResults());
    const result = await callGoogleGeocodeCore({ latlng: '22,99' });
    expect(result).toEqual({ ok: true, zeroResults: true, results: [] });
  });

  it('[error/validation] a non-OK Google status is reported, never thrown', async () => {
    GOOGLE_FIXTURES.set('30,99', () => ({ ok: true, json: async () => ({ status: 'REQUEST_DENIED', results: [] }) }));
    const result = await callGoogleGeocodeCore({ latlng: '30,99' });
    expect(result).toEqual({ ok: false, reason: 'google_REQUEST_DENIED' });
  });

  it('[error/validation] a non-OK HTTP response is reported by status code', async () => {
    GOOGLE_FIXTURES.set('31,99', () => ({ ok: false, status: 500 }));
    const result = await callGoogleGeocodeCore({ latlng: '31,99' });
    expect(result).toEqual({ ok: false, reason: 'http_500' });
  });

  it('[error/validation] a network failure is reported by message, never thrown', async () => {
    GOOGLE_FIXTURES.set('32,99', () => {
      throw new Error('simulated network failure');
    });
    const result = await callGoogleGeocodeCore({ latlng: '32,99' });
    expect(result).toEqual({ ok: false, reason: 'simulated network failure' });
  });

  it('[boundary] a missing API key refuses without ever calling fetch', async () => {
    delete process.env.GOOGLE_GEOCODING_API_KEY;
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const result = await callGoogleGeocodeCore({ latlng: '1,1' });
    expect(result).toEqual({ ok: false, reason: 'missing_key' });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('[boundary] region defaults to "th" when the caller does not set one', async () => {
    let capturedUrl = '';
    GOOGLE_FIXTURES.set('40,99', () => ({ ok: true, json: async () => ({ status: 'ZERO_RESULTS', results: [] }) }));
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        capturedUrl = url;
        return { ok: true, json: async () => ({ status: 'ZERO_RESULTS', results: [] }) };
      }),
    );
    await callGoogleGeocodeCore({ latlng: '40,99' });
    expect(new URL(capturedUrl).searchParams.get('region')).toBe('th');
  });

  it('[boundary] an explicit region param overrides the default (superset, never forced)', async () => {
    let capturedUrl = '';
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        capturedUrl = url;
        return { ok: true, json: async () => ({ status: 'ZERO_RESULTS', results: [] }) };
      }),
    );
    await callGoogleGeocodeCore({ address: 'x', region: 'us' });
    expect(new URL(capturedUrl).searchParams.get('region')).toBe('us');
  });

  it('[Critical: key safety] the key-bearing URL never appears in any returned `reason`', async () => {
    GOOGLE_FIXTURES.set('33,99', () => ({ ok: false, status: 500 }));
    const result = await callGoogleGeocodeCore({ latlng: '33,99' });
    expect(JSON.stringify(result)).not.toContain(TEST_KEY);
    expect(JSON.stringify(result)).not.toContain('maps.googleapis.com');
  });
});

// ===========================================================================
// (c) Consolidation proof — one shared wrapper, both scripts delegate to it
// ===========================================================================
describe('CAM-572 (c) — consolidation: the scripts no longer hand-roll their own fetch/endpoint', () => {
  it('the Google Geocoding endpoint literal is defined in exactly 1 place repo-wide (CAM-585 finished the consolidation: app/api/geocode/_shared.ts no longer has its own copy)', () => {
    const searchRoots = ['app', 'lib', 'scripts'];
    let count = 0;
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
        const rel = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(rel);
        else if (entry.name.endsWith('.ts') || entry.name.endsWith('.mjs')) {
          const text = src(rel);
          if (text.includes("GOOGLE_GEOCODE_ENDPOINT = 'https://maps.googleapis.com")) {
            count += 1;
            files.push(rel);
          }
        }
      }
    };
    searchRoots.forEach(walk);
    expect(files.sort()).toEqual(['lib/geo/google-geocode.ts']);
    expect(count).toBe(1);
  });

  it('scripts/backfill-cam-562-subdistrict-geocode.mjs delegates to callGoogleGeocodeCore, no local endpoint const', () => {
    const text = src('scripts/backfill-cam-562-subdistrict-geocode.mjs');
    expect(text).toContain('callGoogleGeocodeCore');
    expect(text).not.toContain("GOOGLE_GEOCODE_ENDPOINT = 'https://maps.googleapis.com");
  });

  it('scripts/backfill-cam-571-coordinates-inside-thailand.mjs delegates to callGoogleGeocodeCore, no local endpoint const', () => {
    const text = src('scripts/backfill-cam-571-coordinates-inside-thailand.mjs');
    expect(text).toContain('callGoogleGeocodeCore');
    expect(text).not.toContain("GOOGLE_GEOCODE_ENDPOINT = 'https://maps.googleapis.com");
  });

  it('[behavioral] the two scripts\' own wrapped functions still resolve correctly end-to-end through the shared core', async () => {
    GOOGLE_FIXTURES.set('18.79,98.98', () => googleOk([{ address_components: CNX_FULL_EN, geometry: { location: { lat: 18.79, lng: 98.98 } } }]));
    GOOGLE_FIXTURES.set('เชียงใหม่, Thailand', () => googleOk([{ address_components: [], geometry: { location: { lat: 18.79, lng: 98.98 } } }]));

    const reverseResult = await cam562CallGoogleGeocode(18.79, 98.98);
    expect(reverseResult).toEqual({ ok: true, zeroResults: false, components: CNX_FULL_EN });

    const forwardResult = await cam571CallGoogleGeocodeForward('เชียงใหม่, Thailand');
    expect(forwardResult).toEqual({ ok: true, zeroResults: false, lat: 18.79, lon: 98.98 });
  });
});

// ===========================================================================
// (d) Key safety — the key is never client-reachable (repo-wide invariant)
// ===========================================================================
describe('CAM-572 (d) security: GOOGLE_GEOCODING_API_KEY is never client-reachable', () => {
  it('the key is read ONLY in lib/geo/google-geocode.ts and app/api/geocode/_shared.ts, never in any client component', () => {
    expect(src('lib/geo/google-geocode.ts')).toContain('process.env.GOOGLE_GEOCODING_API_KEY');
    expect(src('components/LocationPicker.tsx')).not.toContain('GOOGLE_GEOCODING_API_KEY');
    expect(src('components/LocationMapPin.tsx')).not.toContain('GOOGLE_GEOCODING_API_KEY');
    expect(src('components/CampgroundForm.tsx')).not.toContain('GOOGLE_GEOCODING_API_KEY');
  });

  it('the key is never NEXT_PUBLIC_-prefixed anywhere in the consolidated module', () => {
    expect(src('lib/geo/google-geocode.ts')).not.toContain('NEXT_PUBLIC_GOOGLE');
  });

  it('[Critical] a missing key never leaks anything beyond {ok:false, reason} for either script wrapper, and never calls fetch', async () => {
    delete process.env.GOOGLE_GEOCODING_API_KEY;
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const reverseResult = await cam562CallGoogleGeocode(1, 1);
    expect(reverseResult).toEqual({ ok: false, reason: 'missing_key' });

    const forwardResult = await cam571CallGoogleGeocodeForward('x');
    expect(forwardResult).toEqual({ ok: false, reason: 'missing_key' });

    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

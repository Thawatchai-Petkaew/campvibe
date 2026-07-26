/**
 * cam-554-map-pin-sync.test.ts — CAM-554
 *
 * Story: a draggable Leaflet map pin replaces the raw latitude/longitude
 * number inputs and stays two-way synced with CAM-559's cascading province/
 * district/sub-district selects; a disagreement between the two is
 * reconciled VISIBLY (a banner + accept/decline), never silently
 * overwritten either direction.
 *
 * Layer: source-inspection (fs.readFileSync) — components/LocationPicker.tsx,
 * components/LocationMapPin.tsx and components/CampgroundForm.tsx have no
 * isolated render harness (node environment, no jsdom — vitest.config.ts),
 * same precedent as __tests__/cam-356-form-validation-ux.test.ts and
 * __tests__/cam-358-image-url-contract.test.ts.
 *
 * AC coverage:
 *   AC-1  a draggable Leaflet pin replaces the raw lat/lon inputs as the
 *         PRIMARY control, loaded lazily (IntersectionObserver + dynamic
 *         ssr:false); the old always-13.7563/100.5018 default is gone
 *   AC-2  pin<->selects two-way sync: dropping/dragging the pin resolves all
 *         three levels; choosing a level moves the pin; a disagreement is
 *         surfaced via a banner (accept/decline), never silently applied
 *   AC-3  cost control: debounced calls, no auto-fire on mount, skip-if-
 *         unchanged forward geocode, requireAuth-gated (billed per request)
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import translations from '@/locales/translations.json';

const root = path.resolve(__dirname, '..');
const src = (rel: string) => fs.readFileSync(path.join(root, rel), 'utf-8');

const pickerSrc = src('components/LocationPicker.tsx');
const mapPinSrc = src('components/LocationMapPin.tsx');
const formSrc = src('components/CampgroundForm.tsx');
const envConfigSrc = src('.claude/ENV-CONFIG.md');

// ---------------------------------------------------------------------------
// AC-1: no more invisible Bangkok default
// ---------------------------------------------------------------------------
describe('AC-1: the old silent 13.7563/100.5018 default is gone', () => {
    it('CampgroundForm no longer defaults `latitude`/`longitude` state to 13.7563/100.5018', () => {
        expect(formSrc).not.toMatch(/latitude:\s*13\.7563/);
        expect(formSrc).not.toMatch(/longitude:\s*100\.5018/);
    });

    it('create-mode defaults to "" (no pin) and edit-mode falls back to "" (never 13.7563/100.5018)', () => {
        expect(formSrc).toMatch(/latitude:\s*"" as number \| string/);
        expect(formSrc).toMatch(/latitude:\s*initialData\.latitude\s*\?\?\s*""/);
        expect(formSrc).toMatch(/longitude:\s*initialData\.longitude\s*\?\?\s*""/);
    });

    it('handleSubmit blocks an unpinned location instead of silently coalescing to (0,0)', () => {
        expect(formSrc).toMatch(/formData\.latitude === "" \|\| formData\.longitude === ""/);
        expect(formSrc).toContain('pinRequiredError');
    });

    it('the schema-required lat/lon InputFields (CAM-358 honesty marker) are preserved unchanged', () => {
        // Same exact snippet cam-358-image-url-contract.test.ts pins — proves this
        // story did not silently weaken/remove the required marker while adding the map.
        expect(formSrc).toContain('label={t.newCampground.latitude}\n                                        required');
        expect(formSrc).toContain('label={t.newCampground.longitude}\n                                        required');
    });
});

describe('AC-1: draggable Leaflet pin, lazy-loaded', () => {
    it('LocationMapPin reuses react-leaflet/leaflet exactly as MapComponent.tsx does (no new map library)', () => {
        expect(mapPinSrc).toContain("from \"react-leaflet\"");
        expect(mapPinSrc).toContain('import "leaflet/dist/leaflet.css"');
    });

    it('the marker is draggable and click-to-place is wired', () => {
        expect(mapPinSrc).toContain('draggable');
        expect(mapPinSrc).toContain('dragend');
        expect(mapPinSrc).toContain('useMapEvents');
    });

    it('no pin (latitude/longitude both null) renders an EMPTY state, never a pre-placed marker', () => {
        expect(mapPinSrc).toContain('hasPin');
        expect(mapPinSrc).toContain('data-testid="empty--location-map-pin"');
    });

    it('LocationPicker dynamic-imports the map with ssr:false (App Router requirement)', () => {
        expect(pickerSrc).toMatch(/dynamic\(\(\) => import\(['"]@\/components\/LocationMapPin['"]\)/);
        expect(pickerSrc).toContain('ssr: false');
    });

    it('the map only mounts once the section is scrolled into view (IntersectionObserver, lazy per AC-1)', () => {
        expect(pickerSrc).toContain('IntersectionObserver');
        expect(pickerSrc).toContain('mapVisible');
        expect(pickerSrc).toMatch(/\{mapVisible && \(/);
    });
});

// ---------------------------------------------------------------------------
// AC-2: two-way sync + visible reconciliation
// ---------------------------------------------------------------------------
describe('AC-2: dropping/dragging the pin resolves all three levels', () => {
    it('handlePinChange calls the reverse-geocode endpoint', () => {
        expect(pickerSrc).toContain('/api/geocode/reverse?lat=');
    });

    it('applyResolvedPin sets all THREE select levels + calls onChange (proves "all three levels update")', () => {
        const fnMatch = pickerSrc.match(/const applyResolvedPin = useCallback\(\s*\(resolved[\s\S]*?\n    \);/);
        expect(fnMatch).not.toBeNull();
        const body = fnMatch![0];
        expect(body).toContain('setSelectedProvince(resolved.province)');
        expect(body).toContain('setSelectedDistrict(resolved.district)');
        expect(body).toContain('setSelectedSubDistrict(resolved.subDistrict)');
        expect(body).toContain('onChange(deriveValue(resolved.province, resolved.district, resolved.subDistrict))');
    });

    it('an EMPTY current selection adopts the resolved pin silently (nothing to lose)', () => {
        expect(pickerSrc).toContain('hasCurrentSelection');
        expect(pickerSrc).toMatch(/if \(hasCurrentSelection && differs\)/);
    });

    it('BR-9 Prove-It: reconciliation reads the REAL current text (formData props), not just the untouched-on-mount combobox state', () => {
        // The bug this guards: LocationPicker's own `selectedProvince` resets to
        // null on every mount (a pre-existing CAM-559 gap) - on an EDIT page,
        // `formData.province` is already the real saved value even before any
        // combobox is touched. Comparing against `selectedProvince` ALONE would
        // read that as "nothing to lose" and silently overwrite a real value.
        expect(pickerSrc).toContain('province: string;');
        expect(pickerSrc).toContain('district: string;');
        expect(pickerSrc).toContain('subDistrict: string;');
        expect(pickerSrc).toContain('const currentProvinceText = selectedProvince');
        expect(pickerSrc).toContain(': province;');
        expect(pickerSrc).not.toMatch(/const differs =\s*\n\s*\(selectedProvince\?\.id/); // the OLD, buggy id-only comparison
    });

    it('BR-9: a level with no current value adopts the resolved value directly (per-level, not all-or-nothing)', () => {
        expect(pickerSrc).toMatch(/\(!!currentProvinceText && currentProvinceText !== resolvedText\.province\)/);
        expect(pickerSrc).toMatch(/\(!!currentDistrictText && currentDistrictText !== resolvedText\.district\)/);
    });

    it('CampgroundForm passes the real formData province/district/subDistrict into LocationPicker (closes the bug)', () => {
        expect(formSrc).toMatch(/province=\{formData\.province\}/);
        expect(formSrc).toMatch(/district=\{formData\.district\}/);
        expect(formSrc).toMatch(/subDistrict=\{formData\.subDistrict\}/);
    });
});

describe('AC-2: choosing a level moves the pin', () => {
    it('the forward-geocode effect calls the forward endpoint', () => {
        expect(pickerSrc).toContain('/api/geocode/forward?');
    });

    it('no current pin adopts the resolved coordinates silently (nothing to lose)', () => {
        expect(pickerSrc).toMatch(/if \(!hasCurrentPin\) \{\s*\n\s*onChange\(\{ \.\.\.deriveValue\(selectedProvince, selectedDistrict, selectedSubDistrict\), latitude: resolvedLat, longitude: resolvedLon \}\);/);
    });

    it('reverse-geocode-derived selection changes suppress an immediate echo forward-geocode call', () => {
        expect(pickerSrc).toContain('suppressForwardRef');
    });
});

describe('AC-2: a disagreement surfaces to the host rather than overwriting silently', () => {
    it('a pin resolving to a DIFFERENT existing selection sets a conflict, never silently applies it', () => {
        // The conflict branch (`setConflict`) is a SIBLING of the silent-adopt branch
        // (`applyResolvedPin`), never the same call - proves the silent-overwrite path
        // and the surfaced-conflict path are mutually exclusive.
        expect(pickerSrc).toMatch(/if \(hasCurrentSelection && differs\) \{\s*\n\s*setConflict\(\{ kind: 'pin', resolved: data \}\);\s*\n\s*\} else \{\s*\n\s*applyResolvedPin\(data\);/);
    });

    it('an existing pin that moved far sets a conflict, never silently moves it', () => {
        expect(pickerSrc).toMatch(/\} else if \(movedFar\) \{\s*\n\s*setConflict\(\{ kind: 'selects', resolved: \{ lat: resolvedLat, lon: resolvedLon \} \}\);/);
    });

    it('the conflict banner renders BOTH accept and decline, never auto-resolving', () => {
        expect(pickerSrc).toContain('data-testid="banner--location-reconcile"');
        expect(pickerSrc).toContain('data-testid="btn--location-reconcile-accept"');
        expect(pickerSrc).toContain('data-testid="btn--location-reconcile-decline"');
        expect(pickerSrc).toContain('t.common.accept');
        expect(pickerSrc).toContain('t.common.decline');
    });

    it('accept/decline buttons meet the 44px tap-floor (size="default", not "sm")', () => {
        const acceptLine = pickerSrc.split('\n').find((l) => l.includes('btn--location-reconcile-accept'));
        const declineLine = pickerSrc.split('\n').find((l) => l.includes('btn--location-reconcile-decline'));
        expect(acceptLine).toContain('size="default"');
        expect(declineLine).toContain('size="default"');
    });

    it('the conflict banner is announced (role=status, aria-live=polite) without auto-dismissing', () => {
        expect(pickerSrc).toMatch(/\{conflict && \(\s*\n\s*<div\s*\n\s*role="status"\s*\n\s*aria-live="polite"/);
    });
});

// ---------------------------------------------------------------------------
// AC-3: cost control
// ---------------------------------------------------------------------------
describe('AC-3: cost control (Google Geocoding bills per request)', () => {
    it('both directions are debounced (shared GEOCODE_DEBOUNCE_MS constant, not two magic numbers)', () => {
        expect(pickerSrc).toContain('GEOCODE_DEBOUNCE_MS = 300');
        const debounceUses = pickerSrc.match(/GEOCODE_DEBOUNCE_MS\)/g) || [];
        expect(debounceUses.length).toBeGreaterThanOrEqual(2); // reverse timer + forward timer
    });

    it('the forward-geocode effect skips re-firing when the resolved address is unchanged since the last call', () => {
        expect(pickerSrc).toContain('lastForwardQueryRef');
        expect(pickerSrc).toMatch(/if \(queryKey === lastForwardQueryRef\.current\) return;/);
    });

    it('a pin move only re-fires the forward geocode past a real-distance threshold (never a no-op)', () => {
        expect(pickerSrc).toContain('PIN_MOVE_THRESHOLD_DEGREES');
    });

    it('both geocode fetches are gated behind requireAuth on the server (never left open like /api/locations/search)', () => {
        const reverseRouteSrc = src('app/api/geocode/reverse/route.ts');
        const forwardRouteSrc = src('app/api/geocode/forward/route.ts');
        expect(reverseRouteSrc).toContain('requireAuth');
        expect(forwardRouteSrc).toContain('requireAuth');
    });

    it('no geocode call fires on mount for either direction (only on an explicit pin/select action)', () => {
        // The reverse call only ever appears inside handlePinChange's debounced
        // timeout body, never inside a bare mount-only useEffect([]) with no guard.
        expect(pickerSrc).not.toMatch(/useEffect\(\(\) => \{\s*\n\s*fetch\(`\/api\/geocode\/reverse/);
    });
});

// ---------------------------------------------------------------------------
// i18n — every copy lives in locales/, TH+EN, no hardcoded strings
// ---------------------------------------------------------------------------
describe('i18n: CAM-554 locale keys exist in both languages', () => {
    const en = (translations as any).en;
    const th = (translations as any).th;

    const LOCATION_PICKER_KEYS = [
        'mapAriaLabel', 'mapEmptyHint', 'mapCoordinatesLabel', 'mapLocating',
        'mapGeocodeError', 'conflictPinFoundBody', 'conflictSelectionMovedBody',
        'manualCoordinatesLabel',
    ];

    LOCATION_PICKER_KEYS.forEach((key) => {
        it(`locationPicker.${key} exists in EN and TH`, () => {
            expect(en.locationPicker[key]).toBeTruthy();
            expect(th.locationPicker[key]).toBeTruthy();
        });
    });

    it('newCampground.pinRequiredError exists in EN and TH', () => {
        expect(en.newCampground.pinRequiredError).toBeTruthy();
        expect(th.newCampground.pinRequiredError).toBeTruthy();
    });

    it('no em-dash (—) in the new Thai copy', () => {
        LOCATION_PICKER_KEYS.forEach((key) => {
            expect(th.locationPicker[key]).not.toContain('—');
        });
        expect(th.newCampground.pinRequiredError).not.toContain('—');
    });

    it('LocationPicker/LocationMapPin pull copy from t.locationPicker, never a hardcoded string prop', () => {
        expect(pickerSrc).toContain('t.locationPicker.mapAriaLabel');
        expect(pickerSrc).toContain('t.locationPicker.mapEmptyHint');
        expect(pickerSrc).toContain('t.locationPicker.mapGeocodeError');
    });
});

// ---------------------------------------------------------------------------
// Design contract — token-only, no stray hex/dark:, matches the f4-forms-
// operator.test.ts scan already applied to the other 7 host-form files.
// ---------------------------------------------------------------------------
describe('design gate: token-only (no stray hex/dark:) on the new/changed CAM-554 surface', () => {
    const FORBIDDEN: Array<[string, RegExp]> = [
        ['hex color', /#[0-9a-fA-F]{3,6}\b/],
        ['dark:bg-*', /dark:bg-/],
        ['dark:text-*', /dark:text-/],
        ['dark:ring-*', /dark:ring-/],
        ['dark:border-*', /dark:border-/],
        ['bg-gray-N', /\bbg-gray-\d/],
        ['text-gray-N', /\btext-gray-\d/],
    ];

    [
        ['LocationPicker.tsx', pickerSrc],
        ['LocationMapPin.tsx', mapPinSrc],
    ].forEach(([name, fileSrc]) => {
        FORBIDDEN.forEach(([label, pattern]) => {
            it(`${name} has no ${label}`, () => {
                expect(fileSrc as string).not.toMatch(pattern);
            });
        });
    });
});

// ---------------------------------------------------------------------------
// Env config — the new server key must be documented before it's forgotten
// at promote time (CAM-422/CRON_SECRET lesson).
// ---------------------------------------------------------------------------
describe('ENV-CONFIG.md carries GOOGLE_GEOCODING_API_KEY (CAM-554)', () => {
    it('the new row exists and is marked server-only / never NEXT_PUBLIC_', () => {
        expect(envConfigSrc).toContain('GOOGLE_GEOCODING_API_KEY');
        expect(envConfigSrc).not.toContain('NEXT_PUBLIC_GOOGLE_GEOCODING');
    });
});

// ---------------------------------------------------------------------------
// a11y
// ---------------------------------------------------------------------------
describe('a11y: LocationMapPin', () => {
    it('the map container has an accessible name (role=group + aria-label)', () => {
        expect(mapPinSrc).toContain('role="group"');
        expect(mapPinSrc).toContain('aria-label={ariaLabel}');
    });

    it('the locating indicator is announced (role=status, aria-live=polite)', () => {
        expect(mapPinSrc).toMatch(/role="status"\s*\n\s*aria-live="polite"/);
    });

    it('visible focus ring on the map container (keyboard nav)', () => {
        expect(mapPinSrc).toContain('focus-within:ring-2');
    });
});

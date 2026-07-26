'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import { Check, ChevronsUpDown, Search, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from '@/components/ui/command';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { useLanguage } from '@/contexts/LanguageContext';
import { geocodeReverseResultSchema, geocodeForwardResultSchema } from '@/lib/validations/location';

// CAM-554: Leaflet needs `ssr:false` in the App Router (same fix
// components/CampgroundDetailClient.tsx already applies to MapComponent) -
// reused here, not reinvented. `dynamic()` alone only means "own chunk, no
// SSR"; the component below still conditionally-mounts `<LocationMapPin>`
// only once this section is scrolled into view (IntersectionObserver, same
// precedent as components/InfiniteScrollGrid.tsx), so the Leaflet chunk
// never downloads for a host who never reaches the Location card.
const LocationMapPin = dynamic(() => import('@/components/LocationMapPin'), {
    ssr: false,
    loading: () => <div className="w-full h-64 sm:h-80 rounded-xl bg-muted animate-pulse" />,
});

// CAM-554: debounce window for both the reverse (pin -> selects) and forward
// (selects -> pin) geocode calls - matches the pre-existing 300ms search-box
// debounce below (one shared cost-control constant, not two magic numbers).
const GEOCODE_DEBOUNCE_MS = 300;
// A forward-geocode re-fires only once the resolved address string changes
// or the pin moved more than ~1.1km (0.01 degree) from the last resolved
// point - never on a no-op re-render (cost control; Google bills per call).
const PIN_MOVE_THRESHOLD_DEGREES = 0.01;

/**
 * CAM-559 — cascading province -> district -> sub-district picker, replacing
 * the old flat single-search list. Each level is independently searchable
 * (Thai is the primary search path) and strictly narrows the next.
 *
 * Data sourcing (all three levels read `AdminArea`; see tech.md):
 *  - Province + district read `/api/locations/search`, which CAM-574
 *    retired off `ThailandLocation` onto `AdminArea` directly (no more
 *    id-bridge) — `Location.province`'s stored free-text value/derivation
 *    is untouched by that move (`lib/campsite-filters.ts`'s exact-equality
 *    province filter, CAM-531's province dropdown, and CAM-545's Thai-name
 *    lookup all still depend on that stored string, not on this endpoint's
 *    `id`).
 *  - Sub-district reads `/api/admin-areas/subdistricts` (AdminArea) —
 *    the ONE level `ThailandLocation` could never hold (no column).
 *
 * `adminAreaId` (the deepest AdminArea node actually picked — sub-district,
 * else district, else province) is what this component sends to
 * `CampgroundForm.tsx` → `POST /api/location`; CAM-574 retired the earlier
 * `thaiLocationId` field this used to carry.
 *
 * Scale: every fetch is scoped (province: up to 20 rows: the existing
 * endpoint's own cap; district: scoped to the selected province; sub-
 * district: scoped to the selected district) — never the full 77/930/7,452
 * row tables in one payload. Each level's list only loads once its popover
 * opens (lazy) and its query is debounced (300ms, matches the prior list).
 */

/**
 * The row shape `/api/locations/search` returns and the geocode-reverse
 * `province`/`district` fields share (`thailandLocationRowSchema`). Name kept
 * as-is post-CAM-574 (renaming would ripple into the geocode response type,
 * out of this story's surface) — `id` is now an `AdminArea.id` when this row
 * comes from `/api/locations/search`, but stays a `ThailandLocation.id` when
 * it comes from geocode-reverse (untouched by this story); this component
 * never reads `.id` off a geocode-reverse row (see `applyResolvedPin`).
 */
interface ThailandLocationRow {
    id: string;
    provinceCode: string;
    provinceName: string;
    provinceNameEn: string;
    districtCode: string | null;
    districtName: string | null;
    districtNameEn: string | null;
}

interface SubDistrictRow {
    id: string;
    code: string;
    nameTh: string;
    nameEn: string;
    parentId: string | null;
}

export interface LocationPickerValue {
    /** Display text in the CURRENT UI language — same derivation CampgroundForm always used. */
    province: string;
    district: string;
    subDistrict: string;
    /**
     * CAM-574: the deepest `AdminArea` node actually resolved (sub-district,
     * else district, else province, else '') — replaces the retired
     * `thaiLocationId` (a `ThailandLocation.id`). For a cascading-select pick
     * this is simply the picked row's `id` (already an `AdminArea.id` post-
     * CAM-574 — see `/api/locations/search`); for a map pin-drop it is the
     * geocode-reverse response's own top-level `adminAreaId` (NEVER the
     * `province`/`district` sub-objects' `.id`, which stay `ThailandLocation`
     * ids for that endpoint — see `applyResolvedPin` below).
     */
    adminAreaId: string;
    /**
     * CAM-554: present only when this change ALSO moves the pin (a map
     * click/drag, or an accepted reconciliation) - CampgroundForm merges
     * whatever keys arrive (`{...prev, ...value}`), so a plain combobox pick
     * that never touches the pin simply omits these two.
     */
    latitude?: number;
    longitude?: number;
}

interface LocationPickerProps {
    onChange: (value: LocationPickerValue) => void;
    className?: string;
    /** CAM-554: the current pin, controlled by CampgroundForm's formData. `null` = no pin yet
     *  (the old silent 13.7563/100.5018 Bangkok default no longer exists - see CampgroundForm.tsx). */
    latitude: number | null;
    longitude: number | null;
    /**
     * CAM-554: the current province/district/subDistrict TEXT, controlled by
     * CampgroundForm's formData - NOT derived from this component's own
     * `selectedProvince` combobox state, which resets to null on every mount
     * (a pre-existing CAM-559 gap: editing a camp never pre-seeds these
     * comboboxes, even though `formData.province` etc. already hold the real
     * saved value). Without these props, dragging the pin on an EDIT page
     * before ever touching a combobox would see `selectedProvince === null`
     * and treat a real, already-saved selection as "nothing to lose" -
     * silently overwriting it. Used ONLY for the reconciliation text
     * comparison below; the comboboxes' own visual state is unaffected.
     */
    province: string;
    district: string;
    subDistrict: string;
}

export function LocationPicker({ onChange, className, latitude, longitude, province, district, subDistrict }: LocationPickerProps) {
    const { language, t } = useLanguage();

    // Province level
    const [provinceOpen, setProvinceOpen] = useState(false);
    const [provinceQuery, setProvinceQuery] = useState('');
    const [provinceOptions, setProvinceOptions] = useState<ThailandLocationRow[]>([]);
    const [provinceLoading, setProvinceLoading] = useState(false);
    const [selectedProvince, setSelectedProvince] = useState<ThailandLocationRow | null>(null);

    // District level — locked until a province is selected
    const [districtOpen, setDistrictOpen] = useState(false);
    const [districtQuery, setDistrictQuery] = useState('');
    const [districtOptions, setDistrictOptions] = useState<ThailandLocationRow[]>([]);
    const [districtLoading, setDistrictLoading] = useState(false);
    const [selectedDistrict, setSelectedDistrict] = useState<ThailandLocationRow | null>(null);

    // Sub-district level — locked until a district is selected
    const [subDistrictOpen, setSubDistrictOpen] = useState(false);
    const [subDistrictQuery, setSubDistrictQuery] = useState('');
    const [subDistrictOptions, setSubDistrictOptions] = useState<SubDistrictRow[]>([]);
    const [subDistrictLoading, setSubDistrictLoading] = useState(false);
    const [selectedSubDistrict, setSelectedSubDistrict] = useState<SubDistrictRow | null>(null);

    // CAM-554: map pin <-> cascading-select two-way sync.
    const [isLocating, setIsLocating] = useState(false); // reverse-geocode in flight (pin -> selects)
    const [geocodeError, setGeocodeError] = useState<string | null>(null);
    // A disagreement between the pin and the current selection, surfaced to the
    // host rather than silently overwritten either way (AC-2).
    const [conflict, setConflict] = useState<
        | { kind: 'pin'; resolved: { province: ThailandLocationRow | null; district: ThailandLocationRow | null; subDistrict: SubDistrictRow | null; adminAreaId: string | null } }
        | { kind: 'selects'; resolved: { lat: number; lon: number } }
        | null
    >(null);

    const reverseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const forwardTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    // The last address string a forward-geocode call was actually made for -
    // skips a re-fire when the resolved address hasn't changed (cost control).
    const lastForwardQueryRef = useRef<string | null>(null);
    // Set right before a reverse-geocode resolution updates the selects, so the
    // forward-geocode effect below (which watches those same select states)
    // does not immediately re-geocode the pin it was JUST derived from.
    const suppressForwardRef = useRef(false);

    // CAM-554: lazy-load - the map's own chunk (`dynamic(..., {ssr:false})`
    // above) only mounts once this Location card is actually scrolled into
    // view, so a host who never reaches it never downloads the Leaflet chunk.
    const [mapVisible, setMapVisible] = useState(false);
    const mapSectionRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const el = mapSectionRef.current;
        if (!el || mapVisible) return;
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0]?.isIntersecting) {
                    setMapVisible(true);
                    observer.disconnect();
                }
            },
            { rootMargin: '200px' }
        );
        observer.observe(el);
        return () => observer.disconnect();
    }, [mapVisible]);

    useEffect(() => {
        return () => {
            if (reverseTimerRef.current) clearTimeout(reverseTimerRef.current);
            if (forwardTimerRef.current) clearTimeout(forwardTimerRef.current);
        };
    }, []);

    const deriveValue = useCallback(
        (
            province: ThailandLocationRow | null,
            district: ThailandLocationRow | null,
            subDistrict: SubDistrictRow | null,
            /**
             * CAM-574: override for the pin-drop path — the geocode-reverse
             * response's OWN `adminAreaId` (already a real `AdminArea.id`),
             * never derived from `province`/`district`'s `.id` there (those
             * stay `ThailandLocation` ids for that endpoint, untouched by
             * this story). Omitted for a cascading-select pick, where
             * `province`/`district`/`subDistrict`'s own `.id` IS already an
             * `AdminArea.id` (post-CAM-574 `/api/locations/search`).
             */
            overrideAdminAreaId?: string | null
        ): LocationPickerValue => ({
            province: province ? (language === 'th' ? province.provinceName : province.provinceNameEn) : '',
            district: district ? (language === 'th' ? (district.districtName || '') : (district.districtNameEn || '')) : '',
            subDistrict: subDistrict ? (language === 'th' ? subDistrict.nameTh : subDistrict.nameEn) : '',
            adminAreaId: overrideAdminAreaId ?? (subDistrict?.id || district?.id || province?.id || ''),
        }),
        [language]
    );

    // Province search — fetches only while its own popover is open (on-demand, per level).
    useEffect(() => {
        if (!provinceOpen) return;
        setProvinceLoading(true);
        const timer = setTimeout(async () => {
            try {
                const res = await fetch(`/api/locations/search?type=province&q=${encodeURIComponent(provinceQuery)}`);
                const data = await res.json();
                setProvinceOptions(Array.isArray(data) ? data : []);
            } catch (err) {
                console.error('Failed to fetch provinces', err);
                setProvinceOptions([]);
            } finally {
                setProvinceLoading(false);
            }
        }, 300);
        return () => clearTimeout(timer);
    }, [provinceOpen, provinceQuery]);

    // District search — scoped to the selected province's code; never offers
    // every one of the 930 districts nationwide.
    useEffect(() => {
        if (!districtOpen || !selectedProvince) return;
        setDistrictLoading(true);
        const timer = setTimeout(async () => {
            try {
                const res = await fetch(
                    `/api/locations/search?type=district&provinceCode=${encodeURIComponent(selectedProvince.provinceCode)}&q=${encodeURIComponent(districtQuery)}`
                );
                const data = await res.json();
                setDistrictOptions(Array.isArray(data) ? data : []);
            } catch (err) {
                console.error('Failed to fetch districts', err);
                setDistrictOptions([]);
            } finally {
                setDistrictLoading(false);
            }
        }, 300);
        return () => clearTimeout(timer);
    }, [districtOpen, districtQuery, selectedProvince]);

    // Sub-district search — scoped to the selected district's code.
    useEffect(() => {
        if (!subDistrictOpen || !selectedDistrict?.districtCode) return;
        setSubDistrictLoading(true);
        const timer = setTimeout(async () => {
            try {
                const res = await fetch(
                    `/api/admin-areas/subdistricts?districtCode=${encodeURIComponent(selectedDistrict.districtCode || '')}&q=${encodeURIComponent(subDistrictQuery)}`
                );
                const data = await res.json();
                setSubDistrictOptions(Array.isArray(data) ? data : []);
            } catch (err) {
                console.error('Failed to fetch sub-districts', err);
                setSubDistrictOptions([]);
            } finally {
                setSubDistrictLoading(false);
            }
        }, 300);
        return () => clearTimeout(timer);
    }, [subDistrictOpen, subDistrictQuery, selectedDistrict]);

    const handleSelectProvince = (row: ThailandLocationRow) => {
        setSelectedProvince(row);
        setSelectedDistrict(null);
        setSelectedSubDistrict(null);
        setDistrictQuery('');
        setSubDistrictQuery('');
        setDistrictOptions([]);
        setSubDistrictOptions([]);
        setProvinceOpen(false);
        setProvinceQuery('');
        onChange(deriveValue(row, null, null));
    };

    const handleSelectDistrict = (row: ThailandLocationRow) => {
        setSelectedDistrict(row);
        setSelectedSubDistrict(null);
        setSubDistrictQuery('');
        setSubDistrictOptions([]);
        setDistrictOpen(false);
        setDistrictQuery('');
        onChange(deriveValue(selectedProvince, row, null));
    };

    const handleSelectSubDistrict = (row: SubDistrictRow) => {
        setSelectedSubDistrict(row);
        setSubDistrictOpen(false);
        setSubDistrictQuery('');
        onChange(deriveValue(selectedProvince, selectedDistrict, row));
    };

    // Applies a reverse-geocode resolution to the three comboboxes. Marks
    // `suppressForwardRef` first so the forward-geocode effect below (which
    // watches these same select states) does not immediately re-fire a
    // geocode call for the pin this resolution was JUST derived from.
    const applyResolvedPin = useCallback(
        (resolved: { province: ThailandLocationRow | null; district: ThailandLocationRow | null; subDistrict: SubDistrictRow | null; adminAreaId: string | null }) => {
            suppressForwardRef.current = true;
            setSelectedProvince(resolved.province);
            setSelectedDistrict(resolved.district);
            setSelectedSubDistrict(resolved.subDistrict);
            setDistrictQuery('');
            setSubDistrictQuery('');
            // CAM-574: pass the geocode response's OWN `adminAreaId` through as the
            // override — `resolved.province`/`district` here still carry
            // ThailandLocation ids (that response shape is untouched by this
            // story), so deriving from THEIR `.id` would send the wrong id space.
            onChange(deriveValue(resolved.province, resolved.district, resolved.subDistrict, resolved.adminAreaId));
        },
        [onChange, deriveValue]
    );

    // Pin dropped/dragged (AC-2): update the pin immediately, then - debounced,
    // never on every intermediate drag frame since `dragend`/`click` each fire
    // once per discrete action - reverse-geocode it server-side. A disagreement
    // with an EXISTING selection is surfaced as a conflict, never silently
    // overwritten; an empty selection just adopts the resolved value.
    const handlePinChange = useCallback(
        (lat: number, lon: number) => {
            setGeocodeError(null);
            onChange({ ...deriveValue(selectedProvince, selectedDistrict, selectedSubDistrict), latitude: lat, longitude: lon });

            if (reverseTimerRef.current) clearTimeout(reverseTimerRef.current);
            reverseTimerRef.current = setTimeout(async () => {
                setIsLocating(true);
                try {
                    const res = await fetch(`/api/geocode/reverse?lat=${lat}&lon=${lon}`);
                    if (!res.ok) {
                        setGeocodeError(t.locationPicker.mapGeocodeError);
                        return;
                    }
                    // Typed boundary - validate the fetched shape before trusting it
                    // (network I/O is an input boundary like any other, code.md).
                    const parsed = geocodeReverseResultSchema.safeParse(await res.json());
                    if (!parsed.success || !parsed.data.province) {
                        setGeocodeError(t.locationPicker.mapGeocodeError);
                        return;
                    }
                    const data = parsed.data;
                    // Text-based comparison, not `selectedProvince?.id` - this
                    // component's own combobox state resets to null on every
                    // mount (a pre-existing CAM-559 gap), but on an EDIT page
                    // `formData.province`/etc (the `province`/`district`/
                    // `subDistrict` props) already hold the real saved value
                    // even before the host ever touches a combobox. Falling
                    // back to `selectedProvince?.id` alone would read an
                    // untouched-but-already-saved selection as "nothing to
                    // lose" and silently overwrite it - exactly the bug this
                    // story's AC forbids.
                    const currentProvinceText = selectedProvince ? (language === 'th' ? selectedProvince.provinceName : selectedProvince.provinceNameEn) : province;
                    const currentDistrictText = selectedDistrict ? (language === 'th' ? (selectedDistrict.districtName || '') : (selectedDistrict.districtNameEn || '')) : district;
                    const currentSubDistrictText = selectedSubDistrict ? (language === 'th' ? selectedSubDistrict.nameTh : selectedSubDistrict.nameEn) : subDistrict;
                    const resolvedText = deriveValue(data.province, data.district, data.subDistrict);
                    const hasCurrentSelection = !!(currentProvinceText || currentDistrictText || currentSubDistrictText);
                    // Per-level comparison (BR-9): a level with NO current value has
                    // nothing to lose and always adopts the resolved value; only a
                    // level that already has a value becomes a conflict when it would
                    // actually change - picking only a province so far and dragging
                    // the pin into a specific district must not pop a conflict banner
                    // over the district/sub-district, which were never chosen at all.
                    const differs =
                        (!!currentProvinceText && currentProvinceText !== resolvedText.province) ||
                        (!!currentDistrictText && currentDistrictText !== resolvedText.district) ||
                        (!!currentSubDistrictText && currentSubDistrictText !== resolvedText.subDistrict);
                    if (hasCurrentSelection && differs) {
                        setConflict({ kind: 'pin', resolved: data });
                    } else {
                        applyResolvedPin(data);
                    }
                } catch {
                    setGeocodeError(t.locationPicker.mapGeocodeError);
                } finally {
                    setIsLocating(false);
                }
            }, GEOCODE_DEBOUNCE_MS);
        },
        [selectedProvince, selectedDistrict, selectedSubDistrict, province, district, subDistrict, language, onChange, deriveValue, applyResolvedPin, t]
    );

    // Choosing a level moves the pin (AC-2): forward-geocode the resolved
    // address once the selection settles (debounced), skipped when the
    // resolved address string is unchanged since the last call (cost
    // control) or when this change was JUST derived FROM the pin itself
    // (suppressForwardRef, set by applyResolvedPin).
    useEffect(() => {
        if (suppressForwardRef.current) {
            suppressForwardRef.current = false;
            return;
        }
        if (!selectedProvince) return;

        const provinceText = language === 'th' ? selectedProvince.provinceName : selectedProvince.provinceNameEn;
        const districtText = selectedDistrict
            ? (language === 'th' ? selectedDistrict.districtName : selectedDistrict.districtNameEn) || undefined
            : undefined;
        const subDistrictText = selectedSubDistrict
            ? (language === 'th' ? selectedSubDistrict.nameTh : selectedSubDistrict.nameEn)
            : undefined;
        const queryKey = [provinceText, districtText, subDistrictText].filter(Boolean).join('|');
        if (queryKey === lastForwardQueryRef.current) return;

        if (forwardTimerRef.current) clearTimeout(forwardTimerRef.current);
        forwardTimerRef.current = setTimeout(async () => {
            lastForwardQueryRef.current = queryKey;
            try {
                const params = new URLSearchParams({ province: provinceText || '' });
                if (districtText) params.set('district', districtText);
                if (subDistrictText) params.set('subDistrict', subDistrictText);
                const res = await fetch(`/api/geocode/forward?${params.toString()}`);
                if (!res.ok) return; // non-blocking - the host can still drag the pin manually
                const parsed = geocodeForwardResultSchema.safeParse(await res.json());
                if (!parsed.success || parsed.data.lat == null || parsed.data.lon == null) return;
                // Narrowed to `number` (not `number | null`) right at the guard -
                // a fresh binding off `parsed.data` would lose that narrowing.
                const resolvedLat: number = parsed.data.lat;
                const resolvedLon: number = parsed.data.lon;

                const hasCurrentPin = latitude != null && longitude != null;
                const movedFar =
                    !hasCurrentPin ||
                    Math.abs(latitude! - resolvedLat) > PIN_MOVE_THRESHOLD_DEGREES ||
                    Math.abs(longitude! - resolvedLon) > PIN_MOVE_THRESHOLD_DEGREES;

                if (!hasCurrentPin) {
                    onChange({ ...deriveValue(selectedProvince, selectedDistrict, selectedSubDistrict), latitude: resolvedLat, longitude: resolvedLon });
                } else if (movedFar) {
                    setConflict({ kind: 'selects', resolved: { lat: resolvedLat, lon: resolvedLon } });
                }
            } catch {
                // Non-blocking - forward geocode only moves the pin as a convenience,
                // never required to save the form.
            }
        }, GEOCODE_DEBOUNCE_MS);
        return () => {
            if (forwardTimerRef.current) clearTimeout(forwardTimerRef.current);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedProvince, selectedDistrict, selectedSubDistrict, language]);

    const acceptConflict = () => {
        if (!conflict) return;
        if (conflict.kind === 'pin') {
            applyResolvedPin(conflict.resolved);
        } else {
            onChange({ ...deriveValue(selectedProvince, selectedDistrict, selectedSubDistrict), latitude: conflict.resolved.lat, longitude: conflict.resolved.lon });
        }
        setConflict(null);
    };

    const dismissConflict = () => setConflict(null);

    const provinceLabel = selectedProvince
        ? (language === 'th' ? selectedProvince.provinceName : selectedProvince.provinceNameEn)
        : t.newCampground.province;
    const districtLabel = selectedDistrict
        ? (language === 'th' ? (selectedDistrict.districtName || '') : (selectedDistrict.districtNameEn || ''))
        : t.newCampground.district;
    const subDistrictLabel = selectedSubDistrict
        ? (language === 'th' ? selectedSubDistrict.nameTh : selectedSubDistrict.nameEn)
        : t.newCampground.subDistrict;

    return (
        <div className={cn('space-y-4', className)}>
        <div className="grid gap-3 md:grid-cols-3">
            {/* Province */}
            <Popover open={provinceOpen} onOpenChange={setProvinceOpen}>
                <PopoverTrigger asChild>
                    <Button
                        type="button"
                        variant="outline"
                        size="lg"
                        role="combobox"
                        aria-expanded={provinceOpen}
                        aria-label={t.newCampground.province}
                        data-testid="btn--location-picker-province"
                        className="w-full justify-between px-4 rounded-full border-border hover:border-primary/50 text-left font-normal"
                    >
                        <div className="flex items-center gap-2 overflow-hidden">
                            <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
                            <span className="truncate">{provinceLabel}</span>
                        </div>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0 overflow-hidden shadow-lg border-border bg-card" align="start">
                    <Command shouldFilter={false}>
                        <div className="flex items-center border-b px-3">
                            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                            <CommandInput
                                placeholder={t.locationPicker.provinceSearchPlaceholder}
                                className="h-12"
                                value={provinceQuery}
                                onValueChange={setProvinceQuery}
                            />
                        </div>
                        <CommandList className="max-h-[300px]">
                            <CommandEmpty className="py-6 text-center text-sm text-muted-foreground">
                                {provinceLoading ? t.common.loading_sr : t.locationPicker.noResults}
                            </CommandEmpty>
                            <CommandGroup>
                                {provinceOptions.map((row) => (
                                    <CommandItem
                                        key={row.id}
                                        value={row.id}
                                        onSelect={() => handleSelectProvince(row)}
                                        data-testid="row--location-picker-province-option"
                                        className="px-4 flex items-center gap-3 cursor-pointer hover:bg-accent/15 transition-colors"
                                    >
                                        <span className="flex-1 text-sm font-medium text-foreground">
                                            {language === 'th' ? row.provinceName : row.provinceNameEn}
                                        </span>
                                        <Check
                                            className={cn(
                                                'h-4 w-4 text-primary',
                                                selectedProvince?.id === row.id ? 'opacity-100' : 'opacity-0'
                                            )}
                                        />
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        </CommandList>
                    </Command>
                </PopoverContent>
            </Popover>

            {/* District — locked until a province is chosen (never offers all 930 up front) */}
            <Popover open={districtOpen} onOpenChange={(next) => selectedProvince && setDistrictOpen(next)}>
                <PopoverTrigger asChild>
                    <Button
                        type="button"
                        variant="outline"
                        size="lg"
                        role="combobox"
                        aria-expanded={districtOpen}
                        aria-label={t.newCampground.district}
                        disabled={!selectedProvince}
                        data-testid="btn--location-picker-district"
                        className="w-full justify-between px-4 rounded-full border-border hover:border-primary/50 text-left font-normal"
                    >
                        <div className="flex items-center gap-2 overflow-hidden">
                            <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
                            <span className="truncate">
                                {selectedProvince ? districtLabel : t.locationPicker.selectProvinceFirst}
                            </span>
                        </div>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0 overflow-hidden shadow-lg border-border bg-card" align="start">
                    <Command shouldFilter={false}>
                        <div className="flex items-center border-b px-3">
                            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                            <CommandInput
                                placeholder={t.locationPicker.districtSearchPlaceholder}
                                className="h-12"
                                value={districtQuery}
                                onValueChange={setDistrictQuery}
                            />
                        </div>
                        <CommandList className="max-h-[300px]">
                            <CommandEmpty className="py-6 text-center text-sm text-muted-foreground">
                                {districtLoading ? t.common.loading_sr : t.locationPicker.noResults}
                            </CommandEmpty>
                            <CommandGroup>
                                {districtOptions.map((row) => (
                                    <CommandItem
                                        key={row.id}
                                        value={row.id}
                                        onSelect={() => handleSelectDistrict(row)}
                                        data-testid="row--location-picker-district-option"
                                        className="px-4 flex items-center gap-3 cursor-pointer hover:bg-accent/15 transition-colors"
                                    >
                                        <span className="flex-1 text-sm font-medium text-foreground">
                                            {language === 'th' ? row.districtName : row.districtNameEn}
                                        </span>
                                        <Check
                                            className={cn(
                                                'h-4 w-4 text-primary',
                                                selectedDistrict?.id === row.id ? 'opacity-100' : 'opacity-0'
                                            )}
                                        />
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        </CommandList>
                    </Command>
                </PopoverContent>
            </Popover>

            {/* Sub-district — locked until a district is chosen */}
            <Popover open={subDistrictOpen} onOpenChange={(next) => selectedDistrict && setSubDistrictOpen(next)}>
                <PopoverTrigger asChild>
                    <Button
                        type="button"
                        variant="outline"
                        size="lg"
                        role="combobox"
                        aria-expanded={subDistrictOpen}
                        aria-label={t.newCampground.subDistrict}
                        disabled={!selectedDistrict}
                        data-testid="btn--location-picker-subdistrict"
                        className="w-full justify-between px-4 rounded-full border-border hover:border-primary/50 text-left font-normal"
                    >
                        <div className="flex items-center gap-2 overflow-hidden">
                            <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
                            <span className="truncate">
                                {selectedDistrict ? subDistrictLabel : t.locationPicker.selectDistrictFirst}
                            </span>
                        </div>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0 overflow-hidden shadow-lg border-border bg-card" align="start">
                    <Command shouldFilter={false}>
                        <div className="flex items-center border-b px-3">
                            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                            <CommandInput
                                placeholder={t.locationPicker.subDistrictSearchPlaceholder}
                                className="h-12"
                                value={subDistrictQuery}
                                onValueChange={setSubDistrictQuery}
                            />
                        </div>
                        <CommandList className="max-h-[300px]">
                            <CommandEmpty className="py-6 text-center text-sm text-muted-foreground">
                                {subDistrictLoading ? t.common.loading_sr : t.locationPicker.noResults}
                            </CommandEmpty>
                            <CommandGroup>
                                {subDistrictOptions.map((row) => (
                                    <CommandItem
                                        key={row.id}
                                        value={row.id}
                                        onSelect={() => handleSelectSubDistrict(row)}
                                        data-testid="row--location-picker-subdistrict-option"
                                        className="px-4 flex items-center gap-3 cursor-pointer hover:bg-accent/15 transition-colors"
                                    >
                                        <span className="flex-1 text-sm font-medium text-foreground">
                                            {language === 'th' ? row.nameTh : row.nameEn}
                                        </span>
                                        <Check
                                            className={cn(
                                                'h-4 w-4 text-primary',
                                                selectedSubDistrict?.id === row.id ? 'opacity-100' : 'opacity-0'
                                            )}
                                        />
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        </CommandList>
                    </Command>
                </PopoverContent>
            </Popover>
        </div>

        {conflict && (
            <div
                role="status"
                aria-live="polite"
                className="flex flex-col gap-3 rounded-2xl border border-primary/30 bg-primary/5 px-4 py-3 text-sm text-foreground"
                data-testid="banner--location-reconcile"
            >
                <p>{conflict.kind === 'pin' ? t.locationPicker.conflictPinFoundBody : t.locationPicker.conflictSelectionMovedBody}</p>
                <div className="flex gap-2">
                    <Button type="button" size="default" onClick={acceptConflict} data-testid="btn--location-reconcile-accept">
                        {t.common.accept}
                    </Button>
                    <Button type="button" variant="outline" size="default" onClick={dismissConflict} data-testid="btn--location-reconcile-decline">
                        {t.common.decline}
                    </Button>
                </div>
            </div>
        )}

        {/* CAM-554 AC-1: draggable Leaflet pin, replacing the raw lat/lon number
            inputs as the PRIMARY way to set a camp's location (the honest,
            schema-required numeric fields still sit below in
            CampgroundForm.tsx, synced to the SAME formData state, as a
            keyboard-operable fallback - Leaflet has no native keyboard-drag
            equivalent). Mounted only once this section scrolls into view
            (mapVisible, see the IntersectionObserver effect above). */}
        <div ref={mapSectionRef}>
            {mapVisible && (
                <LocationMapPin
                    latitude={latitude}
                    longitude={longitude}
                    onPinChange={handlePinChange}
                    ariaLabel={t.locationPicker.mapAriaLabel}
                    emptyHint={t.locationPicker.mapEmptyHint}
                    coordinatesLabel={t.locationPicker.mapCoordinatesLabel
                        .replace('{lat}', latitude != null ? latitude.toFixed(4) : '')
                        .replace('{lon}', longitude != null ? longitude.toFixed(4) : '')}
                    isLocating={isLocating}
                    locatingLabel={t.locationPicker.mapLocating}
                    errorMessage={geocodeError}
                />
            )}
        </div>
        </div>
    );
}

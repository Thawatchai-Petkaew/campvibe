'use client';

import { useState, useEffect, useCallback } from 'react';
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

/**
 * CAM-559 — cascading province -> district -> sub-district picker, replacing
 * the old flat single-search list. Each level is independently searchable
 * (Thai is the primary search path) and strictly narrows the next.
 *
 * Data sourcing (deliberately split across two tables — see tech.md):
 *  - Province + district keep reading the EXISTING `/api/locations/search`
 *    (ThailandLocation), completely untouched, so `Location.province`'s
 *    stored value/derivation never changes — `lib/campsite-filters.ts`'s
 *    exact-equality province filter, CAM-531's province dropdown, and
 *    CAM-545's Thai-name lookup all depend on that value staying byte-
 *    identical to what they already resolve today.
 *  - Sub-district reads the NEW `/api/admin-areas/subdistricts` (AdminArea)
 *    — the ONE level ThailandLocation cannot hold at all (no column).
 *
 * Scale: every fetch is scoped (province: up to 20 rows: the existing
 * endpoint's own cap; district: scoped to the selected province; sub-
 * district: scoped to the selected district) — never the full 77/930/7,452
 * row tables in one payload. Each level's list only loads once its popover
 * opens (lazy) and its query is debounced (300ms, matches the prior list).
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
    /** The deepest ThailandLocation-backed row's id (district if picked, else province, else ''). */
    thaiLocationId: string;
}

interface LocationPickerProps {
    onChange: (value: LocationPickerValue) => void;
    className?: string;
}

export function LocationPicker({ onChange, className }: LocationPickerProps) {
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

    const deriveValue = useCallback(
        (
            province: ThailandLocationRow | null,
            district: ThailandLocationRow | null,
            subDistrict: SubDistrictRow | null
        ): LocationPickerValue => ({
            province: province ? (language === 'th' ? province.provinceName : province.provinceNameEn) : '',
            district: district ? (language === 'th' ? (district.districtName || '') : (district.districtNameEn || '')) : '',
            subDistrict: subDistrict ? (language === 'th' ? subDistrict.nameTh : subDistrict.nameEn) : '',
            thaiLocationId: district?.id || province?.id || '',
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
        <div className={cn('grid gap-3 md:grid-cols-3', className)}>
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
    );
}

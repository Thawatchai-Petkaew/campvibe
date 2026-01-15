'use client';

import { useState, useEffect } from 'react';
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

interface ThailandLocation {
    id: string;
    provinceCode: string;
    provinceName: string;
    provinceNameEn: string;
    districtCode: string | null;
    districtName: string | null;
    districtNameEn: string | null;
}

interface LocationPickerProps {
    onSelect: (location: ThailandLocation | null) => void;
    initialLocationId?: string;
    className?: string;
}

export function LocationPicker({ onSelect, initialLocationId, className }: LocationPickerProps) {
    const { language, t } = useLanguage();
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [locations, setLocations] = useState<ThailandLocation[]>([]);
    const [selectedLocation, setSelectedLocation] = useState<ThailandLocation | null>(null);
    const [loading, setLoading] = useState(false);

    // Fetch locations based on search query
    useEffect(() => {
        const fetchLocations = async () => {
            if (!query && !selectedLocation) {
                // Initial load: maybe show some popular provinces?
                setLoading(true);
                try {
                    const res = await fetch('/api/locations/search?type=province');
                    const data = await res.json();
                    setLocations(Array.isArray(data) ? data : []);
                } catch (err) {
                    console.error('Failed to fetch initial locations', err);
                    setLocations([]);
                } finally {
                    setLoading(false);
                }
                return;
            }

            if (query.length < 2 && !selectedLocation) return;

            setLoading(true);
            try {
                const res = await fetch(`/api/locations/search?q=${encodeURIComponent(query)}`);
                const data = await res.json();
                setLocations(Array.isArray(data) ? data : []);
            } catch (err) {
                console.error('Failed to fetch locations', err);
                setLocations([]);
            } finally {
                setLoading(false);
            }
        };

        const timer = setTimeout(fetchLocations, 300);
        return () => clearTimeout(timer);
    }, [query]);

    // Initial location fetch if ID provided
    useEffect(() => {
        if (initialLocationId && !selectedLocation) {
            // Fetch specific location by ID
            // For now, we'll just wait for the search to find it or assume it's passed in
        }
    }, [initialLocationId]);

    const handleSelect = (location: ThailandLocation) => {
        setSelectedLocation(location);
        onSelect(location);
        setOpen(false);
        setQuery('');
    };

    const getDisplayName = (loc: ThailandLocation) => {
        const pName = language === 'th' ? loc.provinceName : loc.provinceNameEn;
        const dName = language === 'th' ? loc.districtName : loc.districtNameEn;

        if (loc.districtCode === "") {
            return pName;
        }
        return `${dName}, ${pName}`;
    };

    return (
        <div className={cn("grid gap-2", className)}>
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={open}
                        className="w-full justify-between h-12 px-4 rounded-full border-border hover:border-primary/50 text-left font-normal"
                    >
                        <div className="flex items-center gap-2 overflow-hidden">
                            <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
                            <span className="truncate">
                                {selectedLocation
                                    ? getDisplayName(selectedLocation)
                                    : language === 'th' ? 'ค้นหาสถานที่ (จังหวัด, อำเภอ)' : 'Search location (Province, District)'}
                            </span>
                        </div>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0 rounded-2xl overflow-hidden shadow-xl border-border bg-card" align="start">
                    <Command shouldFilter={false}>
                        <div className="flex items-center border-b px-3">
                            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                            <CommandInput
                                placeholder={language === 'th' ? t.locationPicker.searchPlaceholderTh : t.locationPicker.searchPlaceholder}
                                className="h-12"
                                value={query}
                                onValueChange={setQuery}
                            />
                        </div>
                        <CommandList className="max-h-[300px]">
                            <CommandEmpty className="py-6 text-center text-sm text-muted-foreground">
                                {loading ? '...' : language === 'th' ? 'ไม่พบข้อมูล' : 'No location found.'}
                            </CommandEmpty>
                            <CommandGroup>
                                {locations.map((loc) => (
                                    <CommandItem
                                        key={loc.id}
                                        value={loc.id}
                                        onSelect={() => handleSelect(loc)}
                                        className="py-3 px-4 flex items-center gap-3 cursor-pointer hover:bg-muted transition-colors"
                                    >
                                        <div className="w-8 h-8 rounded-full bg-primary/5 flex items-center justify-center shrink-0">
                                            <MapPin className="h-4 w-4 text-primary" />
                                        </div>
                                        <div className="flex flex-col flex-1">
                                            {loc.districtCode && loc.districtCode !== "" ? (
                                                <>
                                                    <span className="font-semibold text-foreground text-sm">
                                                        {language === 'th' ? loc.districtName : loc.districtNameEn}
                                                    </span>
                                                    <span className="text-xs text-muted-foreground">
                                                        {language === 'th' ? loc.provinceName : loc.provinceNameEn}
                                                    </span>
                                                </>
                                            ) : (
                                                <>
                                                    <span className="font-semibold text-foreground text-sm">
                                                        {language === 'th' ? loc.provinceName : loc.provinceNameEn}
                                                    </span>
                                                    <span className="text-xs text-muted-foreground italic">
                                                        {language === 'th' ? 'ทั้งจังหวัด' : 'Whole Province'}
                                                    </span>
                                                </>
                                            )}
                                        </div>
                                        <Check
                                            className={cn(
                                                "ml-auto h-4 w-4 text-primary",
                                                selectedLocation?.id === loc.id ? "opacity-100" : "opacity-0"
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

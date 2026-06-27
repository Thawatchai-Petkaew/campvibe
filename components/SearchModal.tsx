"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, MapPin, Calendar as CalendarIcon, Users, Type, Navigation, Tent, Car, Soup, Mountain, Trees, Waves, Palmtree, Map } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { PROVINCES, THAILAND_DATA } from "@/lib/thailand-data";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

import { Dialog } from "@/components/ui/dialog";
import { ModalContent, ModalHeader } from "@/components/ui/modal-shell";
import { Button } from "@/components/ui/button";
import { InputField } from "@/components/ui/input-field";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";

interface SearchModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const CAMPGROUND_TYPES = [
    { id: 'ALL', labelKey: 'all', icon: Map },
    { id: 'CAGD', labelKey: 'campgrounds', icon: Tent },
    { id: 'CACP', labelKey: 'carCamping', icon: Car },
    { id: 'GLAMP', labelKey: 'glamping', icon: Soup },
    { id: 'LAKE', labelKey: 'lakefront', icon: Waves },
    { id: 'FOREST', labelKey: 'forest', icon: Trees },
    { id: 'VIEW', labelKey: 'views', icon: Mountain },
    { id: 'BAOT', labelKey: 'boatAccess', icon: Palmtree },
];

export function SearchModal({ isOpen, onClose }: SearchModalProps) {
    const { t } = useLanguage();
    const router = useRouter();
    const searchParams = useSearchParams();

    const [keyword, setKeyword] = useState(searchParams.get("keyword") || "");
    const [type, setType] = useState(searchParams.get("type") || "ALL");
    const [province, setProvince] = useState(searchParams.get("province") || "");
    const [district, setDistrict] = useState(searchParams.get("district") || "");
    const [startDate, setStartDate] = useState<Date | undefined>(
        searchParams.get("startDate") ? new Date(searchParams.get("startDate")!) : undefined
    );
    const [endDate, setEndDate] = useState<Date | undefined>(
        searchParams.get("endDate") ? new Date(searchParams.get("endDate")!) : undefined
    );
    const [guests, setGuests] = useState(searchParams.get("guests") || "1");

    // Reset district if province changes
    useEffect(() => {
        if (province && province !== " " && !THAILAND_DATA[province]?.includes(district)) {
            setDistrict("");
        }
    }, [province]);

    const handleSearch = () => {
        const params = new URLSearchParams(searchParams.toString());

        if (keyword) params.set("keyword", keyword); else params.delete("keyword");
        if (type && type !== 'ALL') params.set("type", type); else params.delete("type");
        if (province && province !== " ") params.set("province", province); else params.delete("province");
        if (district && district !== " ") params.set("district", district); else params.delete("district");
        if (startDate) params.set("startDate", format(startDate, "yyyy-MM-dd")); else params.delete("startDate");
        if (endDate) params.set("endDate", format(endDate, "yyyy-MM-dd")); else params.delete("endDate");
        if (guests) params.set("guests", guests); else params.delete("guests");

        router.push(`/?${params.toString()}`);
        onClose();
    };

    const handleReset = () => {
        setKeyword("");
        setType("ALL");
        setProvince("");
        setDistrict("");
        setStartDate(undefined);
        setEndDate(undefined);
        setGuests("1");
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <ModalContent className="sm:max-w-3xl" aria-describedby={undefined}>
                <div className="flex flex-col h-full max-h-[90vh] relative">
                    <ModalHeader
                        title={t.search.search}
                        closeLabel={t.common?.close ?? "Close"}
                        onClose={onClose}
                    />

                    {/* Standard Rounded Search UI */}
                    <div className="p-6 md:p-8 flex-grow overflow-y-auto custom-scrollbar space-y-8">

                        {/* Experience Type (Pills) */}
                        <div className="space-y-2">
                            <h3 className="text-lg font-bold px-1 text-foreground">{t.searchModal.experienceType}</h3>
                            <div className="flex flex-wrap gap-2">
                                {CAMPGROUND_TYPES.map((item) => (
                                    <button
                                        key={item.id}
                                        onClick={() => setType(item.id)}
                                        className={cn(
                                            "flex items-center gap-2 px-5 h-11 rounded-full border transition-all text-sm font-medium",
                                            type === item.id
                                                ? "bg-primary text-primary-foreground border-primary shadow-md shadow-primary/20"
                                                : "bg-background text-muted-foreground border-border hover:border-foreground"
                                        )}
                                    >
                                        <item.icon className={cn("w-3.5 h-3.5", type === item.id ? "text-primary-foreground" : "text-muted-foreground")} />
                                        <span>{(t.categories as any)[item.labelKey]}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Location Section */}
                        <div className="space-y-1">
                            <h3 className="text-lg font-bold px-1 text-foreground">{t.search.location}</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <InputField
                                    label={t.search.keyword}
                                    value={keyword}
                                    onChange={(e) => setKeyword(e.target.value)}
                                    placeholder={t.search.keywordPlaceholder}
                                    leftIcon={<Search className="w-4 h-4" />}
                                    className="rounded-full bg-background border-border"
                                />
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-2">
                                        <label className="text-xs font-regular uppercase tracking-widest text-muted-foreground ml-4">{t.search.province}</label>
                                        <Select value={province} onValueChange={setProvince}>
                                            <SelectTrigger className="w-full border border-border hover:border-foreground transition bg-background">
                                                <SelectValue placeholder={t.search.anyProvince} />
                                            </SelectTrigger>
                                            <SelectContent className="shadow-2xl">
                                                <SelectItem value=" " className="cursor-pointer">{t.search.anyProvince}</SelectItem>
                                                {PROVINCES.map(p => (
                                                    <SelectItem key={p} value={p} className="cursor-pointer">{p}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-regular uppercase tracking-widest text-muted-foreground ml-4">{t.search.district}</label>
                                        <Select value={district} onValueChange={setDistrict} disabled={!province || province === " "}>
                                            <SelectTrigger className="w-full border border-border hover:border-foreground transition bg-background">
                                                <SelectValue placeholder={t.search.anyDistrict} />
                                            </SelectTrigger>
                                            <SelectContent className="shadow-2xl">
                                                <SelectItem value=" " className="cursor-pointer">{t.search.anyDistrict}</SelectItem>
                                                {province && province !== " " && THAILAND_DATA[province]?.map(d => (
                                                    <SelectItem key={d} value={d} className="cursor-pointer">{d}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Dates & Guests */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-1">
                                <h3 className="text-lg font-bold px-1 text-foreground">{t.search.date}</h3>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-2">
                                        <label className="text-xs font-regular uppercase tracking-widest text-muted-foreground ml-4">{t.booking.checkIn}</label>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <Button
                                                    variant="outline"
                                                    size="lg"
                                                    className={cn(
                                                        "w-full justify-start font-normal bg-background border-border hover:bg-muted px-4 focus:ring-primary/30 focus:border-primary",
                                                        !startDate && "text-muted-foreground"
                                                    )}
                                                >
                                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                                    {startDate ? format(startDate, "MMM d, yyyy") : t.booking.addDate}
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0 border-none shadow-2xl" align="start">
                                                <Calendar
                                                    mode="single"
                                                    selected={startDate}
                                                    onSelect={setStartDate}
                                                    autoFocus
                                                />
                                            </PopoverContent>
                                        </Popover>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-regular uppercase tracking-widest text-muted-foreground ml-4">{t.booking.checkOut}</label>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <Button
                                                    variant="outline"
                                                    size="lg"
                                                    className={cn(
                                                        "w-full justify-start font-normal bg-background border-border hover:bg-muted px-4 focus:ring-primary/30 focus:border-primary",
                                                        !endDate && "text-muted-foreground"
                                                    )}
                                                >
                                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                                    {endDate ? format(endDate, "MMM d, yyyy") : t.booking.addDate}
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0 border-none shadow-2xl" align="start">
                                                <Calendar
                                                    mode="single"
                                                    selected={endDate}
                                                    onSelect={setEndDate}
                                                    autoFocus
                                                    disabled={(date) => !!startDate && date < startDate}
                                                />
                                            </PopoverContent>
                                        </Popover>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-1">
                                <h3 className="text-lg font-bold px-1 text-foreground">{t.search.who}</h3>
                                <div className="space-y-2">
                                    <label className="text-xs font-regular uppercase tracking-widest text-muted-foreground ml-4">{t.booking.guests}</label>
                                    <Select value={guests} onValueChange={setGuests}>
                                        <SelectTrigger className="w-full border border-border hover:border-foreground transition bg-background">
                                            <div className="flex items-center gap-2">
                                                <Users className="w-4 h-4 text-muted-foreground" />
                                                <SelectValue />
                                            </div>
                                        </SelectTrigger>
                                        <SelectContent className="shadow-2xl">
                                            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 15, 20].map((n) => (
                                                <SelectItem key={n} value={n.toString()} className="cursor-pointer">
                                                    {n} {n === 1 ? t.booking.guest : t.booking.guests}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="p-4 bg-card flex items-center justify-between border-t border-border/60">
                        <Button
                            variant="ghost"
                            onClick={handleReset}
                            className="text-sm font-bold underline hover:bg-muted p-2 px-4 rounded-full"
                        >
                            {t.searchModal.clearAll}
                        </Button>
                        <Button
                            onClick={handleSearch}
                            size="lg"
                            className="bg-primary hover:bg-primary/90 text-primary-foreground px-8 rounded-full font-bold shadow-lg shadow-primary/20"
                        >
                            <Search className="w-4 h-4 mr-2" />
                            {t.search.search}
                        </Button>
                    </div>
                </div>
            </ModalContent>
        </Dialog>
    );
}

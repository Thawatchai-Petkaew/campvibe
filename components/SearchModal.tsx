"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, MapPin, Calendar as CalendarIcon, Users, Type, Navigation, X, Tent, Car, Soup, Mountain, Trees, Waves, Palmtree, Map } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { PROVINCES, THAILAND_DATA } from "@/lib/thailand-data";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

    const inputHeight = "!h-12";

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent showCloseButton={false} className="sm:max-w-3xl rounded-[24px] p-0 overflow-hidden border-none shadow-2xl bg-white">
                <div className="flex flex-col h-full max-h-[90vh] relative">
                    {/* Header */}
                    <div className="flex items-center justify-center p-6 pb-2 border-b border-gray-50">
                        <DialogClose asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="absolute right-4 top-4 rounded-full hover:bg-gray-100 transition-colors w-10 h-10"
                                onClick={onClose}
                            >
                                <X className="w-5 h-5 text-gray-900" />
                            </Button>
                        </DialogClose>
                        <DialogTitle className="text-lg font-bold">{t.search.search}</DialogTitle>
                    </div>

                    {/* Standard Rounded Search UI */}
                    <div className="p-6 md:p-8 flex-grow overflow-y-auto custom-scrollbar space-y-8">

                        {/* Experience Type (Pills) */}
                        <div className="space-y-2">
                            <h3 className="text-lg font-bold px-1">Experience type</h3>
                            <div className="flex flex-wrap gap-2">
                                {CAMPGROUND_TYPES.map((item) => (
                                    <button
                                        key={item.id}
                                        onClick={() => setType(item.id)}
                                        className={cn(
                                            "flex items-center gap-2 px-5 rounded-full border transition-all text-sm font-medium",
                                            inputHeight,
                                            type === item.id
                                                ? "bg-primary text-primary-foreground border-primary shadow-md shadow-primary/20"
                                                : "bg-white text-gray-600 border-gray-200 hover:border-gray-900"
                                        )}
                                    >
                                        <item.icon className={cn("w-3.5 h-3.5", type === item.id ? "text-white" : "text-gray-500")} />
                                        <span>{(t.categories as any)[item.labelKey]}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Location Section */}
                        <div className="space-y-1">
                            <h3 className="text-lg font-bold px-1">{t.search.location}</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-xs font-regular uppercase tracking-widest text-muted-foreground ml-4">{t.search.keyword}</label>
                                    <div className="relative">
                                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                        <Input
                                            value={keyword}
                                            onChange={(e) => setKeyword(e.target.value)}
                                            placeholder={t.search.keywordPlaceholder}
                                            className={cn("rounded-full bg-white border-gray-200 pl-12 focus-visible:ring-primary/30 focus-visible:border-primary", inputHeight)}
                                        />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-2">
                                        <label className="text-xs font-regular uppercase tracking-widest text-muted-foreground ml-4">{t.search.province}</label>
                                        <Select value={province} onValueChange={setProvince}>
                                            <SelectTrigger className={cn("rounded-full bg-white border-gray-200 focus:ring-primary/30 focus:border-primary", inputHeight)}>
                                                <SelectValue placeholder={t.search.anyProvince} />
                                            </SelectTrigger>
                                            <SelectContent className="rounded-2xl border-none shadow-2xl">
                                                <SelectItem value=" ">{t.search.anyProvince}</SelectItem>
                                                {PROVINCES.map(p => (
                                                    <SelectItem key={p} value={p}>{p}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-regular uppercase tracking-widest text-muted-foreground ml-4">{t.search.district}</label>
                                        <Select value={district} onValueChange={setDistrict} disabled={!province || province === " "}>
                                            <SelectTrigger className={cn("rounded-full bg-white border-gray-200 focus:ring-primary/30 focus:border-primary", inputHeight)}>
                                                <SelectValue placeholder={t.search.anyDistrict} />
                                            </SelectTrigger>
                                            <SelectContent className="rounded-2xl border-none shadow-2xl">
                                                <SelectItem value=" ">{t.search.anyDistrict}</SelectItem>
                                                {province && province !== " " && THAILAND_DATA[province]?.map(d => (
                                                    <SelectItem key={d} value={d}>{d}</SelectItem>
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
                                <h3 className="text-lg font-bold px-1">{t.search.date}</h3>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-2">
                                        <label className="text-xs font-regular uppercase tracking-widest text-muted-foreground ml-4">{t.booking.checkIn}</label>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <Button
                                                    variant="outline"
                                                    className={cn(
                                                        "w-full rounded-full justify-start font-normal bg-white border-gray-200 hover:bg-gray-50 px-4 focus:ring-primary/30 focus:border-primary",
                                                        !startDate && "text-muted-foreground",
                                                        inputHeight
                                                    )}
                                                >
                                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                                    {startDate ? format(startDate, "MMM d, yyyy") : t.booking.addDate}
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0 rounded-2xl border-none shadow-2xl" align="start">
                                                <Calendar
                                                    mode="single"
                                                    selected={startDate}
                                                    onSelect={setStartDate}
                                                    initialFocus
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
                                                    className={cn(
                                                        "w-full rounded-full justify-start font-normal bg-white border-gray-200 hover:bg-gray-50 px-4 focus:ring-primary/30 focus:border-primary",
                                                        !endDate && "text-muted-foreground",
                                                        inputHeight
                                                    )}
                                                >
                                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                                    {endDate ? format(endDate, "MMM d, yyyy") : t.booking.addDate}
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0 rounded-2xl border-none shadow-2xl" align="start">
                                                <Calendar
                                                    mode="single"
                                                    selected={endDate}
                                                    onSelect={setEndDate}
                                                    initialFocus
                                                    disabled={(date) => !!startDate && date < startDate}
                                                />
                                            </PopoverContent>
                                        </Popover>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-1">
                                <h3 className="text-lg font-bold px-1">{t.search.who}</h3>
                                <div className="space-y-2">
                                    <label className="text-xs font-regular uppercase tracking-widest text-muted-foreground ml-4">{t.booking.guests}</label>
                                    <Select value={guests} onValueChange={setGuests}>
                                        <SelectTrigger className={cn("rounded-full bg-white border-gray-200 focus:ring-primary/30 focus:border-primary", inputHeight)}>
                                            <div className="flex items-center gap-2">
                                                <Users className="w-4 h-4 text-muted-foreground" />
                                                <SelectValue />
                                            </div>
                                        </SelectTrigger>
                                        <SelectContent className="rounded-2xl border-none shadow-xl">
                                            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 15, 20].map((n) => (
                                                <SelectItem key={n} value={n.toString()}>
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
                    <div className="p-4 bg-white flex items-center justify-between border-t border-gray-100">
                        <Button
                            variant="ghost"
                            onClick={handleReset}
                            className="text-sm font-bold underline hover:bg-gray-100 p-2 px-4 rounded-full"
                        >
                            {t.nav.anywhere === "ทุกที่" ? "ล้างข้อมูล" : "Clear all"}
                        </Button>
                        <Button
                            onClick={handleSearch}
                            className="bg-primary hover:bg-primary/90 text-white px-8 rounded-full font-bold shadow-lg shadow-primary/20 active:scale-95 transition-transform h-10"
                        >
                            <Search className="w-4 h-4 mr-2" />
                            {t.search.search}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

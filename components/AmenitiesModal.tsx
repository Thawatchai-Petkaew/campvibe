"use client";

import {
    Wifi, Utensils, ShowerHead, Car, Waves, Dumbbell, Snowflake,
    ThermometerSun, Tv, Shirt, Wind, Zap, Bath, Coffee, ShoppingBasket,
    Store, Droplets, Trash2, Table, CheckCircle2,
} from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ModalContent, ModalHeader } from "@/components/ui/modal-shell";

interface AmenitiesModalProps {
    isOpen: boolean;
    onClose: () => void;
    facilities: string[];
}

export function AmenitiesModal({ isOpen, onClose, facilities }: AmenitiesModalProps) {
    const { t } = useLanguage();

    const getIcon = (key: string) => {
        // Map facility codes to Lucide icons (named imports only — PERF-BUNDLE fix, CAM-200)
        const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
            'WIFI': Wifi,
            'KITC': Utensils,
            'SHOW': ShowerHead,
            'PARK': Car,
            'POOL': Waves,
            'GYM': Dumbbell,
            'AC': Snowflake,
            'HEAT': ThermometerSun,
            'TV': Tv,
            'WASH': Shirt,
            'DRYE': Wind,
            'ELEC': Zap,
            'TOIL': Bath,
            'CAFE': Coffee,
            'REST': Utensils,
            'CART': ShoppingBasket,
            'LOTS': Store,
            'MIBC': Store,
            'MAKT': Store,
            '711': Store,
            'FEDW': Droplets,
            'FEIC': Snowflake,
            'GRIL': Utensils,
            'SANI': Trash2,
            'POTA': Droplets,
            'SINK': Droplets,
            'TRAS': Trash2,
            'WATE': Droplets,
            'MIMT': Store,
            'PICN': Table,
            'SVEL': Store,
        };
        const IconComponent = iconMap[key] ?? CheckCircle2;
        return <IconComponent className="w-6 h-6 text-muted-foreground" />;
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <ModalContent className="max-w-2xl max-h-[85vh] flex flex-col gap-0" aria-describedby={undefined}>
                <ModalHeader
                    title={t.campground.whatOffers}
                    closeLabel={t.common.close}
                    onClose={onClose}
                />

                <ScrollArea className="flex-1 p-6">
                    <div className="grid gap-6">
                        {facilities.map((facility) => (
                            <div key={facility} className="flex items-center gap-4 py-2 border-b last:border-0 border-border/60">
                                {getIcon(facility)}
                                <span className="text-foreground text-base">
                                    {(t.filter as Record<string, string>)[facility] || facility}
                                </span>
                            </div>
                        ))}
                    </div>
                </ScrollArea>

                <div className="p-4 border-t border-border bg-card">
                    <Button
                        onClick={onClose}
                        size="lg"
                        variant="secondary"
                        className="w-full"
                    >
                        {t.common.close}
                    </Button>
                </div>
            </ModalContent>
        </Dialog>
    );
}

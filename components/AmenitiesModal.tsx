"use client";

import { X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { ScrollArea } from "@/components/ui/scroll-area";
import * as Icons from "lucide-react";

interface AmenitiesModalProps {
    isOpen: boolean;
    onClose: () => void;
    facilities: string[];
}

export function AmenitiesModal({ isOpen, onClose, facilities }: AmenitiesModalProps) {
    const { t } = useLanguage();

    const getIcon = (key: string) => {
        // Map facility codes to Lucide icons
        const iconMap: Record<string, any> = {
            'WIFI': Icons.Wifi,
            'KITC': Icons.Utensils,
            'SHOW': Icons.ShowerHead,
            'PARK': Icons.Car,
            'POOL': Icons.Waves,
            'GYM': Icons.Dumbbell,
            'AC': Icons.Snowflake,
            'HEAT': Icons.ThermometerSun,
            'TV': Icons.Tv,
            'WASH': Icons.Shirt,
            'DRYE': Icons.Wind,
            'ELEC': Icons.Zap,
            'TOIL': Icons.HelpCircle,
            'CAFE': Icons.Coffee,
            'REST': Icons.Utensils,
            'CART': Icons.ShoppingBasket,
            'LOTS': Icons.Store,
            'MIBC': Icons.Store,
            'MAKT': Icons.Store,
            '711': Icons.Store,
            'FEDW': Icons.Droplets,
            'FEIC': Icons.Snowflake,
            'GRIL': Icons.Utensils,
            'SANI': Icons.Trash2,
            'POTA': Icons.Droplets,
            'SINK': Icons.Droplets,
            'TRAS': Icons.Trash2,
            'WATE': Icons.Droplets,
            'MIMT': Icons.Store,
            'PICN': Icons.Table,
            'SVEL': Icons.Store,
        };
        const IconComponent = iconMap[key] || Icons.CheckCircle2;
        return <IconComponent className="w-6 h-6 text-gray-600" />;
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-0 gap-0 rounded-xl overflow-hidden">
                <DialogHeader className="p-6 pb-4 border-b">
                    <div className="flex items-center justify-between">
                        <DialogTitle className="text-xl font-bold">
                            {t.campground.whatOffers}
                        </DialogTitle>
                    </div>
                </DialogHeader>

                <ScrollArea className="flex-1 p-6">
                    <div className="grid gap-6">
                        {facilities.map((facility) => (
                            <div key={facility} className="flex items-center gap-4 py-2 border-b last:border-0 border-gray-100">
                                {getIcon(facility)}
                                <span className="text-gray-700 text-base">
                                    {(t.filter as any)[facility] || facility}
                                </span>
                            </div>
                        ))}
                    </div>
                </ScrollArea>

                <div className="p-4 border-t bg-white">
                    <Button
                        onClick={onClose}
                        className="w-full bg-gray-900 hover:bg-black text-white rounded-lg h-12 text-base font-medium"
                    >
                        {t.common.close || "Close"}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

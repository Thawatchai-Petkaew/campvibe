import { Wifi, Tent, Car, Anchor, Mountain, Tv, ShowerHead, Utensils, Zap, Shield, User, Clock, Calendar } from "lucide-react";

export const FILTER_SECTIONS = [
    {
        id: "facilities",
        titleKey: "filter.facilities", // Need to add to permissions
        options: [
            { id: "WIFI", icon: Wifi, labelKey: "facilities.wifi" },
            { id: "KITC", icon: Utensils, labelKey: "facilities.kitchen" },
            { id: "SHOW", icon: ShowerHead, labelKey: "facilities.shower" },
            { id: "PARK", icon: Car, labelKey: "facilities.parking" },
            { id: "ELEC", icon: Zap, labelKey: "facilities.electricity" },
        ]
    },
    {
        id: "campDetails",
        titleKey: "filter.campDetails",
        options: [
            { id: "CAGD", icon: Tent, labelKey: "newCampground.regularCamp" }, // Reusing keys
            { id: "CACP", icon: Car, labelKey: "newCampground.carCamping" },
            { id: "GLAMP", icon: Mountain, labelKey: "newCampground.glamping" },
        ]
    },
    // Add more based on schema/needs
]

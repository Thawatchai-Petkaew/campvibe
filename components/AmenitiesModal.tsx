"use client";

import { X, Wifi, Car, ShowerHead, Utensils, Tent, Trees, Wind, Droplet, Flame, Users, Shield } from "lucide-react";

interface AmenitiesModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const AMENITIES = [
    { icon: Wifi, label: "Wifi", category: "Connectivity" },
    { icon: Utensils, label: "Kitchen", category: "Cooking" },
    { icon: ShowerHead, label: "Shower", category: "Bathroom" },
    { icon: Car, label: "Free parking on premises", category: "Parking" },
    { icon: Tent, label: "Tent camping allowed", category: "Camping" },
    { icon: Trees, label: "Surrounded by nature", category: "Location" },
    { icon: Wind, label: "Fresh mountain air", category: "Environment" },
    { icon: Droplet, label: "Drinking water", category: "Essentials" },
    { icon: Flame, label: "Fire pit", category: "Outdoor" },
    { icon: Users, label: "Common area", category: "Social" },
    { icon: Shield, label: "24/7 Security", category: "Safety" },
    { icon: Car, label: "EV charging", category: "Parking" },
];

export function AmenitiesModal({ isOpen, onClose }: AmenitiesModalProps) {
    if (!isOpen) return null;

    const handleBackdropClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    };

    return (
        <div
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={handleBackdropClick}
        >
            <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-200">
                    <h2 className="text-2xl font-bold font-display">What this place offers</h2>
                    <button
                        onClick={onClose}
                        className="hover:bg-gray-100 p-2 rounded-full transition"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {AMENITIES.map((amenity, index) => (
                            <div key={index} className="flex items-center gap-4 py-3">
                                <amenity.icon className="w-6 h-6 text-gray-700 flex-shrink-0" />
                                <div>
                                    <div className="font-medium text-gray-900">{amenity.label}</div>
                                    <div className="text-xs text-gray-500">{amenity.category}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-gray-200">
                    <button
                        onClick={onClose}
                        className="w-full bg-gray-900 hover:bg-gray-800 text-white font-semibold py-3 rounded-lg transition"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}

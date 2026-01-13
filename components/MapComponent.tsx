"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Star } from "lucide-react";

// Custom Pin Icon using primary color
interface MapComponentProps {
    latitude: number;
    longitude: number;
    campground: any;
}

export default function MapComponent({ latitude, longitude, campground }: MapComponentProps) {
    const [isHovered, setIsHovered] = useState(false);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted || typeof window === 'undefined') return null;

    // Custom Pin Icon using primary color (Safe to create here because we checked for window)
    const PrimaryIcon = L.divIcon({
        html: `
            <svg width="32" height="42" viewBox="0 0 32 42" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M16 0C7.16344 0 0 7.16344 0 16C0 28 16 42 16 42C16 42 32 28 32 16C32 7.16344 24.8366 0 16 0Z" fill="#0d9488"/>
                <circle cx="16" cy="16" r="6" fill="white"/>
            </svg>
        `,
        className: "",
        iconSize: [32, 42],
        iconAnchor: [16, 42],
        popupAnchor: [0, -46], // 0.25rem (4px) gap above the pin
    });
    const images = campground.images ? campground.images.split(',') : [];
    const coverImage = images[0] || "https://images.unsplash.com/photo-1523987355523-c7b5b0dd90a7?auto=format&fit=crop&q=80&w=400";

    return (
        <div className="w-full h-full relative rounded-xl overflow-hidden border border-gray-200 shadow-sm">
            <MapContainer
                center={[latitude, longitude]}
                zoom={13}
                scrollWheelZoom={false}
                style={{ height: "100%", width: "100%", zIndex: 0 }}
            >
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                <Marker
                    position={[latitude, longitude]}
                    icon={PrimaryIcon}
                    eventHandlers={{
                        mouseover: (e) => {
                            e.target.openPopup();
                            setIsHovered(true);
                        },
                        mouseout: (e) => {
                            // Keep popup or close? Usually AirBnb keeps open until click elsewhere or hover card
                            // For simplicity, we'll use Leaflet's Popup as the hover card
                        }
                    }}
                >
                    <Popup closeButton={false} minWidth={240} className="hover-card-popup">
                        <div className="w-60 overflow-hidden rounded-lg">
                            <img
                                src={coverImage}
                                alt={campground.nameTh}
                                className="w-full h-32 object-cover"
                            />
                            <div className="p-3">
                                <h3 className="font-bold text-gray-900 leading-tight mb-1 truncate">
                                    {campground.nameTh}
                                </h3>
                                <div className="flex items-center gap-1 text-sm mb-2">
                                    <Star className="w-3 h-3 fill-black text-black" />
                                    <span className="font-semibold">4.8</span>
                                    <span className="text-gray-500">· {campground.location.province}</span>
                                </div>
                                <div className="text-sm">
                                    <span className="font-bold">${campground.priceLow}</span>
                                    <span className="text-gray-500"> / night</span>
                                </div>
                            </div>
                        </div>
                    </Popup>
                </Marker>
            </MapContainer>

            <style jsx global>{`
                .leaflet-popup-content-wrapper {
                    padding: 0;
                    overflow: hidden;
                    border-radius: 12px;
                    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
                }
                .leaflet-popup-content {
                    margin: 0;
                    width: auto !important;
                }
                .leaflet-popup-tip-container {
                    display: none;
                }
                .hover-card-popup {
                    bottom: 10px !important;
                }
            `}</style>
        </div>
    );
}

"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Star } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

// Custom Pin Icon using primary color
interface MapComponentProps {
    latitude: number;
    longitude: number;
    campground: any;
    /** CAM-147: server-computed average rating (1dp) or null when no reviews. */
    avgRating?: number | null;
    /** CAM-147: total non-deleted review count. */
    reviewCount?: number;
}

export default function MapComponent({ latitude, longitude, campground, avgRating, reviewCount = 0 }: MapComponentProps) {
    const { t, formatCurrency, language } = useLanguage();
    const [isHovered, setIsHovered] = useState(false);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted || typeof window === 'undefined') return null;

    // Custom Pin Icon using CSS custom properties (Safe to create here because we checked for window)
    const PrimaryIcon = L.divIcon({
        html: `
            <svg width="32" height="42" viewBox="0 0 32 42" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M16 0C7.16344 0 0 7.16344 0 16C0 28 16 42 16 42C16 42 32 28 32 16C32 7.16344 24.8366 0 16 0Z" fill="var(--primary)"/>
                <circle cx="16" cy="16" r="6" fill="var(--primary-foreground)"/>
            </svg>
        `,
        className: "",
        iconSize: [32, 42],
        iconAnchor: [16, 42],
        popupAnchor: [0, -46], // 0.25rem (4px) gap above the pin
    });
    const images = (campground.images ?? []).map((img: { url: string }) => img.url);
    const coverImage = images[0] || "/placeholder-camp.svg";

    return (
        <div className="w-full h-full relative rounded-xl overflow-hidden border border-border shadow-sm">
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
                                alt=""
                                aria-hidden="true"
                                className="w-full h-32 object-cover"
                                onError={(e) => {
                                    const el = e.currentTarget;
                                    el.style.display = 'none';
                                    if (el.parentElement) el.parentElement.style.background = 'var(--muted)';
                                }}
                            />
                            <div className="p-3">
                                <h3 className="font-bold text-foreground leading-tight mb-1 truncate">
                                    {campground.nameTh}
                                </h3>
                                <div className="flex items-center gap-1 text-sm mb-2">
                                    {reviewCount > 0 && avgRating != null ? (
                                        <div
                                            className="flex items-center gap-1"
                                            aria-label={t.reviews.ratingAriaLabelShort.replace('{avg}', String(avgRating))}
                                            data-testid="rating--map-popup-avg"
                                        >
                                            <Star className="w-3 h-3 fill-foreground text-foreground" aria-hidden="true" />
                                            <span className="font-semibold tabular-nums">{avgRating}</span>
                                        </div>
                                    ) : (
                                        <span
                                            className="text-sm text-muted-foreground"
                                            aria-label={t.reviews.noReviews}
                                            data-testid="empty--map-popup-rating"
                                        >
                                            {t.reviews.noReviews}
                                        </span>
                                    )}
                                    <span className="text-muted-foreground">· {campground.location.province}</span>
                                </div>
                                <div className="text-sm">
                                    <span className="font-bold">{formatCurrency(campground.priceLow)}</span>
                                    <span className="text-muted-foreground"> / {t.common.night}</span>
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
                    background: var(--popover);
                    color: var(--popover-foreground);
                    box-shadow: 0 10px 15px -3px color-mix(in oklch, var(--foreground) 10%, transparent);
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

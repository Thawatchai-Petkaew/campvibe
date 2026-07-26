"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Loader2 } from "lucide-react";
import { ErrorBanner } from "@/components/ui/error-banner";

/**
 * LocationMapPin — CAM-554 AC-1.
 *
 * A draggable Leaflet pin replacing the raw latitude/longitude number
 * inputs on the host's Location card. Dumb/presentational: all reverse/
 * forward-geocode wiring and reconciliation state live in LocationPicker.tsx
 * (the "two-way wiring" per the dispatch's file surface); this component
 * only reports a lat/lon the host chose (click or drag) and renders one.
 *
 * Reuses `react-leaflet`/`leaflet` exactly as `components/MapComponent.tsx`
 * already does (same primary-color divIcon, same CSS import, same `window`
 * guard) - no new map library, per the owner's architecture decision to keep
 * Leaflet on the browser (2026-07-26).
 *
 * No default pin: the OLD raw inputs defaulted to 13.7563/100.5018
 * (Bangkok), silently placing every skipped camp there. When `latitude`/
 * `longitude` are both `null` (host has not pinned anything yet) this
 * renders an EMPTY state - map centered on Thailand, no marker, a hint
 * telling the host to click/tap to drop one - never a pre-placed pin.
 */

const THAILAND_CENTER: [number, number] = [15.87, 100.9925];
const THAILAND_ZOOM = 5;
const PINNED_ZOOM = 13;

interface LocationMapPinProps {
    latitude: number | null;
    longitude: number | null;
    onPinChange: (lat: number, lon: number) => void;
    ariaLabel: string;
    emptyHint: string;
    coordinatesLabel: string;
    isLocating?: boolean;
    locatingLabel?: string;
    errorMessage?: string | null;
}

/** Recenters the map whenever the controlled lat/lon changes (drag, click, or an
 *  accepted forward-geocode move) - `MapContainer`'s `center` prop only applies once. */
function RecenterOnChange({ lat, lon }: { lat: number; lon: number }) {
    const map = useMap();
    useEffect(() => {
        map.setView([lat, lon], map.getZoom());
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [lat, lon]);
    return null;
}

function ClickToPlacePin({ onPlace }: { onPlace: (lat: number, lon: number) => void }) {
    useMapEvents({
        click(e) {
            onPlace(e.latlng.lat, e.latlng.lng);
        },
    });
    return null;
}

export default function LocationMapPin({
    latitude,
    longitude,
    onPinChange,
    ariaLabel,
    emptyHint,
    coordinatesLabel,
    isLocating = false,
    locatingLabel,
    errorMessage,
}: LocationMapPinProps) {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted || typeof window === "undefined") return null;

    const hasPin = latitude != null && longitude != null;

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
    });

    return (
        <div className="space-y-2">
            <div
                role="group"
                aria-label={ariaLabel}
                className="relative w-full h-64 sm:h-80 rounded-xl overflow-hidden border border-border shadow-sm focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2"
                data-testid="map--location-pin"
            >
                <MapContainer
                    center={hasPin ? [latitude!, longitude!] : THAILAND_CENTER}
                    zoom={hasPin ? PINNED_ZOOM : THAILAND_ZOOM}
                    scrollWheelZoom={false}
                    style={{ height: "100%", width: "100%", zIndex: 0 }}
                >
                    <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    <ClickToPlacePin onPlace={onPinChange} />
                    {hasPin && (
                        <>
                            <Marker
                                position={[latitude!, longitude!]}
                                icon={PrimaryIcon}
                                draggable
                                eventHandlers={{
                                    dragend: (e) => {
                                        const pos = e.target.getLatLng();
                                        onPinChange(pos.lat, pos.lng);
                                    },
                                }}
                            />
                            <RecenterOnChange lat={latitude!} lon={longitude!} />
                        </>
                    )}
                </MapContainer>

                {!hasPin && (
                    <div
                        className="pointer-events-none absolute inset-x-0 bottom-0 z-[1000] bg-background/90 px-4 py-2 text-center text-sm text-muted-foreground"
                        data-testid="empty--location-map-pin"
                    >
                        {emptyHint}
                    </div>
                )}

                {isLocating && (
                    <div
                        role="status"
                        aria-live="polite"
                        className="absolute top-2 right-2 z-[1000] flex items-center gap-1.5 rounded-full bg-background/90 px-3 py-1.5 text-xs text-foreground shadow-sm"
                        data-testid="status--location-map-locating"
                    >
                        <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                        {locatingLabel}
                    </div>
                )}
            </div>

            {hasPin && (
                <p className="text-xs text-muted-foreground ml-4" data-testid="text--location-map-coordinates">
                    {coordinatesLabel}
                </p>
            )}

            {errorMessage && <ErrorBanner message={errorMessage} data-testid="error--location-map-geocode" />}
        </div>
    );
}

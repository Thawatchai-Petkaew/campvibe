"use client";

import { useState, useEffect } from "react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { ImageWithFallback } from "@/components/ui/image-with-fallback";

interface ImageGalleryProps {
    images: string[];
    isOpen: boolean;
    onClose: () => void;
    initialIndex?: number;
}

export function ImageGallery({ images, isOpen, onClose, initialIndex = 0 }: ImageGalleryProps) {
    const { t, language } = useLanguage();
    const [currentIndex, setCurrentIndex] = useState(initialIndex);

    // Sync initialIndex when gallery opens; clamp to valid range
    useEffect(() => {
        if (isOpen && images.length > 0) {
            const clamped = Math.min(Math.max(initialIndex, 0), images.length - 1);
            setCurrentIndex(clamped);
        }
    }, [isOpen, initialIndex, images.length]);

    // Keyboard navigation
    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
            if (e.key === "ArrowLeft") setCurrentIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
            if (e.key === "ArrowRight") setCurrentIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isOpen, images.length, onClose]);

    if (!isOpen) return null;
    if (images.length === 0) return null;

    const goToPrevious = () => {
        setCurrentIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
    };

    const goToNext = () => {
        setCurrentIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
    };

    const handleBackdropClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    };

    // Build the "n of total" counter string from the i18n template
    const imageOfLabel = t.gallery.imageOf
        .replace("{n}", String(currentIndex + 1))
        .replace("{total}", String(images.length));

    return (
        // photo-viewer scrim: intentional dark override, exempt per DESIGN.md F3 exception
        <div
            role="dialog"
            aria-modal="true"
            aria-label={t.gallery.viewerTitle}
            className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center"
            onClick={handleBackdropClick}
        >
            {/* Close Button */}
            <button
                onClick={onClose}
                aria-label={t.gallery.closeViewer}
                className="absolute top-6 right-6 text-white hover:bg-white/10 p-3 rounded-full transition z-10 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-black/95"
            >
                <X className="w-6 h-6" />
            </button>

            {/* Counter */}
            <div className="absolute top-6 left-6 text-white text-sm font-medium z-10" aria-live="polite" aria-atomic="true">
                {imageOfLabel}
            </div>

            {/* Previous Button */}
            <button
                onClick={goToPrevious}
                aria-label={t.gallery.previousImage}
                className="absolute left-6 text-white hover:bg-white/10 p-3 rounded-full transition z-10 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-black/95"
            >
                <ChevronLeft className="w-8 h-8" />
            </button>

            {/* Main Image */}
            <div className="relative w-full h-full flex items-center justify-center p-4 md:p-20">
                {/* CAM-274: Mode B (width/height as intrinsic hints, not fill) — a fill-mode
                    wrapper with no explicit height collapses to 0x0. Mode B lets the wrapper
                    shrink-wrap the img at its natural aspect ratio within the viewport,
                    so rounded-3xl hugs the real photo edges instead of an invisible box. */}
                <ImageWithFallback
                    src={images[currentIndex]}
                    alt={imageOfLabel}
                    width={1600}
                    height={1200}
                    className="max-w-full max-h-full rounded-3xl bg-transparent"
                    imgClassName="w-auto h-auto max-w-[calc(100vw-6rem)] max-h-[calc(100vh-11rem)] object-contain"
                />
            </div>

            {/* Next Button */}
            <button
                onClick={goToNext}
                aria-label={t.gallery.nextImage}
                className="absolute right-6 text-white hover:bg-white/10 p-3 rounded-full transition z-10 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-black/95"
            >
                <ChevronRight className="w-8 h-8" />
            </button>

            {/* Thumbnail Strip */}
            <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 flex gap-2 overflow-x-auto max-w-4xl px-4">
                {images.map((image, index) => (
                    <button
                        key={index}
                        onClick={() => setCurrentIndex(index)}
                        aria-label={t.gallery.imageOf.replace("{n}", String(index + 1)).replace("{total}", String(images.length))}
                        aria-current={index === currentIndex ? "true" : undefined}
                        className={`flex-shrink-0 w-20 h-20 rounded-2xl overflow-hidden border-2 transition focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-black/95 ${
                            index === currentIndex ? "border-white" : "border-transparent opacity-60 hover:opacity-100"
                        }`}
                    >
                        <ImageWithFallback
                            src={image}
                            alt=""
                            className="w-full h-full"
                            imgClassName="object-cover"
                            sizes="80px"
                        />
                    </button>
                ))}
            </div>
        </div>
    );
}

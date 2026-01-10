"use client";

import { useState } from "react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";

interface ImageGalleryProps {
    images: string[];
    isOpen: boolean;
    onClose: () => void;
    initialIndex?: number;
}

export function ImageGallery({ images, isOpen, onClose, initialIndex = 0 }: ImageGalleryProps) {
    const [currentIndex, setCurrentIndex] = useState(initialIndex);

    if (!isOpen) return null;

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

    return (
        <div
            className="fixed inset-0 bg-black z-50 flex items-center justify-center"
            onClick={handleBackdropClick}
        >
            {/* Close Button */}
            <button
                onClick={onClose}
                className="absolute top-6 right-6 text-white hover:bg-white/10 p-2 rounded-full transition z-10"
            >
                <X className="w-6 h-6" />
            </button>

            {/* Counter */}
            <div className="absolute top-6 left-6 text-white text-sm font-medium z-10">
                {currentIndex + 1} / {images.length}
            </div>

            {/* Previous Button */}
            <button
                onClick={goToPrevious}
                className="absolute left-6 text-white hover:bg-white/10 p-3 rounded-full transition z-10"
            >
                <ChevronLeft className="w-8 h-8" />
            </button>

            {/* Main Image */}
            <div className="relative w-full h-full flex items-center justify-center p-20">
                <img
                    src={images[currentIndex]}
                    alt={`Gallery image ${currentIndex + 1}`}
                    className="max-w-full max-h-full object-contain"
                />
            </div>

            {/* Next Button */}
            <button
                onClick={goToNext}
                className="absolute right-6 text-white hover:bg-white/10 p-3 rounded-full transition z-10"
            >
                <ChevronRight className="w-8 h-8" />
            </button>

            {/* Thumbnail Strip */}
            <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 flex gap-2 overflow-x-auto max-w-4xl px-4">
                {images.map((image, index) => (
                    <button
                        key={index}
                        onClick={() => setCurrentIndex(index)}
                        className={`flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 transition ${index === currentIndex ? 'border-white' : 'border-transparent opacity-60 hover:opacity-100'
                            }`}
                    >
                        <img
                            src={image}
                            alt={`Thumbnail ${index + 1}`}
                            className="w-full h-full object-cover"
                        />
                    </button>
                ))}
            </div>
        </div>
    );
}

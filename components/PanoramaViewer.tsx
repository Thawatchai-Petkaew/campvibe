"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { X } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { ImageWithFallback } from "@/components/ui/image-with-fallback";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useModalA11y } from "@/lib/hooks/use-modal-a11y";
import { cn } from "@/lib/utils";

interface PanoramaViewerProps {
    /** The panorama photo's URL — the same img.url the flat gallery already renders. */
    url: string;
    /** Accessible name for the full image (host-set Image.alt, or a caller fallback). */
    alt: string;
    onClose: () => void;
}

const PAN_STEP_PX = 120;

/**
 * PanoramaViewer (CAM-354) — an in-house pan-strip viewer for a PANORAMA-kind
 * spot photo. Loaded ONLY via dynamic({ssr:false}) from CampgroundDetailClient
 * when a PANORAMA thumbnail is first opened (BR-3) — never in the detail
 * route's initial bundle.
 *
 * BR-2/tech.md §2.3: renders the image at its true pixels — height fills the
 * viewport, width is auto (natural aspect) — so a wide strip overflows and
 * pans horizontally; a narrower-than-viewport image centers with no overflow
 * (EC-3). No sphere/equirectangular projection, no WebGL, no canvas.
 *
 * Deviation note: the main image is a plain <img> (not next/image). Neither
 * of ImageWithFallback's two modes (fill / fixed width+height) can express
 * "unknown aspect ratio, auto width" without knowing the source's real pixel
 * dimensions up front — and Image.kind carries no width/height (story.md
 * ## Data). A plain <img> lets the browser derive the natural size with zero
 * distortion and zero guessing. The graceful-failure state (AC-6/EC-4) still
 * reuses ImageWithFallback's own placeholder (src=null) per tech.md's mapping.
 */
export default function PanoramaViewer({ url, alt, onClose }: PanoramaViewerProps) {
    const { t } = useLanguage();
    const [isLoaded, setIsLoaded] = useState(false);
    const [hasErrored, setHasErrored] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const closeButtonRef = useRef<HTMLButtonElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const hintId = useId();

    // BR-5: a real modal — focus the close control on open; Escape closes.
    useEffect(() => {
        closeButtonRef.current?.focus();

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [onClose]);

    // CAM-368: shared Tab/Shift+Tab focus trap + body scroll lock. This
    // viewer is only ever mounted while open (the caller conditionally
    // renders it), so the trap/lock is active for its whole mounted lifetime.
    useModalA11y(containerRef, { active: true });

    const handleBackdropClick = useCallback(
        (e: React.MouseEvent<HTMLDivElement>) => {
            if (e.target === e.currentTarget) onClose();
        },
        [onClose]
    );

    // BR-2/EC-3: arrow-key pan. A no-op when the strip doesn't overflow — the
    // native scrollLeft assignment simply has nowhere to go at the clamp, no
    // custom momentum/inertia physics (tech.md §2.3).
    const handleScrollKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
        const el = scrollRef.current;
        if (!el) return;
        if (e.key === "ArrowLeft") {
            e.preventDefault();
            el.scrollLeft -= PAN_STEP_PX;
        } else if (e.key === "ArrowRight") {
            e.preventDefault();
            el.scrollLeft += PAN_STEP_PX;
        }
    };

    const showLoading = !isLoaded && !hasErrored;

    return (
        // photo-viewer scrim: intentional dark override, exempt per DESIGN.md F3
        // exception (BR-8) — the same idiom as components/ImageGallery.tsx.
        <div
            ref={containerRef}
            role="dialog"
            aria-modal="true"
            aria-label={t.panorama.title}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200"
            onClick={handleBackdropClick}
            data-testid="dialog--panorama-viewer"
        >
            <button
                ref={closeButtonRef}
                type="button"
                onClick={onClose}
                aria-label={t.panorama.closeLabel}
                className="absolute top-6 right-6 z-10 flex h-11 w-11 items-center justify-center rounded-full text-white transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-black/95"
                data-testid="btn--panorama-close"
            >
                <X className="h-6 w-6" aria-hidden="true" />
            </button>

            {/* BR-5: visible hint + the scroll region's accessible description. */}
            <p
                id={hintId}
                className="absolute top-6 left-1/2 z-10 max-w-[80vw] -translate-x-1/2 px-4 text-center text-sm font-medium text-white"
            >
                {t.panorama.hint}
            </p>

            {showLoading && (
                <div
                    role="status"
                    aria-live="polite"
                    className="pointer-events-none absolute inset-0 flex items-center justify-center"
                    data-testid="status--panorama-loading"
                >
                    <LoadingSpinner text={t.common.loading_sr} />
                </div>
            )}

            {hasErrored ? (
                <ImageWithFallback
                    src={null}
                    alt={alt}
                    className="h-64 w-64 max-h-[60vh] max-w-[60vw] rounded-2xl"
                    data-testid="img--panorama-fallback"
                />
            ) : (
                <div
                    ref={scrollRef}
                    tabIndex={0}
                    aria-describedby={hintId}
                    onKeyDown={handleScrollKeyDown}
                    className="flex h-full w-full items-center overflow-x-auto overflow-y-hidden px-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
                    data-testid="scroll--panorama-strip"
                >
                    <img
                        src={url}
                        alt={alt}
                        draggable={false}
                        onLoad={() => setIsLoaded(true)}
                        onError={() => setHasErrored(true)}
                        className={cn(
                            "mx-auto h-full w-auto max-w-none select-none",
                            !isLoaded && "invisible"
                        )}
                        data-testid="img--panorama-strip"
                    />
                </div>
            )}
        </div>
    );
}

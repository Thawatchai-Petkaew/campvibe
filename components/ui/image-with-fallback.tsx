"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ImageOff } from "lucide-react";
import { cn } from "@/lib/utils";

interface ImageWithFallbackProps extends React.HTMLAttributes<HTMLDivElement> {
    src?: string | null;
    alt: string;
    className?: string;
    imgClassName?: string;
    onClick?: () => void;
    loading?: "lazy" | "eager";
    "data-testid"?: string;

    // PERF-4 (CAM-194): next/image props
    sizes?: string;             // REQUIRED when fill=true (omitting it degrades perf)
    priority?: boolean;         // pass true only for the LCP element (detail hero, index 0)
    unoptimized?: boolean;      // pass true for blob:/data: src; auto-detected too
    width?: number;             // pass with height for fixed mode (Mode B)
    height?: number;            // pass with width for fixed mode (Mode B)
}

/**
 * ImageWithFallback — wraps next/image with an error + no-src fallback placeholder.
 * Wrapper sizing/rounding is controlled by the caller via `className`.
 * Image object-fit etc. is controlled via `imgClassName`.
 *
 * Mode A (default) — fill mode: wrapper must be `relative` with an explicit height or
 *   aspect-ratio. Pass `sizes` (required). Used by all contexts except LogoUpload.
 *
 * Mode B — fixed mode: caller passes both `width` and `height` (explicit px).
 *   `fill` is omitted. Used only by LogoUpload (128×128).
 *
 * States: default image · fallback (no src) · fallback (errored)
 * Dark-safe: bg-muted + text-muted-foreground flip via .dark automatically.
 *
 * CAM-393: the muted frame is reserved instantly and the photo fades into it on
 * load (opacity 0→100) so images no longer hard-pop. LCP-safe: a `priority` image
 * (the detail hero) renders opaque immediately and never fades. The fade respects
 * `prefers-reduced-motion` (motion-safe transition only). Already-complete images
 * (cached/SSR) may never fire onLoad, so a ref.complete check reveals them on mount.
 */
export function ImageWithFallback({
    src,
    alt,
    className,
    imgClassName,
    onClick,
    loading,
    "data-testid": testId,
    sizes,
    priority,
    unoptimized,
    width,
    height,
    ...rest
}: ImageWithFallbackProps) {
    const [errored, setErrored] = useState(false);
    // A priority (LCP hero) image renders opaque immediately — no fade — to protect LCP.
    const [loaded, setLoaded] = useState(priority === true);
    const imgRef = useRef<HTMLImageElement>(null);

    // Reset the fade when the src changes, and catch already-complete (cached/SSR)
    // images whose onLoad never fires so they don't stay stuck invisible (EC-1).
    useEffect(() => {
        if (!src || priority) return; // priority already opaque; nothing to manage
        // Intentional one-time reconcile to the committed <img>'s imperative
        // `complete` flag — cached/SSR images may never fire onLoad, and this is
        // the only way to know it, so the extra render is the correct trade-off.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setLoaded(imgRef.current?.complete === true);
    }, [src, priority]);

    const showFallback = !src || errored;

    // Fade the photo into its reserved frame; motion-safe so reduced-motion snaps instantly.
    const fadeClass = cn(
        "object-cover motion-safe:transition-opacity motion-safe:duration-500 ease-out",
        loaded ? "opacity-100" : "opacity-0"
    );

    const wrapperRole = alt ? "img" : undefined;
    const wrapperAriaLabel = alt || undefined;
    const wrapperAriaHidden = alt ? undefined : ("true" as const);

    // Auto-detect unoptimized: blob: and data: URLs cannot go through next/image CDN.
    const isUnoptimized =
        unoptimized === true ||
        src?.startsWith("blob:") === true ||
        src?.startsWith("data:") === true;

    // Mode B: caller supplies both width and height → fixed pixel dimensions.
    const isFixedMode = typeof width === "number" && typeof height === "number";

    return (
        <div
            className={cn(
                "relative overflow-hidden bg-muted flex items-center justify-center",
                className
            )}
            role={showFallback ? wrapperRole : undefined}
            aria-label={showFallback ? wrapperAriaLabel : undefined}
            aria-hidden={showFallback && !alt ? wrapperAriaHidden : undefined}
            onClick={onClick}
            data-testid={testId}
            {...rest}
        >
            {showFallback ? (
                <ImageOff
                    className="w-8 h-8 text-muted-foreground/40"
                    aria-hidden="true"
                    data-testid={testId ? `${testId}--fallback-placeholder` : "img--fallback-placeholder"}
                />
            ) : isFixedMode ? (
                <Image
                    ref={imgRef}
                    src={src!}
                    alt={alt}
                    width={width}
                    height={height}
                    priority={priority}
                    unoptimized={isUnoptimized}
                    className={cn(fadeClass, imgClassName)}
                    onLoad={() => setLoaded(true)}
                    onError={() => setErrored(true)}
                    loading={priority ? undefined : loading}
                />
            ) : (
                <Image
                    ref={imgRef}
                    fill
                    src={src!}
                    alt={alt}
                    sizes={sizes}
                    priority={priority}
                    unoptimized={isUnoptimized}
                    className={cn(fadeClass, imgClassName)}
                    onLoad={() => setLoaded(true)}
                    onError={() => setErrored(true)}
                    loading={priority ? undefined : loading}
                />
            )}
        </div>
    );
}

"use client";

import { useState } from "react";
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

    const showFallback = !src || errored;

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
                    src={src!}
                    alt={alt}
                    width={width}
                    height={height}
                    priority={priority}
                    unoptimized={isUnoptimized}
                    className={cn("object-cover", imgClassName)}
                    onError={() => setErrored(true)}
                    loading={priority ? undefined : loading}
                />
            ) : (
                <Image
                    fill
                    src={src!}
                    alt={alt}
                    sizes={sizes}
                    priority={priority}
                    unoptimized={isUnoptimized}
                    className={cn("object-cover", imgClassName)}
                    onError={() => setErrored(true)}
                    loading={priority ? undefined : loading}
                />
            )}
        </div>
    );
}

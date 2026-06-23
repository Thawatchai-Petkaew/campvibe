"use client";

import { useState } from "react";
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
}

/**
 * ImageWithFallback — wraps a raw <img> with an error + no-src fallback placeholder.
 * Wrapper sizing/rounding is controlled by the caller via `className`.
 * Image object-fit etc. is controlled via `imgClassName`.
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
    ...rest
}: ImageWithFallbackProps) {
    const [errored, setErrored] = useState(false);

    const showFallback = !src || errored;

    const wrapperRole = alt ? "img" : undefined;
    const wrapperAriaLabel = alt || undefined;
    const wrapperAriaHidden = alt ? undefined : ("true" as const);

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
            ) : (
                <img
                    src={src}
                    alt={alt}
                    onError={() => setErrored(true)}
                    className={cn("w-full h-full object-cover", imgClassName)}
                    loading={loading}
                />
            )}
        </div>
    );
}

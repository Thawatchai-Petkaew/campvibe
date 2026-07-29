"use client";

import { useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface StickyActionBarProps {
    /** The headline value, e.g. a price or "Free". */
    primaryLabel: React.ReactNode;
    /** A short caption under/after the headline, e.g. a price unit word. */
    secondaryLabel?: React.ReactNode;
    actionLabel: string;
    loadingLabel?: string;
    onAction: () => void;
    disabled?: boolean;
    loading?: boolean;
    className?: string;
    "data-testid"?: string;
}

/**
 * components/ui/sticky-action-bar.tsx — CAM-664 (S2)
 *
 * A reusable primitive: a fixed bottom summary + one primary action,
 * `md:hidden` (mobile only). Built here because DESIGN.md §3.1 requires a
 * generic primitive for this shape and re-implementing an existing pattern
 * inline is this repo's #1 drift source (CAM-220/221) — this file is the
 * one place a caller composes "price/summary + primary CTA, pinned to the
 * bottom on mobile" rather than hand-rolling the fixed/safe-area/z-index
 * plumbing per page.
 *
 * States: default · disabled (mirrors the caller's own control) · loading
 * (inline spinner on the action, same idiom as the desktop Reserve button
 * this primitive was extracted alongside — `Loader2` + `animate-spin`, NOT
 * the page-level `LoadingSpinner` component, which is for an isolated
 * module/widget, not a button, per `.claude/rules/loading.md`).
 *
 * `z-40` (below the global AI-chat launcher's `z-50`) and a
 * `max(…, env(safe-area-inset-bottom))` bottom pad — the same safe-area
 * idiom already used by `SearchModal.tsx`/`AiChatPanel.tsx`.
 *
 * CAM-669: publishes its own real rendered height on the `--bottom-bar-height`
 * custom property (root element), so any bottom-docked sibling (currently
 * `AiChatLauncher`) can read it and clear the bar without either side
 * hardcoding the other's dimensions (DESIGN.md "Bottom-docked elements"
 * contract). A `ResizeObserver` on the bar's own wrapper measures it live —
 * this doubles as the mobile/desktop toggle for free, because `md:hidden`
 * collapses the element to 0 height at the `md` breakpoint, so the published
 * value naturally goes back to 0 with no separate media-query logic. Reset to
 * `0px` on unmount so a route that never mounts this bar is unaffected;
 * `app/globals.css` declares the same `0px` default on `:root` for any reader
 * that queries the variable before this effect ever runs.
 */
export function StickyActionBar({
    primaryLabel,
    secondaryLabel,
    actionLabel,
    loadingLabel,
    onAction,
    disabled = false,
    loading = false,
    className,
    "data-testid": testId,
}: StickyActionBarProps) {
    const barRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const el = barRef.current;
        if (!el) return;

        const publishHeight = () => {
            document.documentElement.style.setProperty(
                "--bottom-bar-height",
                `${el.getBoundingClientRect().height}px`
            );
        };

        publishHeight();
        const resizeObserver = new ResizeObserver(publishHeight);
        resizeObserver.observe(el);

        return () => {
            resizeObserver.disconnect();
            document.documentElement.style.setProperty("--bottom-bar-height", "0px");
        };
    }, []);

    return (
        <div
            ref={barRef}
            className={cn(
                "md:hidden fixed inset-x-0 bottom-0 z-40 flex items-center justify-between gap-4",
                "border-t border-border bg-card px-4 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]",
                "shadow-lg shadow-foreground/5",
                className
            )}
            data-testid={testId}
        >
            <div className="min-w-0">
                <p className="truncate text-base font-bold text-foreground tabular-nums">{primaryLabel}</p>
                {secondaryLabel && (
                    <p className="truncate text-xs text-muted-foreground">{secondaryLabel}</p>
                )}
            </div>
            <Button
                type="button"
                size="lg"
                onClick={onAction}
                disabled={disabled || loading}
                aria-busy={loading}
                data-testid={testId ? `${testId}--action` : undefined}
                className="shrink-0"
            >
                {loading ? (
                    <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" aria-hidden="true" />
                        {loadingLabel ?? actionLabel}
                    </>
                ) : actionLabel}
            </Button>
        </div>
    );
}

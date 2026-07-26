"use client";

import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from "@/components/ui/dialog";

// ModalHeader
// Owns the header band: centered title, optional description, bottom divider,
// and the X close button vertically centered via top-1/2 -translate-y-1/2.
// This positioning invariant guarantees equal top/bottom gap regardless of description.

interface ModalHeaderProps {
    title: React.ReactNode;
    description?: React.ReactNode;
    closeLabel?: string;
    onClose?: () => void;
    className?: string;
    /**
     * CAM-561 — when true, the header BAND (centered title row, divider,
     * close control) renders with no visible/tappable footprint at all below
     * `sm:` (640px): the caller is a mobile-fullscreen dialog that supplies
     * its own dismiss affordance instead. The title/description keep ONLY
     * their accessible-name role via `sr-only` (never `hidden`/display:none)
     * so the Dialog's own `aria-labelledby` still resolves to real text for
     * assistive tech at every viewport; the close control is fully removed
     * from the accessible tree on mobile (matches CAM-550's "not merely
     * hidden-but-tappable" standard), not just visually hidden. Desktop
     * (`sm:`+) is completely unchanged. Default false — every other
     * consumer's header (FilterModal, LoginModal, RegisterModal,
     * AmenitiesModal, spot-form-dialog, AddMemberDialog) is untouched.
     */
    hideOnMobile?: boolean;
}

/**
 * CAM-552 — the header gutter steps at md (`px-4 py-3` -> `md:px-6 md:py-4`),
 * taking ~8px off the band on a phone. The 44px close button is unchanged: it
 * is a tap target and sits on the floor.
 *
 * Keep commentary OUT of the `return ( <div className={cn(` chain —
 * cam-220-modal-shell.test.ts matches `return (`, the `<div`, and the class
 * string as directly adjacent tokens.
 */
export function ModalHeader({
    title,
    description,
    closeLabel = "Close",
    onClose,
    className,
    hideOnMobile = false,
}: ModalHeaderProps) {
    return (
        <div
            className={cn(
                "relative flex items-center justify-center px-4 py-3 md:px-6 md:py-4 border-b border-border/60",
                hideOnMobile && "max-sm:border-none max-sm:p-0",
                className
            )}
        >
            <div className={cn("text-center", hideOnMobile && "max-sm:sr-only")}>
                <DialogTitle className="type-heading-3 font-bold text-foreground text-center">
                    {title}
                </DialogTitle>
                {description != null && (
                    <DialogDescription className="text-sm text-muted-foreground text-center mt-1">
                        {description}
                    </DialogDescription>
                )}
            </div>
            <div className={hideOnMobile ? "max-sm:hidden" : undefined}>
                <DialogClose asChild>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={onClose}
                        aria-label={closeLabel}
                        data-testid="btn--modal-close"
                        className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full hover:bg-muted active:not-aria-[haspopup]:translate-y-[-50%] motion-safe:active:scale-100"
                    >
                        <X className="w-5 h-5 text-foreground" />
                    </Button>
                </DialogClose>
            </div>
        </div>
    );
}

// ModalContent
// Thin wrapper over DialogContent that sets the canonical shell classes once
// and passes showCloseButton={false} so the built-in X is suppressed.
// Width (e.g. sm:max-w-md) comes from the caller's className.

export function ModalContent({
    className,
    children,
    ...props
}: React.ComponentProps<typeof DialogContent>) {
    return (
        <DialogContent
            showCloseButton={false}
            className={cn(
                "p-0 overflow-hidden border-none rounded-3xl bg-card shadow-2xl",
                className
            )}
            {...props}
        >
            {children}
        </DialogContent>
    );
}

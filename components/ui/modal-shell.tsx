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
}

export function ModalHeader({
    title,
    description,
    closeLabel = "Close",
    onClose,
    className,
}: ModalHeaderProps) {
    return (
        <div
            className={cn(
                "relative flex items-center justify-center px-6 py-4 border-b border-border/60",
                className
            )}
        >
            <div className="text-center">
                <DialogTitle className="text-lg font-bold text-foreground text-center">
                    {title}
                </DialogTitle>
                {description != null && (
                    <DialogDescription className="text-sm text-muted-foreground text-center mt-1">
                        {description}
                    </DialogDescription>
                )}
            </div>
            <DialogClose asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={onClose}
                    aria-label={closeLabel}
                    data-testid="btn--modal-close"
                    className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full hover:bg-muted"
                >
                    <X className="w-5 h-5 text-foreground" />
                </Button>
            </DialogClose>
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

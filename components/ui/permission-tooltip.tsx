"use client"

import * as React from "react"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"
import { LockKeyhole } from "lucide-react"

interface PermissionTooltipProps {
    children: React.ReactElement
    hasPermission: boolean
    title?: string
    description?: string
    suggestion?: string
    side?: "top" | "right" | "bottom" | "left"
}

export function PermissionTooltip({
    children,
    hasPermission,
    title = "Permission Required",
    description = "You don't have permission to perform this action.",
    suggestion,
    side = "top"
}: PermissionTooltipProps) {
    if (hasPermission) {
        return children
    }

    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <span tabIndex={0}>
                        {children}
                    </span>
                </TooltipTrigger>
                <TooltipContent side={side} className="max-w-xs">
                    <div className="flex items-start gap-2">
                        <LockKeyhole className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                        <div className="space-y-1">
                            <p className="font-semibold text-foreground">{title}</p>
                            <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
                            {suggestion && (
                                <p className="text-xs text-primary/80 font-medium pt-1">
                                    💡 {suggestion}
                                </p>
                            )}
                        </div>
                    </div>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    )
}

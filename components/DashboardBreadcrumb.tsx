"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Home } from "lucide-react";
import { cn } from "@/lib/utils";

export function DashboardBreadcrumb() {
    const pathname = usePathname();
    
    if (!pathname) return null;

    const paths = pathname.split('/').filter(Boolean);
    
    const breadcrumbs = [
        { label: 'Dashboard', href: '/dashboard' },
        ...paths.slice(1).map((path, index) => {
            const href = '/' + paths.slice(0, index + 2).join('/');
            const label = path.charAt(0).toUpperCase() + path.slice(1).replace(/-/g, ' ');
            return { label, href };
        })
    ];

    return (
        <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
            <Link 
                href="/dashboard" 
                className="hover:text-foreground transition-colors flex items-center gap-1"
            >
                <Home className="w-4 h-4" />
            </Link>
            {breadcrumbs.map((crumb, index) => (
                <div key={crumb.href} className="flex items-center gap-2">
                    <ChevronRight className="w-4 h-4" />
                    {index === breadcrumbs.length - 1 ? (
                        <span className="text-foreground font-medium">{crumb.label}</span>
                    ) : (
                        <Link 
                            href={crumb.href}
                            className="hover:text-foreground transition-colors"
                        >
                            {crumb.label}
                        </Link>
                    )}
                </div>
            ))}
        </nav>
    );
}

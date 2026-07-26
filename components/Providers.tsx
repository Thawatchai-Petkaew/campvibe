"use client";

import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "next-themes";
import type { Session } from "next-auth";

export function Providers({ children, session }: { children: React.ReactNode; session: Session | null }) {
    return (
        // CAM-544: defaultTheme="dark" (not "system") — CampVibe is a campfire
        // platform, so a first-time visitor (no stored campvibe_theme choice)
        // always sees dark, regardless of their device's own color-scheme.
        // enableSystem stays on: the 3-way ThemeToggle (CAM-105) still offers
        // "System" as a real, working choice once the visitor picks it, and a
        // stored preference (light/dark/system) always wins over this default.
        <ThemeProvider
            attribute="class"
            defaultTheme="dark"
            enableSystem
            storageKey="campvibe_theme"
        >
            <SessionProvider session={session}>{children}</SessionProvider>
        </ThemeProvider>
    );
}

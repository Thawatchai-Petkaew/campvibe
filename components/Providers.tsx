"use client";

import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "next-themes";
import type { Session } from "next-auth";

export function Providers({
    children,
    session,
    nonce,
}: {
    children: React.ReactNode;
    session: Session | null;
    // CAM-610: the per-request CSP nonce (read from the `x-nonce` request
    // header CAM-607 propagates), threaded down to next-themes's own inline
    // FOUC-prevention script. That script is emitted via React JSX
    // (dangerouslySetInnerHTML), never through Next.js's own request-header
    // -driven auto-nonce-stamping pipeline, so it needs this explicit prop —
    // next-themes supports `nonce` natively for exactly this reason.
    nonce?: string;
}) {
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
            nonce={nonce}
        >
            <SessionProvider session={session}>{children}</SessionProvider>
        </ThemeProvider>
    );
}

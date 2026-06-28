"use client";

import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "next-themes";
import type { Session } from "next-auth";

export function Providers({ children, session }: { children: React.ReactNode; session: Session | null }) {
    return (
        <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            storageKey="campvibe_theme"
        >
            <SessionProvider session={session}>{children}</SessionProvider>
        </ThemeProvider>
    );
}

import type { Metadata } from "next";
import { headers, cookies } from "next/headers";
import { Inter, Outfit, Sarabun } from "next/font/google";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { Providers } from "@/components/Providers";
import VitalsReporter from "@/components/vitals-reporter";
import { auth } from "@/lib/auth";
import { AiChatLauncher } from "@/components/ai-chat/AiChatLauncher";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

const sarabun = Sarabun({
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sarabun",
  display: "swap",
});

export const metadata: Metadata = {
  // Resolves relative OG/Twitter image URLs (e.g. "/og-image.png") to absolute.
  // Reuses the existing APP_BASE_URL convention + staging fallback (lib/notify-messages.ts).
  metadataBase: new URL(process.env.APP_BASE_URL ?? "https://campvibe-staging.vercel.app"),
  title: "CampVibe | Professional Camping Ecosystem",
  description: "Find and book the best camping experiences",
  openGraph: {
    title: "CampVibe | Professional Camping Ecosystem",
    description: "Find and book the best camping experiences",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "CampVibe camping discovery and booking platform",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "CampVibe | Professional Camping Ecosystem",
    description: "Find and book the best camping experiences",
    images: ["/og-image.png"],
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();
  // CAM-610: the per-request CSP nonce that CAM-607's proxy.ts already sets on
  // the request headers (`x-nonce`). This layout already forces every route
  // dynamic via the unconditional `auth()` call above (CAM-195 CACHE-1), so
  // reading headers() here adds no new dynamic-rendering cost — it only reads
  // a value that request-scoped rendering already implies. Threaded down to
  // next-themes's own FOUC-prevention script, which Next's own automatic
  // script-nonce pipeline never reaches (CAM-607 tech.md).
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  // CAM-688 — BR-1/BR-3: resolve the camper's language from the
  // `campvibe_lang` cookie BEFORE the first byte, so SSR renders the right
  // language/currency immediately (no client-side flash). Only `th`/`en` are
  // honoured; any other value (missing cookie, unrecognised value) falls
  // back to `en` (EC-1). This layout already forces every route dynamic via
  // the unconditional `auth()` call above, so reading cookies() here adds no
  // new dynamic-rendering cost.
  const lang = (await cookies()).get("campvibe_lang")?.value === "th" ? "th" : "en";
  return (
    <html lang={lang} suppressHydrationWarning className={cn("font-sans", inter.variable, outfit.variable, sarabun.variable)}>
      <body className="antialiased" suppressHydrationWarning>
        <Providers session={session} nonce={nonce}>
          <LanguageProvider initialLanguage={lang}>
            <VitalsReporter />
            {children}
            <Toaster />
            {/* CAM-434: global floating chat entry point — mounted once here
                (not per-page) so it floats on every route; useLanguage() is
                available at this depth. Panel + ambient canvas stay
                next/dynamic(ssr:false), lazy-loaded only after the first tap. */}
            <AiChatLauncher />
          </LanguageProvider>
        </Providers>
      </body>
    </html>
  );
}

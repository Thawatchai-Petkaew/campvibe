import type { Metadata } from "next";
import { Inter, Outfit, Sarabun } from "next/font/google";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { Providers } from "@/components/Providers";
import VitalsReporter from "@/components/vitals-reporter";

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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={cn("font-sans", inter.variable, outfit.variable, sarabun.variable)}>
      <body className="antialiased" suppressHydrationWarning>
        <Providers>
          <LanguageProvider>
            <VitalsReporter />
            {children}
            <Toaster />
          </LanguageProvider>
        </Providers>
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import { Inter, Outfit } from "next/font/google";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { Providers } from "@/components/Providers";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CampVibe | Professional Camping Ecosystem",
  description: "Find and book the best camping experiences",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={[inter.variable, outfit.variable, "antialiased"].join(" ")} suppressHydrationWarning>
        <Providers>
          <LanguageProvider>
            {children}
            <Toaster />
          </LanguageProvider>
        </Providers>
      </body>
    </html>
  );
}

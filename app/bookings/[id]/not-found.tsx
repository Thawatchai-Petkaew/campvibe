"use client";

// AC#7 + AC#10: 404-style page for missing OR forbidden bookings.
// Both cases render the same UI — no existence leak.
// Must be "use client" to use useLanguage() hook.

import Link from "next/link";
import { CircleX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Navbar } from "@/components/Navbar";
import { useLanguage } from "@/contexts/LanguageContext";

export default function BookingNotFound() {
  const { t } = useLanguage();

  return (
    <main className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 md:px-6 py-8 md:py-12">
        <div className="max-w-2xl mx-auto">
          <div className="bg-card rounded-3xl p-12 text-center border border-border shadow-sm">
            <CircleX
              className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4"
              aria-hidden="true"
            />
            <h1 className="text-xl font-bold text-foreground mb-2">
              {t.bookings.notFound}
            </h1>
            <p className="text-muted-foreground mb-8">
              {t.bookings.notFoundDescription}
            </p>
            <Button asChild variant="outline" size="default" className="rounded-full h-11 px-6 font-semibold">
              <Link href="/bookings">
                {t.bookings.detail.backToBookings}
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </main>
  );
}

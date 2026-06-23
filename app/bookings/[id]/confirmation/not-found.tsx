import Link from "next/link";
import { FileQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Navbar } from "@/components/Navbar";
import { getTranslations } from "@/locales/translations";

export default function BookingConfirmationNotFound() {
  const t = getTranslations("th");

  return (
    <main className="min-h-screen bg-background">
      <Navbar />

      <div className="container mx-auto px-6 py-24">
        <div className="max-w-sm mx-auto text-center space-y-6">
          <FileQuestion
            className="w-16 h-16 text-muted-foreground/40 mx-auto"
            aria-hidden="true"
          />
          <h1 className="text-2xl font-bold text-foreground">
            {t.bookings.notFound}
          </h1>
          <p className="text-muted-foreground text-sm">
            {t.bookings.notFoundDescription}
          </p>
          <Button
            asChild
            size="lg"
            variant="default"
            data-testid="btn--not-found-view-bookings"
          >
            <Link href="/bookings">{t.bookings.viewAllBookings}</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}

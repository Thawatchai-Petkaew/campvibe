"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Store, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";

interface HostOnboardingFabProps {
  isLoggedIn: boolean;
}

export function HostOnboardingFab({ isLoggedIn }: HostOnboardingFabProps) {
  const { t } = useLanguage();
  const pathname = usePathname();
  const [shouldShow, setShouldShow] = useState(false);

  useEffect(() => {
    if (!isLoggedIn) return;
    if (!pathname) return;
    if (pathname.startsWith("/dashboard")) return;
    if (pathname.startsWith("/host")) return;

    const run = async () => {
      try {
        const res = await fetch("/api/access/dashboard");
        if (!res.ok) return;
        const data = await res.json();
        setShouldShow(!data?.canAccessDashboard);
      } catch {
        // ignore
      }
    };

    run();
  }, [isLoggedIn, pathname]);

  if (!isLoggedIn || !shouldShow) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <Link href="/host">
        <Button className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20">
          <Store className="w-4 h-4 mr-2" />
          {t.nav?.campYourHome || "Become a Host"}
          <ArrowRight className="w-4 h-4 ml-2 opacity-80" />
        </Button>
      </Link>
    </div>
  );
}


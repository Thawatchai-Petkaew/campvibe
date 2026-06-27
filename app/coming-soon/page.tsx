// CAM-237 LAUNCH-1: Coming Soon holding page.
// Static server component — NO auth(), NO Prisma, NO DB calls.
// Rendered by middleware rewrite when COMING_SOON_MODE=true (backend wires gate).
// Copy: getTranslations('th') default — Thai first per the brief.

import { getTranslations } from "@/locales/translations";
import { SpriteWalker } from "@/components/SpriteWalker";

export const metadata = {
  title: "CampVibe — เร็วๆ นี้",
  robots: { index: false, follow: false },
};

export default function ComingSoonPage() {
  const t = getTranslations("th");
  const cs = t.comingSoon;

  return (
    <main
      className="min-h-screen bg-background flex items-center justify-center py-16 md:py-24 px-6"
      data-testid="page--coming-soon"
    >
      <div className="flex flex-col items-center text-center max-w-sm md:max-w-md w-full">
        {/* Logo */}
        <img
          src="/logo.png"
          alt="CampVibe"
          width={80}
          height={80}
          data-testid="img--coming-soon-logo"
          className="h-20 w-auto mb-8 object-contain"
        />

        {/* Mascot walk animation — client island */}
        <div className="mb-6">
          <SpriteWalker alt={cs.mascotAlt} />
        </div>

        {/* Title */}
        <h1
          className="text-2xl font-semibold text-foreground mb-2"
          data-testid="heading--coming-soon-title"
        >
          {cs.title}
        </h1>

        {/* Subtitle */}
        <p
          className="text-base text-muted-foreground max-w-xs mx-auto"
          data-testid="text--coming-soon-subtitle"
        >
          {cs.subtitle}
        </p>
      </div>
    </main>
  );
}

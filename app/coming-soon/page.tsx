// CAM-237 LAUNCH-1 (redesign): Coming Soon holding page.
// Reuses ErrorState variant="coming-soon" — identical layout/treatment to the 404 page.
// SERVER component — NO auth(), NO Prisma, NO DB calls.
// force-dynamic: required so the per-request CSP nonce is stamped (CAM-218 lesson).
// No Navbar: clean gated-site holding page (users cannot navigate anywhere).
export const dynamic = "force-dynamic";

import { ErrorState } from "@/components/ErrorState";

export const metadata = {
  title: "CampVibe — เร็วๆ นี้",
  robots: { index: false, follow: false },
};

export default function ComingSoonPage() {
  return (
    <main
      className="min-h-screen bg-background"
      data-testid="page--coming-soon"
    >
      <ErrorState variant="coming-soon" />
    </main>
  );
}

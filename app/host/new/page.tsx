import { auth } from "@/lib/auth";
import { Navbar } from "@/components/Navbar";
import { CampgroundForm } from "@/components/CampgroundForm";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function HostNewCampSitePage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login?callbackUrl=/host/new");
  }

  const currentUser = { name: session.user.name ?? null, image: (session.user as any).image ?? null };

  return (
    <div className="min-h-screen bg-background">
      <Navbar currentUser={currentUser} />
      <div className="pt-2">
        <CampgroundForm />
      </div>
    </div>
  );
}


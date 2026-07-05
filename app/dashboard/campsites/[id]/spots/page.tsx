"use client";

// CAM-352 -> CAM-361: this route is now a thin shell over the shared
// SpotManagementSection (list/create/edit/soft-delete + zone grouping +
// filter chips, components/spot-management-section.tsx) so the exact same
// component also embeds on the campsite edit page below the main form. All
// behavior lives in the shared component - do not re-add page-local logic
// here.

import { useParams } from "next/navigation";
import { SpotManagementSection } from "@/components/spot-management-section";

export default function CampSiteSpotsPage() {
  const params = useParams();
  const campSiteId = (params?.id as string) || "";

  return <SpotManagementSection campSiteId={campSiteId} variant="page" />;
}

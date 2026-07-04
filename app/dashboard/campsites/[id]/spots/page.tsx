"use client";

// CAM-352 — Host spot-management screen: list / create / edit / soft-delete a
// camp's spots. Mirrors the fetch/permission/skeleton pattern already
// established by app/dashboard/campsites/[id]/availability/page.tsx (the
// story's own "Pattern to mirror" seam) — same client-fetch + useMinimumLoading
// + ConfirmDialog shape, applied to the spots CRUD surface instead of
// blocked-dates. Entry point: CampgroundForm's PER-SPOT Capacity card already
// links here (components/CampgroundForm.tsx) — no change needed there (BR-6).

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { Pencil, Plus, Tent, Trash2 } from "lucide-react";

import { useLanguage } from "@/contexts/LanguageContext";
import { useMinimumLoading } from "@/lib/hooks/use-minimum-loading";
import type { SpotDTO } from "@/types/api";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorBanner } from "@/components/ui/error-banner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ImageWithFallback } from "@/components/ui/image-with-fallback";
import { SpotFormDialog } from "@/components/spot-form-dialog";

export default function CampSiteSpotsPage() {
  const params = useParams();
  const campSiteId = (params?.id as string) || "";
  const { t, formatCurrency } = useLanguage();
  const copy = t.spotManagement;

  const [spots, setSpots] = useState<SpotDTO[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const showSkeleton = useMinimumLoading(loading, { delay: 300, minDisplay: 400 });

  // AC-9/EC-8: proactively hide write controls unless the signed-in user is
  // this camp's owner or a platform admin (the two "always allowed" bypasses
  // in requireCampSitePermission, lib/auth-utils.ts). A team member's granted
  // CAMPSITE_UPDATE/CAMPSITE_DELETE is still honored by the API itself (a
  // direct request never fails to enforce it) — this client gate is a
  // deliberately conservative default (fail closed to read-only rather than
  // fail open), not the authoritative check (BR-4 owns that server-side).
  const [canManage, setCanManage] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<SpotDTO | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<SpotDTO | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadData = useCallback(async () => {
    if (!campSiteId) return;
    setLoading(true);
    setLoadError(false);
    try {
      const [spotsRes, campRes, sessionRes] = await Promise.all([
        fetch(`/api/campsites/${campSiteId}/spots`, { cache: "no-store" }),
        fetch(`/api/campsites/${campSiteId}`, { cache: "no-store" }),
        fetch(`/api/auth/session`, { cache: "no-store" }),
      ]);

      if (!spotsRes.ok) throw new Error("Failed to load spots");
      const spotsData = await spotsRes.json();
      setSpots(Array.isArray(spotsData) ? spotsData : []);

      let ownerOrAdmin = false;
      if (campRes.ok && sessionRes.ok) {
        const camp = await campRes.json();
        const session = await sessionRes.json();
        const userId = session?.user?.id;
        ownerOrAdmin = !!userId && (session?.user?.role === "ADMIN" || camp?.operatorId === userId);
      }
      setCanManage(ownerOrAdmin);
    } catch (err) {
      console.error("Failed to load campsite spots", err);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [campSiteId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const openCreate = () => {
    setEditTarget(null);
    setFormOpen(true);
  };

  const openEdit = (spot: SpotDTO) => {
    setEditTarget(spot);
    setFormOpen(true);
  };

  const handleSaved = () => {
    setFormOpen(false);
    loadData();
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/campsites/${campSiteId}/spots/${deleteTarget.id}`, {
        method: "DELETE",
      });

      // AC-9/BR-4: delete requires CAMPSITE_DELETE separately from CAMPSITE_UPDATE.
      if (res.status === 403) {
        toast.error(copy.forbiddenMessage);
        return;
      }

      // EC-3: already gone / cross-camp id — refresh either way (BR-1/EC-4).
      if (res.status === 404) {
        toast.error(copy.notFoundMessage);
        setDeleteTarget(null);
        await loadData();
        return;
      }

      if (!res.ok) {
        toast.error(copy.deleteFailed);
        return;
      }

      toast.success(copy.deleteSuccess);
      setDeleteTarget(null);
      await loadData();
    } catch (err) {
      console.error("Failed to delete spot", err);
      toast.error(copy.deleteFailed);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6" data-testid="page--campsite-spots">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold text-foreground tracking-tight">{copy.pageTitle}</h1>
          <p className="text-muted-foreground">{copy.pageDescription}</p>
        </div>
        {canManage && (
          <Button
            onClick={openCreate}
            className="h-11 px-6 rounded-full font-bold shadow-lg shadow-primary/20"
            data-testid="btn--spots-add"
          >
            <Plus className="w-4 h-4 mr-2" />
            {copy.addButton}
          </Button>
        )}
      </div>

      <div aria-busy={showSkeleton} data-testid="section--spots-list">
        <div role="status" aria-live="polite" className="sr-only">
          {showSkeleton ? t.common.loading_sr : ""}
        </div>

        {showSkeleton ? (
          <div className="space-y-3" aria-hidden="true" data-testid="skeleton--spots-list">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-card rounded-2xl border border-border p-4 flex items-center gap-4">
                <Skeleton className="h-16 w-16 rounded-xl shrink-0" />
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <Skeleton className="h-11 w-11 rounded-full" />
              </div>
            ))}
          </div>
        ) : loadError ? (
          <div className="bg-card rounded-3xl border border-border p-8 flex flex-col items-center gap-3 text-center">
            <ErrorBanner message={copy.loadFailed} data-testid="alert--spots-load-error" />
            <Button variant="outline" onClick={loadData} data-testid="btn--spots-retry">
              {t.common.retry}
            </Button>
          </div>
        ) : !spots || spots.length === 0 ? (
          <div
            className="bg-card rounded-3xl border border-border p-12 flex flex-col items-center gap-2 text-center text-muted-foreground"
            data-testid="empty--spots-list"
          >
            <Tent className="w-8 h-8 text-muted-foreground/40" aria-hidden="true" />
            <p className="font-medium text-foreground">{copy.emptyTitle}</p>
            <p className="text-sm">{copy.emptyDescription}</p>
          </div>
        ) : (
          <div className="bg-card rounded-3xl shadow-sm border border-border divide-y divide-border/60">
            {spots.map((spot) => {
              const firstImage = spot.images && spot.images.length > 0 ? spot.images[0] : null;
              return (
                <div
                  key={spot.id}
                  className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3"
                  data-testid={`row--spot-${spot.id}`}
                >
                  <div className="flex items-center gap-4 min-w-0">
                    {firstImage ? (
                      <div className="relative h-16 w-16 rounded-xl overflow-hidden shrink-0 border border-border">
                        <ImageWithFallback
                          src={firstImage.url}
                          alt={spot.name}
                          className="w-full h-full"
                          imgClassName="object-cover"
                          sizes="64px"
                        />
                        {firstImage.kind === "PANORAMA" && (
                          <Badge
                            variant="overlay"
                            className="absolute bottom-0.5 left-0.5 px-1"
                            data-testid={`badge--spot-panorama-${spot.id}`}
                          >
                            {copy.panoramaBadge}
                          </Badge>
                        )}
                      </div>
                    ) : (
                      <div className="h-16 w-16 rounded-xl shrink-0 bg-muted flex items-center justify-center">
                        <Tent className="w-6 h-6 text-muted-foreground/40" aria-hidden="true" />
                      </div>
                    )}
                    <div className="flex flex-col gap-1 min-w-0">
                      <div className="flex items-center gap-2 font-semibold text-foreground">
                        <span className="truncate">{spot.name}</span>
                        {spot.zone && <Badge variant="secondary">{spot.zone}</Badge>}
                      </div>
                      <div className="flex items-center gap-2 flex-wrap text-sm text-muted-foreground">
                        {spot.maxCampers != null && (
                          <span data-testid={`text--spot-capacity-${spot.id}`}>
                            {copy.capacityLabel.replace("{N}", String(spot.maxCampers))}
                          </span>
                        )}
                        <span className="tabular-nums">{formatCurrency(Number(spot.pricePerNight))}</span>
                      </div>
                    </div>
                  </div>

                  {canManage && (
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        variant="outline"
                        size="icon"
                        aria-label={`${copy.formTitleEdit}: ${spot.name}`}
                        onClick={() => openEdit(spot)}
                        className="rounded-full"
                        data-testid={`btn--spot-edit-${spot.id}`}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        aria-label={`${copy.deleteAriaLabel}: ${spot.name}`}
                        onClick={() => setDeleteTarget(spot)}
                        className="rounded-full hover:text-destructive hover:border-destructive hover:bg-destructive/10"
                        data-testid={`btn--spot-delete-${spot.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {canManage && (
        <SpotFormDialog
          open={formOpen}
          onOpenChange={setFormOpen}
          campSiteId={campSiteId}
          spot={editTarget}
          onSaved={handleSaved}
        />
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={copy.deleteConfirmTitle}
        confirmLabel={copy.deleteConfirmLabel}
        cancelLabel={copy.deleteCancelLabel}
        onConfirm={confirmDelete}
        isLoading={deleting}
        destructive
        data-testid="modal--spots-delete-confirm"
      />
    </div>
  );
}

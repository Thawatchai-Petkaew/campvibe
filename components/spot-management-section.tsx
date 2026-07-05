"use client";

// CAM-361 — shared spot list + management surface. Extracted from the
// standalone spots route (CAM-352, app/dashboard/campsites/[id]/spots/page.tsx)
// so the SAME component renders both there (variant="page") AND embedded on
// the campsite edit page below the main form (variant="embedded") - spots
// were previously invisible on the edit page behind a Capacity-card link
// only. Mirrors the fetch/permission/skeleton pattern already established by
// app/dashboard/campsites/[id]/availability/page.tsx.
//
// Adds zone grouping + a single-select FilterChip row on top of the CAM-352
// list/create/edit/soft-delete behavior: spots are grouped by their
// free-text `zone` field (lib/spot-zone-grouping.ts), with the no-zone
// bucket always sorted last. Reuses <FilterChip variant="pill"> exactly per
// its existing usage in components/FilterModal.tsx - no new primitive, no
// new token.

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Pencil, Plus, Tent, Trash2 } from "lucide-react";

import { useLanguage } from "@/contexts/LanguageContext";
import { useMinimumLoading } from "@/lib/hooks/use-minimum-loading";
import { groupSpotsByZone } from "@/lib/spot-zone-grouping";
import type { SpotDTO } from "@/types/api";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorBanner } from "@/components/ui/error-banner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ImageWithFallback } from "@/components/ui/image-with-fallback";
import { FilterChip } from "@/components/ui/filter-chip";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SpotFormDialog } from "@/components/spot-form-dialog";

// Sentinel for the single-select "show every group" chip - distinct from any
// real zone string or from lib/spot-zone-grouping's UNASSIGNED_ZONE_KEY.
const ALL_ZONES_VALUE = "__all__";

interface SpotManagementSectionProps {
  campSiteId: string;
  /**
   * "page" - the standalone /dashboard/campsites/[id]/spots route's full
   * body (h1 title + description, data-testid="page--campsite-spots").
   * "embedded" - the section embedded below the campsite edit form's main
   * <form> (Card wrapper, CardTitle heading). The caller gates this to
   * edit mode only - a create-mode camp has no id yet.
   */
  variant: "page" | "embedded";
}

export function SpotManagementSection({ campSiteId, variant }: SpotManagementSectionProps) {
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
  // direct request never fails to enforce it) - this client gate is a
  // deliberately conservative default (fail closed to read-only rather than
  // fail open), not the authoritative check (BR-4 owns that server-side).
  const [canManage, setCanManage] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<SpotDTO | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<SpotDTO | null>(null);
  const [deleting, setDeleting] = useState(false);

  // CAM-361 - single-select zone filter above the grouped list. Default =
  // the "all" chip (every group visible).
  const [activeZone, setActiveZone] = useState<string>(ALL_ZONES_VALUE);

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

  const zoneGroups = useMemo(() => groupSpotsByZone(spots ?? []), [spots]);

  // Defensive reset: if the selected zone chip's group disappears entirely
  // after a reload (e.g. the last spot in that zone was edited/removed),
  // fall back to "all" rather than silently showing an empty filtered list.
  useEffect(() => {
    if (activeZone === ALL_ZONES_VALUE) return;
    if (!zoneGroups.some((group) => group.key === activeZone)) {
      setActiveZone(ALL_ZONES_VALUE);
    }
  }, [zoneGroups, activeZone]);

  const visibleGroups = useMemo(
    () => (activeZone === ALL_ZONES_VALUE ? zoneGroups : zoneGroups.filter((group) => group.key === activeZone)),
    [zoneGroups, activeZone]
  );

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

      // EC-3: already gone / cross-camp id - refresh either way (BR-1/EC-4).
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

  const renderSpotRow = (spot: SpotDTO) => {
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
  };

  const listBody = (
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
        <div className="space-y-6">
          {/* CAM-361 - single-select zone filter chips: reuses FilterChip
              "pill" exactly per components/FilterModal.tsx's usage pattern. */}
          <div className="flex flex-wrap gap-3" data-testid="section--spots-zone-filter">
            <FilterChip
              variant="pill"
              selected={activeZone === ALL_ZONES_VALUE}
              onToggle={() => setActiveZone(ALL_ZONES_VALUE)}
              label={copy.filterAllLabel}
              data-testid="filter-chip--spot-zone-all"
            />
            {zoneGroups.map((group, index) => (
              <FilterChip
                key={group.key}
                variant="pill"
                selected={activeZone === group.key}
                onToggle={() => setActiveZone(group.key)}
                label={group.isUnassigned ? copy.unassignedZoneLabel : group.key}
                data-testid={`filter-chip--spot-zone-${index}`}
              />
            ))}
          </div>

          {visibleGroups.map((group, index) => (
            <div key={group.key} data-testid={`section--spot-zone-group-${index}`}>
              <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3 px-1">
                {group.isUnassigned ? copy.unassignedZoneLabel : group.key}
              </h3>
              <div className="bg-card rounded-3xl shadow-sm border border-border divide-y divide-border/60">
                {group.spots.map(renderSpotRow)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const dialogs = (
    <>
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
    </>
  );

  if (variant === "embedded") {
    return (
      <Card className="border-border shadow-sm" data-testid="section--spots-management">
        <CardHeader className="border-b border-border pb-4">
          <CardTitle className="text-lg font-bold text-foreground">{copy.pageTitle}</CardTitle>
          {canManage && (
            <CardAction>
              <Button
                onClick={openCreate}
                className="h-11 px-6 rounded-full font-bold shadow-lg shadow-primary/20"
                data-testid="btn--spots-add"
              >
                <Plus className="w-4 h-4 mr-2" />
                {copy.addButton}
              </Button>
            </CardAction>
          )}
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          <p className="text-sm text-muted-foreground -mt-2">{copy.pageDescription}</p>
          {listBody}
        </CardContent>
        {dialogs}
      </Card>
    );
  }

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

      {listBody}
      {dialogs}
    </div>
  );
}

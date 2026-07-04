"use client";

// CAM-56 — Host-managed BlockedDate page (list + create + cancel).
// Scope: camp-wide + per-spot date blocks. The calendar-grid VISUALIZATION
// (colored days on a month view) is explicitly out of scope here — see H-3.2.
// This page is the list+form management surface the ticket's Story calls for
// as an alternative to the (out-of-scope) calendar UI: "...or a separate page".

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import type { DateRange } from "react-day-picker";
import { CalendarOff, Lock, Plus, Trash2 } from "lucide-react";

import { useLanguage } from "@/contexts/LanguageContext";
import { useMinimumLoading } from "@/lib/hooks/use-minimum-loading";
import {
  createBlockedDateSchema,
  BLOCKED_DATE_REASON_MAX_LENGTH,
} from "@/lib/validations/blocked-dates";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { ErrorBanner } from "@/components/ui/error-banner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DatePickerWithRange } from "@/components/ui/date-range-picker";
import { ErrorState } from "@/components/ErrorState";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const WHOLE_CAMP_VALUE = "__whole_camp__";

interface SpotOption {
  id: string;
  name: string;
}

interface BlockedDateItem {
  id: string;
  spotId: string | null;
  spot?: { id: string; name: string } | null;
  startDate: string;
  endDate: string;
  reason: string | null;
}

function formatDate(value: string, language: "th" | "en"): string {
  return new Date(value).toLocaleDateString(language === "th" ? "th-TH" : "en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function CampSiteAvailabilityPage() {
  const params = useParams();
  const campSiteId = (params?.id as string) || "";
  const { t, language } = useLanguage();
  const copy = t.blockedDates;

  const [blocks, setBlocks] = useState<BlockedDateItem[] | null>(null);
  const [spots, setSpots] = useState<SpotOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const showSkeleton = useMinimumLoading(loading, { delay: 300, minDisplay: 400 });

  const [formOpen, setFormOpen] = useState(false);
  const [range, setRange] = useState<DateRange | undefined>(undefined);
  const [spotId, setSpotId] = useState<string>(WHOLE_CAMP_VALUE);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [dateError, setDateError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<BlockedDateItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadData = useCallback(async () => {
    if (!campSiteId) return;
    setLoading(true);
    setLoadError(false);
    setForbidden(false);
    try {
      const [blockedRes, spotsRes] = await Promise.all([
        fetch(`/api/campsites/${campSiteId}/blocked-dates`, { cache: "no-store" }),
        fetch(`/api/campsites/${campSiteId}/spots`, { cache: "no-store" }),
      ]);

      if (blockedRes.status === 401 || blockedRes.status === 403) {
        setForbidden(true);
        return;
      }
      if (!blockedRes.ok) throw new Error("Failed to load blocked dates");
      const blockedData = await blockedRes.json();
      setBlocks(Array.isArray(blockedData) ? blockedData : []);

      if (spotsRes.ok) {
        const spotsData = await spotsRes.json();
        setSpots(
          Array.isArray(spotsData)
            ? spotsData.map((s: { id: string; name: string }) => ({ id: s.id, name: s.name }))
            : []
        );
      }
    } catch (err) {
      console.error("Failed to load campsite availability data", err);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [campSiteId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const openForm = () => {
    setRange(undefined);
    setSpotId(WHOLE_CAMP_VALUE);
    setReason("");
    setReasonError(null);
    setDateError(null);
    setFormOpen(true);
  };

  const closeForm = () => setFormOpen(false);

  const handleReasonChange = (value: string) => {
    setReason(value);
    setReasonError(
      value.length > BLOCKED_DATE_REASON_MAX_LENGTH ? copy.reasonTooLong : null
    );
  };

  const handleSubmit = async () => {
    if (!range?.from || !range?.to) return;

    const body = {
      startDate: range.from.toISOString().split("T")[0],
      endDate: range.to.toISOString().split("T")[0],
      spotId: spotId === WHOLE_CAMP_VALUE ? null : spotId,
      reason: reason.trim() || undefined,
    };

    // Client-side pre-check with the SAME shared schema the server enforces
    // (one schema, client + server — .claude/rules/ux.md #1). Maps the failing
    // rule to the exact Thai copy the AC specifies before ever calling the API.
    const preCheck = createBlockedDateSchema.safeParse(body);
    if (!preCheck.success) {
      const issue = preCheck.error.issues[0];
      if (issue?.path[0] === "reason") {
        setReasonError(copy.reasonTooLong);
      } else if (issue?.message === "Cannot block a date in the past") {
        setDateError(copy.pastDateError);
      } else if (issue?.message?.includes("90 days")) {
        setDateError(copy.rangeTooLongError);
      } else {
        setDateError(copy.createFailed);
      }
      return;
    }
    setDateError(null);

    setSubmitting(true);
    try {
      const res = await fetch(`/api/campsites/${campSiteId}/blocked-dates`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await res.json().catch(() => null);

      if (!res.ok) {
        toast.error(copy.createFailed);
        return;
      }

      toast.success(copy.createSuccess);
      const overlapCount = payload?.warning?.overlappingBookingsCount;
      if (typeof overlapCount === "number" && overlapCount > 0) {
        toast.warning(copy.overlapWarning.replace("{N}", String(overlapCount)));
      }
      setFormOpen(false);
      await loadData();
    } catch (err) {
      console.error("Failed to create blocked date", err);
      toast.error(copy.createFailed);
    } finally {
      setSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(
        `/api/campsites/${campSiteId}/blocked-dates/${deleteTarget.id}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        toast.error(copy.deleteFailed);
        return;
      }
      toast.success(copy.deleteSuccess);
      setDeleteTarget(null);
      await loadData();
    } catch (err) {
      console.error("Failed to cancel blocked date", err);
      toast.error(copy.deleteFailed);
    } finally {
      setDeleting(false);
    }
  };

  if (forbidden) {
    return <ErrorState variant="forbidden" compact />;
  }

  return (
    <div className="space-y-6" data-testid="page--campsite-availability">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold text-foreground tracking-tight">
            {copy.pageTitle}
          </h1>
          <p className="text-muted-foreground">{copy.pageDescription}</p>
        </div>
        <Button
          onClick={openForm}
          className="h-11 px-6 rounded-full font-bold shadow-lg shadow-primary/20"
          data-testid="btn--availability-add"
        >
          <Plus className="w-4 h-4 mr-2" />
          {copy.addButton}
        </Button>
      </div>

      {formOpen && (
        <div
          className="bg-card rounded-3xl shadow-sm border border-border p-6 space-y-4"
          data-testid="form--availability-block"
        >
          <h2 className="text-lg font-bold text-foreground">{copy.formTitle}</h2>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground" htmlFor="availability-date-range">
              {copy.dateRangeLabel}
            </label>
            <DatePickerWithRange
              date={range}
              setDate={(next) => {
                setRange(next);
                setDateError(null);
              }}
              placeholder={copy.dateRangePlaceholder}
            />
          </div>

          {spots.length > 0 && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">{copy.spotLabel}</label>
              <Select value={spotId} onValueChange={setSpotId}>
                <SelectTrigger
                  className="w-full md:w-[280px] rounded-full"
                  data-testid="select--availability-spot"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={WHOLE_CAMP_VALUE}>{copy.spotWholeCamp}</SelectItem>
                  {spots.map((spot) => (
                    <SelectItem key={spot.id} value={spot.id}>
                      {spot.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground" htmlFor="availability-reason">
              {copy.reasonLabel}
            </label>
            <Textarea
              id="availability-reason"
              value={reason}
              onChange={(e) => handleReasonChange(e.target.value)}
              placeholder={copy.reasonPlaceholder}
              aria-invalid={!!reasonError}
              data-testid="input--availability-reason"
            />
            {reasonError && (
              <p className="text-sm text-destructive" role="alert">
                {reasonError}
              </p>
            )}
          </div>

          {dateError && (
            <ErrorBanner message={dateError} data-testid="alert--availability-date-error" />
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={closeForm}
              disabled={submitting}
              data-testid="btn--availability-cancel"
            >
              {copy.cancelLabel}
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={submitting || !range?.from || !range?.to || !!reasonError}
              data-testid="btn--availability-confirm"
            >
              {copy.confirmLabel}
            </Button>
          </div>
        </div>
      )}

      <div
        aria-busy={showSkeleton}
        data-testid="section--availability-list"
      >
        <div role="status" aria-live="polite" className="sr-only">
          {showSkeleton ? t.common.loading_sr : ""}
        </div>

        {showSkeleton ? (
          <div className="space-y-3" aria-hidden="true" data-testid="skeleton--availability-list">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="bg-card rounded-2xl border border-border p-4 flex items-center justify-between"
              >
                <div className="space-y-2">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <Skeleton className="h-9 w-9 rounded-full" />
              </div>
            ))}
          </div>
        ) : loadError ? (
          <div className="bg-card rounded-3xl border border-border p-8 flex flex-col items-center gap-3 text-center">
            <ErrorBanner message={copy.loadFailed} data-testid="alert--availability-load-error" />
            <Button variant="outline" onClick={loadData} data-testid="btn--availability-retry">
              {t.common.retry}
            </Button>
          </div>
        ) : !blocks || blocks.length === 0 ? (
          <div className="bg-card rounded-3xl border border-border p-12 flex flex-col items-center gap-2 text-center text-muted-foreground">
            <CalendarOff className="w-8 h-8 text-muted-foreground/40" />
            <p className="font-medium text-foreground">{copy.emptyTitle}</p>
            <p className="text-sm">{copy.emptyDescription}</p>
          </div>
        ) : (
          <div className="bg-card rounded-3xl shadow-sm border border-border divide-y divide-border/60">
            {blocks.map((block) => (
              <div
                key={block.id}
                className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3"
                data-testid={`row--availability-block-${block.id}`}
              >
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2 font-semibold text-foreground">
                    <Lock className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
                    {formatDate(block.startDate, language)} - {formatDate(block.endDate, language)}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={block.spotId ? "secondary" : "outline"}>
                      {block.spotId ? block.spot?.name ?? copy.scopeColumn : copy.spotWholeCamp}
                    </Badge>
                    {block.reason && (
                      <span className="text-sm text-muted-foreground">{block.reason}</span>
                    )}
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  aria-label={copy.deleteAriaLabel}
                  onClick={() => setDeleteTarget(block)}
                  className="h-10 w-10 rounded-full hover:text-destructive hover:border-destructive hover:bg-destructive/10"
                  data-testid={`btn--availability-delete-${block.id}`}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={
          deleteTarget
            ? copy.deleteConfirmTitle.replace(
                "{date}",
                `${formatDate(deleteTarget.startDate, language)} - ${formatDate(deleteTarget.endDate, language)}`
              )
            : ""
        }
        description={copy.deleteConfirmDescription}
        confirmLabel={copy.deleteConfirmLabel}
        cancelLabel={copy.deleteCancelLabel}
        onConfirm={confirmDelete}
        isLoading={deleting}
        destructive
        data-testid="modal--availability-delete-confirm"
      />
    </div>
  );
}

"use client";

// CAM-343 — Host hold create/list/release UI on the availability page.
//
// Sits as a sibling section between the CAM-55 month calendar and the CAM-56
// blocked-dates manager on the SAME availability page
// (app/dashboard/campsites/[id]/availability/page.tsx), under the SAME
// permission gate: the holds API (app/api/campsites/[id]/holds/*) requires
// the identical requireCampSitePermission(id, 'BOOKING_UPDATE') the
// blocked-dates API already requires, so the page's existing forbidden
// early-return already covers this section — no separate authz UI here
// (BR-9, AC-8).
//
// Reads/writes go through the EXISTING CAM-302 API only (POST/GET/DELETE
// holds) — no new endpoint, no schema change (story `## Data`).
//
// CAM-342 trace trap (BR-4): "live" = status ACTIVE AND expiresAt > now,
// never status alone — an expired hold keeps status ACTIVE forever
// (ADR-012 §4 lazy expiry, no cron). isLiveHold() below is the one place
// that predicate is applied client-side, mirroring
// lib/campsite-availability.ts's getActiveHoldsForRange exactly.

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import type { DateRange } from "react-day-picker";
import { Hourglass, Loader2, Plus, Unlock } from "lucide-react";

import { useLanguage } from "@/contexts/LanguageContext";
import { useMinimumLoading } from "@/lib/hooks/use-minimum-loading";
import { createHoldSchema, HOLD_DEFAULT_EXPIRY_MS, HOLD_MAX_EXPIRY_MS } from "@/lib/validations/holds";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ErrorBanner } from "@/components/ui/error-banner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DatePickerWithRange } from "@/components/ui/date-range-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const WHOLE_CAMP_VALUE = "__whole_camp__";

// BR-3: bounded presets, computed client-side as now + preset, never > 14 days.
// 48h and 14d reuse the SAME server constants (lib/validations/holds.ts) so
// the two extremes can never drift out of sync with the API's own bounds.
type ExpiryPreset = "48h" | "3d" | "7d" | "14d";

const EXPIRY_PRESET_MS: Record<ExpiryPreset, number> = {
  "48h": HOLD_DEFAULT_EXPIRY_MS,
  "3d": 3 * 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "14d": HOLD_MAX_EXPIRY_MS,
};

interface SpotOption {
  id: string;
  name: string;
}

// Shape of one GET /api/campsites/[id]/holds row (story `## Data`). Note:
// spotId only — no spot relation — spot names are resolved from the page's
// own spots list (BR-5).
export interface HoldItem {
  id: string;
  spotId: string | null;
  startDate: string;
  endDate: string;
  guests: number;
  note: string | null;
  status: "ACTIVE" | "RELEASED" | "CONVERTED";
  expiresAt: string;
}

interface HostHoldsSectionProps {
  campSiteId: string;
  /** The page's own spots list (already fetched for the blocked-dates form) — reused to resolve spot names (BR-5). */
  spots: SpotOption[];
  /** Called after a successful create or release so the page can bump the calendar's refreshKey (BR-7). */
  onHoldsChanged?: () => void;
}

// BR-4/CAM-342 trap: filter on status AND expiresAt — never status alone.
// Exported so the CAM-343 test suite can exercise the REAL predicate (not a
// source-inspection string match) — mirrors getActiveHoldsForRange exactly.
export function isLiveHold(hold: HoldItem): boolean {
  return hold.status === "ACTIVE" && new Date(hold.expiresAt).getTime() > Date.now();
}

function formatDate(value: string, language: "th" | "en"): string {
  return new Date(value).toLocaleDateString(language === "th" ? "th-TH" : "en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(value: string, language: "th" | "en"): string {
  return new Date(value).toLocaleString(language === "th" ? "th-TH" : "en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function HostHoldsSection({ campSiteId, spots, onHoldsChanged }: HostHoldsSectionProps) {
  const { t, language } = useLanguage();
  const copy = t.hostHolds;

  const [holds, setHolds] = useState<HoldItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const showSkeleton = useMinimumLoading(loading, { delay: 300, minDisplay: 400 });

  const [formOpen, setFormOpen] = useState(false);
  const [range, setRange] = useState<DateRange | undefined>(undefined);
  const [spotId, setSpotId] = useState<string>(WHOLE_CAMP_VALUE);
  const [guests, setGuests] = useState("1");
  const [guestsError, setGuestsError] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [expiryPreset, setExpiryPreset] = useState<ExpiryPreset>("48h");
  const [dateError, setDateError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [releaseTarget, setReleaseTarget] = useState<HoldItem | null>(null);
  const [releasing, setReleasing] = useState(false);

  const loadHolds = useCallback(async () => {
    if (!campSiteId) return;
    setLoading(true);
    setLoadError(false);
    try {
      const res = await fetch(`/api/campsites/${campSiteId}/holds`, { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load holds");
      const data = await res.json();
      setHolds(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to load holds", err);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [campSiteId]);

  useEffect(() => {
    loadHolds();
  }, [loadHolds]);

  // BR-4/AC-3/EC-3/EC-4: only status ACTIVE + not-yet-expired holds are shown.
  const liveHolds = (holds ?? []).filter(isLiveHold);

  const resolveSpotName = (holdSpotId: string | null): string => {
    if (!holdSpotId) return copy.spotWholeCamp;
    return spots.find((s) => s.id === holdSpotId)?.name ?? copy.spotUnknown;
  };

  const openForm = () => {
    setRange(undefined);
    setSpotId(WHOLE_CAMP_VALUE);
    setGuests("1");
    setGuestsError(null);
    setNote("");
    setExpiryPreset("48h");
    setDateError(null);
    setFormOpen(true);
  };

  const closeForm = () => setFormOpen(false);

  const handleGuestsChange = (value: string) => {
    setGuests(value);
    const parsed = Number(value);
    setGuestsError(Number.isInteger(parsed) && parsed >= 1 ? null : copy.guestsError);
  };

  const handleSubmit = async () => {
    if (!range?.from || !range?.to) return;

    const guestsValue = Number(guests);
    const body = {
      startDate: range.from.toISOString().split("T")[0],
      endDate: range.to.toISOString().split("T")[0],
      spotId: spotId === WHOLE_CAMP_VALUE ? null : spotId,
      guests: guestsValue,
      note: note.trim() || undefined,
      expiresAt: new Date(Date.now() + EXPIRY_PRESET_MS[expiryPreset]).toISOString(),
    };

    // Client pre-check with the SAME shared schema the server enforces — one
    // schema, client + server (.claude/rules/ux.md #1) — exactly as the
    // blocked-dates page pre-checks with createBlockedDateSchema.
    const preCheck = createHoldSchema.safeParse(body);
    if (!preCheck.success) {
      const issue = preCheck.error.issues[0];
      if (issue?.path[0] === "guests") {
        setGuestsError(copy.guestsError);
      } else if (issue?.path[0] === "endDate") {
        setDateError(copy.dateRangeError);
      } else {
        // issue.path[0] === "expiresAt" — bounded presets make this
        // unreachable in normal use; kept as the defensive fallback (BR-3).
        setDateError(copy.expiryOutOfRange);
      }
      return;
    }
    setDateError(null);
    setGuestsError(null);

    setSubmitting(true);
    try {
      const res = await fetch(`/api/campsites/${campSiteId}/holds`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });

      // BR-2: capacity is server-owned only — a 409 surfaces the server's
      // verbatim Thai copy inline; the form stays open so the host can adjust.
      if (res.status === 409) {
        setDateError(copy.capacityConflict);
        return;
      }

      // BR-3 defensive path: bounded presets mean this should never trigger
      // from a real host action, but if the server ever rejects an
      // out-of-range expiry, surface its verbatim copy rather than a generic one.
      if (res.status === 400) {
        setDateError(copy.expiryOutOfRange);
        return;
      }

      if (!res.ok) {
        toast.error(copy.createFailed);
        return;
      }

      toast.success(copy.createSuccess);
      setFormOpen(false);
      await loadHolds();
      onHoldsChanged?.();
    } catch (err) {
      console.error("Failed to create hold", err);
      toast.error(copy.createFailed);
    } finally {
      setSubmitting(false);
    }
  };

  const confirmRelease = async () => {
    if (!releaseTarget) return;
    setReleasing(true);
    try {
      const res = await fetch(`/api/campsites/${campSiteId}/holds/${releaseTarget.id}`, {
        method: "DELETE",
      });

      // BR-8/EC-8: a hold already released/gone by the time of this request
      // (the server's compare-and-swap) is harmless — refresh either way so
      // the row leaves the list.
      if (res.status === 404) {
        toast.error(copy.releaseNotFound);
        setReleaseTarget(null);
        await loadHolds();
        return;
      }

      if (!res.ok) {
        toast.error(copy.releaseFailed);
        return;
      }

      toast.success(copy.releaseSuccess);
      setReleaseTarget(null);
      await loadHolds();
      onHoldsChanged?.();
    } catch (err) {
      console.error("Failed to release hold", err);
      toast.error(copy.releaseFailed);
    } finally {
      setReleasing(false);
    }
  };

  return (
    <div
      className="bg-card rounded-3xl shadow-sm border border-border p-4 md:p-6 space-y-4"
      data-testid="section--host-holds"
    >
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-bold text-foreground">{copy.sectionTitle}</h2>
          <p className="text-sm text-muted-foreground">{copy.sectionDescription}</p>
        </div>
        <Button onClick={openForm} className="rounded-full font-bold" data-testid="btn--holds-add">
          <Plus className="w-4 h-4 mr-2" />
          {copy.addButton}
        </Button>
      </div>

      {formOpen && (
        <div
          className="rounded-2xl border border-border bg-background p-4 space-y-4"
          data-testid="form--holds-create"
        >
          <h3 className="text-base font-semibold text-foreground">{copy.formTitle}</h3>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground" htmlFor="holds-date-range">
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

          {/* EC-10: hidden when the camp has no spots — the hold applies to the whole camp. */}
          {spots.length > 0 && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">{copy.spotLabel}</label>
              <Select value={spotId} onValueChange={setSpotId}>
                <SelectTrigger
                  className="w-full md:w-[280px] rounded-full"
                  data-testid="select--holds-spot"
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

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground" htmlFor="holds-guests">
                {copy.guestsLabel}
              </label>
              <Input
                id="holds-guests"
                type="number"
                min={1}
                step={1}
                value={guests}
                onChange={(e) => handleGuestsChange(e.target.value)}
                aria-invalid={!!guestsError}
                data-testid="input--holds-guests"
              />
              {guestsError && (
                <p className="text-sm text-destructive" role="alert" data-testid="alert--holds-guests-error">
                  {guestsError}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">{copy.expiryLabel}</label>
              <Select
                value={expiryPreset}
                onValueChange={(value) => setExpiryPreset(value as ExpiryPreset)}
              >
                <SelectTrigger className="w-full rounded-full" data-testid="select--holds-expiry">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="48h">{copy.expiryPreset48h}</SelectItem>
                  <SelectItem value="3d">{copy.expiryPreset3d}</SelectItem>
                  <SelectItem value="7d">{copy.expiryPreset7d}</SelectItem>
                  <SelectItem value="14d">{copy.expiryPreset14d}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground" htmlFor="holds-note">
              {copy.noteLabel}
            </label>
            <Textarea
              id="holds-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={copy.notePlaceholder}
              data-testid="input--holds-note"
            />
          </div>

          {dateError && <ErrorBanner message={dateError} data-testid="alert--holds-date-error" />}

          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={closeForm}
              disabled={submitting}
              data-testid="btn--holds-cancel"
            >
              {copy.cancelLabel}
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={submitting || !range?.from || !range?.to || !!guestsError}
              data-testid="btn--holds-confirm"
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
              ) : (
                copy.confirmLabel
              )}
            </Button>
          </div>
        </div>
      )}

      <div aria-busy={showSkeleton} data-testid="section--holds-list">
        <div role="status" aria-live="polite" className="sr-only">
          {showSkeleton ? t.common.loading_sr : ""}
        </div>

        {showSkeleton ? (
          <div className="space-y-3" aria-hidden="true" data-testid="skeleton--holds-list">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="rounded-2xl border border-border p-4 flex items-center justify-between">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <Skeleton className="h-11 w-11 rounded-full" />
              </div>
            ))}
          </div>
        ) : loadError ? (
          <div className="rounded-2xl border border-border p-8 flex flex-col items-center gap-3 text-center">
            <ErrorBanner message={copy.loadFailed} data-testid="alert--holds-load-error" />
            <Button variant="outline" onClick={loadHolds} data-testid="btn--holds-retry">
              {t.common.retry}
            </Button>
          </div>
        ) : liveHolds.length === 0 ? (
          <div className="rounded-2xl border border-border p-12 flex flex-col items-center gap-2 text-center text-muted-foreground">
            <Hourglass className="w-8 h-8 text-muted-foreground/40" aria-hidden="true" />
            <p className="font-medium text-foreground">{copy.emptyTitle}</p>
            <p className="text-sm">{copy.emptyDescription}</p>
          </div>
        ) : (
          <div className="rounded-2xl border border-border divide-y divide-border/60">
            {liveHolds.map((hold) => (
              <div
                key={hold.id}
                className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3"
                data-testid={`row--holds-${hold.id}`}
              >
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2 font-semibold text-foreground">
                    <Hourglass className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
                    {formatDate(hold.startDate, language)} - {formatDate(hold.endDate, language)}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant={hold.spotId ? "secondary" : "outline"}>
                      {resolveSpotName(hold.spotId)}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      {copy.guestsCount.replace("{n}", String(hold.guests))}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {copy.expiresAtLabel.replace("{datetime}", formatDateTime(hold.expiresAt, language))}
                    </span>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  aria-label={copy.releaseAriaLabel}
                  onClick={() => setReleaseTarget(hold)}
                  className="rounded-full hover:text-destructive hover:border-destructive hover:bg-destructive/10"
                  data-testid={`btn--holds-release-${hold.id}`}
                >
                  <Unlock className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!releaseTarget}
        onOpenChange={(open) => !open && setReleaseTarget(null)}
        title={copy.releaseConfirmTitle}
        description={copy.releaseConfirmDescription}
        confirmLabel={copy.releaseConfirmLabel}
        cancelLabel={copy.releaseCancelLabel}
        onConfirm={confirmRelease}
        isLoading={releasing}
        destructive
        data-testid="modal--holds-release-confirm"
      />
    </div>
  );
}

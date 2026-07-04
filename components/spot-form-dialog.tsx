"use client";

// CAM-352 — Add/edit spot dialog. Reuses spotSchema (client + server share one
// schema, .claude/rules/ux.md #1) and the existing <ImageUpload> photo pipeline
// (extended additively with the per-photo panorama marker, BR-7/BR-8).

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { useLanguage } from "@/contexts/LanguageContext";
import { spotSchema, ViewTypeEnum } from "@/lib/validations/spot";
import type { SpotDTO, ImageKind } from "@/types/api";

import { Button } from "@/components/ui/button";
import { InputField } from "@/components/ui/input-field";
import { ErrorBanner } from "@/components/ui/error-banner";
import { ImageUpload } from "@/components/ImageUpload";
import { Dialog, DialogFooter } from "@/components/ui/dialog";
import { ModalContent, ModalHeader } from "@/components/ui/modal-shell";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const NO_VIEW_TYPE = "__unset__";

interface SpotFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campSiteId: string;
  /** The spot being edited, or null to create a new one. */
  spot: SpotDTO | null;
  /** Called after a successful create/update so the page can refetch + close. */
  onSaved: () => void;
}

export function SpotFormDialog({ open, onOpenChange, campSiteId, spot, onSaved }: SpotFormDialogProps) {
  const { t } = useLanguage();
  const copy = t.spotManagement;
  const isEditing = !!spot;

  const [name, setName] = useState("");
  const [zone, setZone] = useState("");
  const [viewType, setViewType] = useState<string>(NO_VIEW_TYPE);
  const [maxCampers, setMaxCampers] = useState("");
  const [maxTents, setMaxTents] = useState("");
  const [pricePerNight, setPricePerNight] = useState("");
  const [pricePerSite, setPricePerSite] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [imageKinds, setImageKinds] = useState<Record<string, ImageKind>>({});

  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Reset/populate the form whenever the dialog opens (create vs edit).
  useEffect(() => {
    if (!open) return;
    setHasSubmitted(false);
    setServerError(null);

    if (spot) {
      setName(spot.name ?? "");
      setZone(spot.zone ?? "");
      setViewType(spot.viewType ?? NO_VIEW_TYPE);
      setMaxCampers(spot.maxCampers != null ? String(spot.maxCampers) : "");
      setMaxTents(spot.maxTents != null ? String(spot.maxTents) : "");
      setPricePerNight(spot.pricePerNight != null ? String(Number(spot.pricePerNight)) : "");
      setPricePerSite(spot.pricePerSite != null ? String(Number(spot.pricePerSite)) : "");
      const spotImages = spot.images ?? [];
      setImages(spotImages.map((img) => img.url));
      const kinds: Record<string, ImageKind> = {};
      spotImages.forEach((img) => {
        kinds[img.url] = img.kind ?? "PHOTO";
      });
      setImageKinds(kinds);
    } else {
      setName("");
      setZone("");
      setViewType(NO_VIEW_TYPE);
      setMaxCampers("");
      setMaxTents("");
      setPricePerNight("");
      setPricePerSite("");
      setImages([]);
      setImageKinds({});
    }
  }, [open, spot]);

  // BR-3 — inline validation computed live from state (form-patterns.md):
  // a bound error shows as soon as a value is entered; the "required" cases
  // (name, price) only surface after a submit attempt (hasSubmitted).
  const nameError = hasSubmitted && !name.trim() ? copy.nameRequired : undefined;

  const priceNum = Number(pricePerNight);
  const priceInvalidRange = pricePerNight.trim() !== "" && (Number.isNaN(priceNum) || priceNum < 0 || priceNum > 100000);
  const priceMissing = hasSubmitted && pricePerNight.trim() === "";
  const priceError = priceInvalidRange || priceMissing ? copy.priceError : undefined;

  const maxCampersNum = Number(maxCampers);
  const maxCampersError =
    maxCampers.trim() !== "" && (!Number.isInteger(maxCampersNum) || maxCampersNum < 1)
      ? copy.maxCampersError
      : undefined;

  const handleRemoveImage = (url: string) => {
    setImages((prev) => prev.filter((u) => u !== url));
    setImageKinds((prev) => {
      const next = { ...prev };
      delete next[url];
      return next;
    });
  };

  const handleKindChange = (url: string, kind: ImageKind) => {
    setImageKinds((prev) => ({ ...prev, [url]: kind }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setHasSubmitted(true);
    setServerError(null);

    if (!name.trim() || priceInvalidRange || pricePerNight.trim() === "" || maxCampersError) {
      return;
    }

    const body = {
      name: name.trim(),
      zone: zone.trim() || undefined,
      viewType: viewType === NO_VIEW_TYPE ? undefined : viewType,
      maxCampers: maxCampers.trim() === "" ? undefined : Number(maxCampers),
      maxTents: maxTents.trim() === "" ? undefined : Number(maxTents),
      pricePerNight: Number(pricePerNight),
      pricePerSite: pricePerSite.trim() === "" ? undefined : Number(pricePerSite),
      images: images.map((url) => ({ url, kind: imageKinds[url] ?? ("PHOTO" as ImageKind) })),
    };

    // Client pre-check with the SAME shared schema the server enforces — one
    // schema, client + server (.claude/rules/ux.md #1).
    const preCheck = spotSchema.safeParse({ ...body, campSiteId });
    if (!preCheck.success) {
      setServerError(copy.saveFailed);
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(
        isEditing ? `/api/campsites/${campSiteId}/spots/${spot!.id}` : `/api/campsites/${campSiteId}/spots`,
        {
          method: isEditing ? "PUT" : "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        }
      );

      // AC-9/BR-4: no write permission on this camp.
      if (res.status === 403) {
        setServerError(copy.forbiddenMessage);
        return;
      }

      // EC-3: the spot was tampered with / already gone (cross-camp id, or
      // deleted meanwhile) — nothing left to edit, so close and let the page refetch.
      if (res.status === 404) {
        toast.error(copy.notFoundMessage);
        onOpenChange(false);
        onSaved();
        return;
      }

      // EC-2: keep the form open + the host's input intact on any other failure.
      if (!res.ok) {
        setServerError(copy.saveFailed);
        return;
      }

      toast.success(isEditing ? copy.updateSuccess : copy.createSuccess);
      onSaved();
    } catch (err) {
      console.error("Failed to save spot", err);
      setServerError(copy.saveFailed);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <ModalContent className="sm:max-w-xl" data-testid="modal--spot-form">
        <ModalHeader
          title={isEditing ? copy.formTitleEdit : copy.formTitleAdd}
          closeLabel={t.common.close}
          onClose={() => onOpenChange(false)}
        />

        <form
          noValidate
          onSubmit={handleSubmit}
          className="space-y-4 p-6 max-h-[70vh] overflow-y-auto"
          data-testid={isEditing ? "form--spot-edit" : "form--spot-create"}
        >
          {serverError && <ErrorBanner message={serverError} data-testid="alert--spot-save-error" />}

          <InputField
            label={copy.nameLabel}
            placeholder={copy.namePlaceholder}
            value={name}
            onChange={(e) => setName(e.target.value)}
            error={nameError}
            disabled={submitting}
            data-testid="input--spot-name"
          />

          <InputField
            label={copy.zoneLabel}
            placeholder={copy.zonePlaceholder}
            value={zone}
            onChange={(e) => setZone(e.target.value)}
            disabled={submitting}
            data-testid="input--spot-zone"
          />

          <div className="space-y-2">
            <label className="text-xs font-regular uppercase tracking-widest text-muted-foreground ml-4 block">
              {copy.viewTypeLabel}
            </label>
            <Select value={viewType} onValueChange={setViewType} disabled={submitting}>
              <SelectTrigger className="w-full rounded-full" data-testid="select--spot-viewtype">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_VIEW_TYPE}>{copy.viewTypeGeneral}</SelectItem>
                {ViewTypeEnum.options
                  .filter((option) => option !== "GENERAL")
                  .map((option) => (
                    <SelectItem key={option} value={option}>
                      {copy[`viewType${option.charAt(0)}${option.slice(1).toLowerCase()}` as keyof typeof copy]}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <InputField
              label={copy.maxCampersLabel}
              type="number"
              min={1}
              step={1}
              value={maxCampers}
              onChange={(e) => setMaxCampers(e.target.value)}
              error={maxCampersError}
              disabled={submitting}
              data-testid="input--spot-max-campers"
            />
            <InputField
              label={copy.maxTentsLabel}
              type="number"
              min={1}
              step={1}
              value={maxTents}
              onChange={(e) => setMaxTents(e.target.value)}
              disabled={submitting}
              data-testid="input--spot-max-tents"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <InputField
              label={copy.pricePerNightLabel}
              type="number"
              min={0}
              max={100000}
              value={pricePerNight}
              onChange={(e) => setPricePerNight(e.target.value)}
              error={priceError}
              disabled={submitting}
              data-testid="input--spot-price-per-night"
            />
            <InputField
              label={copy.pricePerSiteLabel}
              type="number"
              min={0}
              value={pricePerSite}
              onChange={(e) => setPricePerSite(e.target.value)}
              disabled={submitting}
              data-testid="input--spot-price-per-site"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-regular uppercase tracking-widest text-muted-foreground ml-4 block">
              {copy.photosLabel}
            </label>
            <ImageUpload
              value={images}
              onChange={setImages}
              onRemove={handleRemoveImage}
              disabled={submitting}
              imageKinds={imageKinds}
              onKindChange={handleKindChange}
            />
          </div>

          <DialogFooter className="gap-3 sm:gap-3 mt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
              className="rounded-full flex-1 sm:flex-initial"
              data-testid="btn--spot-cancel"
            >
              {copy.cancelLabel}
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              className="rounded-full flex-1 sm:flex-initial"
              data-testid="btn--spot-save"
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
              ) : (
                t.common.save
              )}
            </Button>
          </DialogFooter>
        </form>
      </ModalContent>
    </Dialog>
  );
}

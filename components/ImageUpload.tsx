"use client";

import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, X, Image as ImageIcon, Loader2 } from "lucide-react";
import clsx from "clsx";
import { useLanguage } from "@/contexts/LanguageContext";
import { ImageWithFallback } from "@/components/ui/image-with-fallback";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import type { ImageKind } from "@/types/api";

interface ImageUploadProps {
    value: string[];
    onChange: (value: string[]) => void;
    onRemove: (value: string) => void;
    disabled?: boolean;
    // CAM-352 (BR-7/BR-8): additive panorama-marker mode. Existing callers
    // (CampgroundForm etc.) that omit these two props are completely
    // unaffected — `value`/`onChange`/`onRemove` keep their string[] contract.
    // When both are provided, each thumbnail gains a "mark as panorama"
    // toggle + a badge, and the caller owns the url -> kind map.
    imageKinds?: Record<string, ImageKind>;
    onKindChange?: (url: string, kind: ImageKind) => void;
}

export function ImageUpload({
    value,
    onChange,
    onRemove,
    disabled,
    imageKinds,
    onKindChange
}: ImageUploadProps) {
    const { t } = useLanguage();
    const [isUploading, setIsUploading] = useState(false);

    const onDrop = useCallback(async (acceptedFiles: File[]) => {
        setIsUploading(true);
        try {
            const uploadPromises = acceptedFiles.map(async (file) => {
                const formData = new FormData();
                formData.append("file", file);

                const response = await fetch("/api/upload", {
                    method: "POST",
                    body: formData,
                });

                if (!response.ok) throw new Error("Upload failed");
                const data = await response.json();
                return data.url;
            });

            const urls = await Promise.all(uploadPromises);
            onChange([...value, ...urls]);
        } catch (error) {
            console.error("Upload error:", error);
            alert(t.newCampground.uploadFailed);
        } finally {
            setIsUploading(false);
        }
    }, [onChange, value]);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            "image/*": [".jpeg", ".jpg", ".png", ".webp"]
        },
        disabled: disabled || isUploading,
        maxFiles: 10
    });

    return (
        <div className="space-y-4 w-full">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {value.map((url) => {
                    const kind = imageKinds?.[url] ?? "PHOTO";
                    return (
                        <div key={url} className="relative aspect-square rounded-xl overflow-hidden group border border-border">
                            <ImageWithFallback
                                src={url}
                                alt={t.newCampground.imagePreview}
                                className="w-full h-full"
                                imgClassName="object-cover"
                                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
                            />
                            <button
                                type="button"
                                onClick={() => onRemove(url)}
                                className="absolute top-2 right-2 p-1.5 rounded-full bg-destructive text-destructive-foreground opacity-0 group-hover:opacity-100 transition shadow-sm"
                                data-testid="btn--album-image-remove"
                            >
                                <X className="w-4 h-4" />
                            </button>

                            {/* CAM-352 AC-11: per-photo panorama marker (additive — only when the caller opts in via onKindChange). */}
                            {onKindChange && (
                                <label className="absolute bottom-0 inset-x-0 flex items-center gap-1.5 px-2 py-1.5 bg-card/85 backdrop-blur-sm border-t border-border/40 cursor-pointer">
                                    <Checkbox
                                        checked={kind === "PANORAMA"}
                                        onCheckedChange={(checked) => onKindChange(url, checked ? "PANORAMA" : "PHOTO")}
                                        aria-label={t.spotManagement.panoramaToggleLabel}
                                        data-testid={`checkbox--spot-photo-panorama-${url}`}
                                    />
                                    <span className="text-xs text-foreground font-medium">
                                        {t.spotManagement.panoramaToggleLabel}
                                    </span>
                                </label>
                            )}
                            {kind === "PANORAMA" && (
                                <Badge
                                    variant="overlay"
                                    className="absolute top-2 left-2"
                                    data-testid={`badge--spot-photo-panorama-${url}`}
                                >
                                    {t.spotManagement.panoramaBadge}
                                </Badge>
                            )}
                        </div>
                    );
                })}

                {/* Dropzone Area */}
                <div
                    {...getRootProps()}
                    className={clsx(
                        "relative aspect-square rounded-xl border-2 border-dashed transition flex flex-col items-center justify-center gap-2 cursor-pointer",
                        isDragActive ? "border-primary bg-primary/10" : "border-border hover:border-primary hover:bg-muted",
                        (disabled || isUploading) && "opacity-50 cursor-not-allowed"
                    )}
                    data-testid="dropzone--album"
                >
                    <input {...getInputProps()} />
                    {isUploading ? (
                        <>
                            <Loader2 className="w-8 h-8 text-primary animate-spin" />
                            <span className="text-xs font-medium text-muted-foreground">{t.newCampground.uploading}</span>
                        </>
                    ) : (
                        <>
                            <div className="p-3 rounded-full bg-muted text-muted-foreground">
                                <Upload className="w-6 h-6" />
                            </div>
                            <div className="text-center px-2">
                                <p className="text-xs font-semibold text-foreground">{t.newCampground.addPhotos}</p>
                                <p className="text-xs text-muted-foreground mt-0.5">{t.newCampground.upTo10Images}</p>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {value.length === 0 && !isUploading && (
                <div className="flex flex-col items-center justify-center py-12 bg-muted rounded-2xl border border-border border-dashed">
                    <ImageIcon className="w-12 h-12 text-muted-foreground/50 mb-3" />
                    <p className="text-sm font-medium text-foreground">{t.newCampground.noPhotosUploaded}</p>
                    <p className="text-xs text-muted-foreground mt-1">{t.newCampground.uploadAtLeast5Photos}</p>
                </div>
            )}
        </div>
    );
}

"use client";

import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, X, Image as ImageIcon, Loader2 } from "lucide-react";
import clsx from "clsx";
import { useLanguage } from "@/contexts/LanguageContext";

interface ImageUploadProps {
    value: string[];
    onChange: (value: string[]) => void;
    onRemove: (value: string) => void;
    disabled?: boolean;
}

export function ImageUpload({
    value,
    onChange,
    onRemove,
    disabled
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
                {value.map((url) => (
                    <div key={url} className="relative aspect-square rounded-xl overflow-hidden group border border-border">
                        <img
                            src={url}
                            alt={t.newCampground.imagePreview}
                            className="object-cover w-full h-full"
                        />
                        <button
                            type="button"
                            onClick={() => onRemove(url)}
                            className="absolute top-2 right-2 p-1.5 rounded-full bg-rose-500 text-white opacity-0 group-hover:opacity-100 transition shadow-sm"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                ))}

                {/* Dropzone Area */}
                <div
                    {...getRootProps()}
                    className={clsx(
                        "relative aspect-square rounded-xl border-2 border-dashed transition flex flex-col items-center justify-center gap-2 cursor-pointer",
                        isDragActive ? "border-primary bg-primary/10" : "border-border hover:border-primary hover:bg-muted",
                        (disabled || isUploading) && "opacity-50 cursor-not-allowed"
                    )}
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
                                <p className="text-[10px] text-muted-foreground mt-0.5">{t.newCampground.upTo10Images}</p>
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

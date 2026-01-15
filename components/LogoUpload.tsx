"use client";

import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, X, Image as ImageIcon, Loader2 } from "lucide-react";
import clsx from "clsx";
import { useLanguage } from "@/contexts/LanguageContext";

interface LogoUploadProps {
    value: string;
    onChange: (value: string) => void;
    disabled?: boolean;
}

export function LogoUpload({
    value,
    onChange,
    disabled
}: LogoUploadProps) {
    const { t } = useLanguage();
    const [isUploading, setIsUploading] = useState(false);

    const onDrop = useCallback(async (acceptedFiles: File[]) => {
        if (acceptedFiles.length === 0) return;
        
        setIsUploading(true);
        try {
            const file = acceptedFiles[0];
            const formData = new FormData();
            formData.append("file", file);

            const response = await fetch("/api/upload", {
                method: "POST",
                body: formData,
            });

            if (!response.ok) throw new Error("Upload failed");
            const data = await response.json();
            onChange(data.url);
        } catch (error) {
            console.error("Upload error:", error);
            alert(t.newCampground.uploadFailed);
        } finally {
            setIsUploading(false);
        }
    }, [onChange]);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            "image/*": [".jpeg", ".jpg", ".png", ".webp", ".svg"]
        },
        disabled: disabled || isUploading,
        maxFiles: 1,
        multiple: false
    });

    const handleRemove = (e: React.MouseEvent) => {
        e.stopPropagation();
        onChange("");
    };

    return (
        <div className="space-y-4 w-full">
            {value ? (
                <div className="relative w-32 h-32 rounded-xl overflow-hidden group">
                    <img
                        src={value}
                        alt={t.newCampground.logoPreview}
                        className="object-contain w-full h-full"
                    />
                    <button
                        type="button"
                        onClick={handleRemove}
                        className="absolute top-2 right-2 p-1.5 rounded-full bg-rose-500 text-white opacity-0 group-hover:opacity-100 transition shadow-sm"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            ) : (
                <div
                    {...getRootProps()}
                    className={clsx(
                        "relative w-32 h-32 rounded-xl border-2 border-dashed transition flex flex-col items-center justify-center gap-2 cursor-pointer",
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
                                <p className="text-xs font-semibold text-foreground">{t.newCampground.uploadLogo}</p>
                                <p className="text-[10px] text-muted-foreground mt-0.5">{t.newCampground.uploadLogoFormats}</p>
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}

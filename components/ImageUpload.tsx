"use client";

import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, X, Image as ImageIcon, Loader2 } from "lucide-react";
import clsx from "clsx";

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
            alert("Failed to upload images. Please check your connection.");
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
                    <div key={url} className="relative aspect-square rounded-xl overflow-hidden group border border-gray-100">
                        <img
                            src={url}
                            alt="Upload preview"
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
                        isDragActive ? "border-green-800 bg-green-50" : "border-gray-200 hover:border-green-800 hover:bg-gray-50",
                        (disabled || isUploading) && "opacity-50 cursor-not-allowed"
                    )}
                >
                    <input {...getInputProps()} />
                    {isUploading ? (
                        <>
                            <Loader2 className="w-8 h-8 text-green-800 animate-spin" />
                            <span className="text-xs font-medium text-gray-500">Uploading...</span>
                        </>
                    ) : (
                        <>
                            <div className="p-3 rounded-full bg-gray-100 text-gray-600">
                                <Upload className="w-6 h-6" />
                            </div>
                            <div className="text-center px-2">
                                <p className="text-xs font-semibold text-gray-900">Add Photos</p>
                                <p className="text-[10px] text-gray-500 mt-0.5">Up to 10 images</p>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {value.length === 0 && !isUploading && (
                <div className="flex flex-col items-center justify-center py-12 bg-gray-50 rounded-2xl border border-gray-100 border-dashed">
                    <ImageIcon className="w-12 h-12 text-gray-300 mb-3" />
                    <p className="text-sm font-medium text-gray-600">No photos uploaded yet</p>
                    <p className="text-xs text-gray-400 mt-1">Upload at least 5 photos for best results</p>
                </div>
            )}
        </div>
    );
}

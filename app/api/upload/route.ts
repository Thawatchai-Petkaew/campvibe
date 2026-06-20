import { put } from "@vercel/blob";
import { NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { requireAuth } from "@/lib/auth-utils";

// Image content-types we accept → the extension we store (derived from the validated
// MIME, never from the attacker-controlled file.name).
const ALLOWED = new Map<string, string>([
    ["image/jpeg", ".jpg"],
    ["image/png", ".png"],
    ["image/webp", ".webp"],
    ["image/gif", ".gif"],
]);
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

export async function POST(request: Request): Promise<NextResponse> {
    // Require an authenticated session — this endpoint was previously open to anyone.
    const { error: authError } = await requireAuth();
    if (authError) return authError;

    const { searchParams } = new URL(request.url);
    // Sanitise the caller-supplied name (prevents path traversal in the local fallback).
    let filename = (searchParams.get("filename") || "campvibe-upload").replace(/[^a-zA-Z0-9._-]/g, "");
    if (!filename || /^\.+$/.test(filename)) filename = "campvibe-upload"; // reject empty / all-dots

    try {
        const formData = await request.formData();
        const file = formData.get("file") as File;

        if (!file) {
            return NextResponse.json({ error: "No file provided" }, { status: 400 });
        }

        // Validate by content-type allow-list (not the filename) + enforce a size cap.
        const ext = ALLOWED.get(file.type);
        if (!ext) {
            return NextResponse.json({ error: "Unsupported file type — images only (jpeg/png/webp/gif)" }, { status: 400 });
        }
        if (file.size > MAX_BYTES) {
            return NextResponse.json({ error: "File too large (max 5MB)" }, { status: 400 });
        }

        // 1. Try Vercel Blob (if token exists)
        if (process.env.BLOB_READ_WRITE_TOKEN) {
            try {
                const blob = await put(`${filename}${ext}`, file, { access: "public", contentType: file.type });
                return NextResponse.json(blob);
            } catch (blobError) {
                console.warn("Vercel Blob failed, falling back to local storage:", blobError);
            }
        }

        // 2. Fallback to Local Storage (public/uploads)
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const finalFilename = `${filename}-${uniqueSuffix}${ext}`;

        const uploadDir = path.join(process.cwd(), 'public', 'uploads');
        await mkdir(uploadDir, { recursive: true });

        const filepath = path.join(uploadDir, finalFilename);
        await writeFile(filepath, buffer);

        const url = `/uploads/${finalFilename}`;
        return NextResponse.json({ url });

    } catch (error) {
        console.error("Upload error:", error);
        return NextResponse.json({ error: "Upload failed" }, { status: 500 });
    }
}

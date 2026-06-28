import { put } from "@vercel/blob";
import { NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { requireAuth } from "@/lib/auth-utils";
import { checkRateLimit } from "@/lib/rate-limit";

// Image content-types we accept → the extension we store (derived from the validated
// MIME, never from the attacker-controlled file.name).
const ALLOWED = new Map<string, string>([
    ["image/jpeg", ".jpg"],
    ["image/png", ".png"],
    ["image/webp", ".webp"],
    ["image/gif", ".gif"],
]);
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

/**
 * Verify the file's magic bytes match the declared MIME type.
 * Returns true if the signature is valid, false if forged.
 *
 * Signatures checked:
 *   JPEG  — FF D8 FF
 *   PNG   — 89 50 4E 47 0D 0A 1A 0A
 *   WebP  — bytes 0-3: 52 49 46 46 (RIFF), bytes 8-11: 57 45 42 50 (WEBP)
 *   GIF   — 47 49 46 38 (GIF8)
 */
function verifyMagicBytes(buffer: Buffer, mimeType: string): boolean {
    switch (mimeType) {
        case "image/jpeg":
            return buffer.length >= 3 &&
                buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF;
        case "image/png":
            return buffer.length >= 8 &&
                buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47 &&
                buffer[4] === 0x0D && buffer[5] === 0x0A && buffer[6] === 0x1A && buffer[7] === 0x0A;
        case "image/webp":
            return buffer.length >= 12 &&
                buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 && // RIFF
                buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50;  // WEBP
        case "image/gif":
            return buffer.length >= 4 &&
                buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x38; // GIF8
        default:
            return false;
    }
}

export async function POST(request: Request): Promise<NextResponse> {
    // Require an authenticated session — this endpoint was previously open to anyone.
    const { error: authError, session } = await requireAuth();
    if (authError) return authError;

    // Rate-limit: 20 uploads per user per 15 minutes.
    const userId = session?.user?.id;
    if (!userId) {
        return NextResponse.json({ error: "ไม่พบข้อมูลผู้ใช้งาน" }, { status: 401 });
    }
    const rl = checkRateLimit(`upload:${userId}`, { limit: 20, windowMs: 15 * 60 * 1000 });
    if (!rl.allowed) {
        return NextResponse.json(
            { error: "อัปโหลดถึงขีดจำกัดแล้ว กรุณาลองใหม่ภายหลัง" },
            { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
        );
    }

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

        // Read buffer once upfront — used for both magic-byte check and local-storage fallback.
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        // Magic-byte check: verify the file's actual signature matches the declared MIME.
        // This must run BEFORE any put() to Blob so forged files are never stored.
        if (!verifyMagicBytes(buffer, file.type)) {
            return NextResponse.json({ error: "ไฟล์ไม่ถูกต้อง กรุณาอัปโหลดไฟล์ภาพจริง" }, { status: 400 });
        }

        // 1. Try Vercel Blob (if token exists)
        if (process.env.BLOB_READ_WRITE_TOKEN) {
            try {
                const blob = await put(`${filename}${ext}`, buffer, { access: "public", contentType: file.type });
                return NextResponse.json(blob);
            } catch (blobError) {
                // In production, Blob is the only storage path. Log server-side detail
                // and return a clear 503 — do NOT fall through to the FS write
                // (serverless filesystem is read-only on Vercel).
                if (process.env.NODE_ENV !== "development") {
                    console.error("upload: blob storage unavailable", blobError instanceof Error ? blobError.message : String(blobError));
                    return NextResponse.json(
                        { error: "ระบบจัดเก็บรูปยังไม่พร้อม กรุณาติดต่อผู้ดูแล" },
                        { status: 503 }
                    );
                }
                // Development only: log a warning and fall through to local FS.
                console.warn("Vercel Blob failed, falling back to local storage:", blobError instanceof Error ? blobError.message : String(blobError));
            }
        } else if (process.env.NODE_ENV !== "development") {
            // Production without a BLOB_READ_WRITE_TOKEN: fail clearly.
            // The serverless filesystem is read-only — a write would silently fail.
            console.error("upload: blob storage unavailable — BLOB_READ_WRITE_TOKEN is not set");
            return NextResponse.json(
                { error: "ระบบจัดเก็บรูปยังไม่พร้อม กรุณาติดต่อผู้ดูแล" },
                { status: 503 }
            );
        }

        // 2. Local-FS fallback — development only (public/uploads).
        // This branch is NEVER reached in production (guarded above).
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const finalFilename = `${filename}-${uniqueSuffix}${ext}`;

        const uploadDir = path.join(process.cwd(), 'public', 'uploads');
        await mkdir(uploadDir, { recursive: true });

        const filepath = path.join(uploadDir, finalFilename);
        await writeFile(filepath, buffer);

        const url = `/uploads/${finalFilename}`;
        return NextResponse.json({ url });

    } catch (error) {
        // Log only the message, never the raw error object (a future SDK could
        // nest a signed URL / token in an error property) — security CAM-239.
        console.error("Upload error:", error instanceof Error ? error.message : String(error));
        return NextResponse.json({ error: "Upload failed" }, { status: 500 });
    }
}

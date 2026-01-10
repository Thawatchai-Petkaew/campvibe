import { put } from "@vercel/blob";
import { NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

export async function POST(request: Request): Promise<NextResponse> {
    const { searchParams } = new URL(request.url);
    const filename = searchParams.get("filename") || "campvibe-upload";

    try {
        const formData = await request.formData();
        const file = formData.get("file") as File;

        if (!file) {
            return NextResponse.json({ error: "No file provided" }, { status: 400 });
        }

        // 1. Try Vercel Blob (if token exists)
        if (process.env.BLOB_READ_WRITE_TOKEN) {
            try {
                const blob = await put(filename, file, {
                    access: "public",
                });
                return NextResponse.json(blob);
            } catch (blobError) {
                console.warn("Vercel Blob failed, falling back to local storage:", blobError);
            }
        }

        // 2. Fallback to Local Storage (public/uploads)
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        // Create unique filename
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.name) || '.jpg';
        const finalFilename = `${filename}-${uniqueSuffix}${ext}`;

        // Ensure upload directory exists
        const uploadDir = path.join(process.cwd(), 'public', 'uploads');
        await mkdir(uploadDir, { recursive: true });

        const filepath = path.join(uploadDir, finalFilename);
        await writeFile(filepath, buffer);

        // Return local URL
        const url = `/uploads/${finalFilename}`;
        return NextResponse.json({ url });

    } catch (error) {
        console.error("Upload error:", error);
        return NextResponse.json({ error: "Upload failed" }, { status: 500 });
    }
}

import { put } from "@vercel/blob";
import { NextResponse } from "next/server";

export async function POST(request: Request): Promise<NextResponse> {
    const { searchParams } = new URL(request.url);
    const filename = searchParams.get("filename") || "campvibe-upload";

    try {
        const formData = await request.formData();
        const file = formData.get("file") as File;

        if (!file) {
            return NextResponse.json({ error: "No file provided" }, { status: 400 });
        }

        const blob = await put(filename, file, {
            access: "public",
        });

        return NextResponse.json(blob);
    } catch (error) {
        console.error("Blob upload error:", error);
        return NextResponse.json({ error: "Upload failed" }, { status: 500 });
    }
}

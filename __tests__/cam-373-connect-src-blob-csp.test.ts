/**
 * CAM-373 S2 review — connect-src 'blob:' guard.
 *
 * Fix 1 (ship-blocker, adversarial S2b review): three.js's GLTFLoader decodes
 * each embedded glTF texture via ImageBitmapLoader, which creates a same-origin
 * `blob:` URL for the embedded image bytes and loads it with `fetch()` —
 * governed by CSP connect-src, not img-src. Without `blob:` in connect-src,
 * every texture fetch is refused, every GLB load rejects, and canvas-3d.tsx's
 * per-asset `.catch` silently swaps in the fallback placeholder mesh for
 * every character/prop — the 3D scene never shows real textures.
 *
 * This test prevents a future CSP edit from silently re-breaking 3D textures
 * by asserting connect-src literally contains `blob:`, and that no OTHER
 * directive changed as a side effect (change was scoped to connect-src only).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const rootDir = join(__dirname, "..");

function readProxy(): string {
    return readFileSync(join(rootDir, "proxy.ts"), "utf-8");
}

// Executable lines only — proxy.ts's own doc comment ABOVE the connect-src
// array entry also mentions the words "connect-src"/"img-src" in prose, so a
// naive .find() on the raw source can match the comment instead of the real
// directive string. Same filter convention as sec3-csp-nonce.test.ts.
function executableLines(src: string): string[] {
    return src
        .split("\n")
        .filter((l) => !l.trimStart().startsWith("*") && !l.trimStart().startsWith("//"));
}

function connectSrcLine(src: string): string {
    return executableLines(src).find((l) => l.includes("connect-src '")) ?? "";
}

describe("CAM-373 S2 review — proxy.ts connect-src allows blob: (3D GLB textures)", () => {
    it("connect-src directive contains blob:", () => {
        const line = connectSrcLine(readProxy());
        expect(line).toContain("blob:");
    });

    it("connect-src still allows 'self' and the OpenStreetMap tile origin (pre-existing, unchanged)", () => {
        const line = connectSrcLine(readProxy());
        expect(line).toContain("connect-src 'self'");
        expect(line).toContain("https://*.tile.openstreetmap.org");
    });

    it("img-src is NOT changed by this fix — still contains its own pre-existing blob: entry", () => {
        const imgSrcLine = executableLines(readProxy()).find((l) => l.includes("img-src '")) ?? "";
        expect(imgSrcLine).toContain("blob:");
        expect(imgSrcLine).toContain("https://*.public.blob.vercel-storage.com");
    });

    it("script-src is NOT changed by this fix — still contains strict-dynamic", () => {
        expect(readProxy()).toContain("'strict-dynamic'");
    });

    it("other directives are NOT changed by this fix (object-src / frame-ancestors unaffected)", () => {
        const src = readProxy();
        expect(src).toContain("object-src 'none'");
        expect(src).toContain("frame-ancestors 'none'");
    });
});

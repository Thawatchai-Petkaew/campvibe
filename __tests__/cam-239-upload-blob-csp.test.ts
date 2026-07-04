/**
 * CAM-239 MEDIA-1 — Fix B + Fix C regression tests.
 *
 * Fix B — upload route robust on serverless:
 *   - development + no token  → local FS path (mkdir + writeFile called, 200 returned)
 *   - development + blob throws → local FS path (mkdir + writeFile called, 200 returned)
 *   - production + no token   → 503 Thai message, writeFile NOT called
 *   - production + blob throws → 503 Thai message, writeFile NOT called
 *   - production + blob ok    → 200 from Blob (success path unchanged)
 *
 * Fix C — CSP img-src allows googleusercontent.com:
 *   - proxy.ts img-src contains https://*.googleusercontent.com
 *   - all pre-existing SEC-3 assertions must still pass (the prod CSP is
 *     otherwise byte-identical to the one that passed the sec3-csp-nonce suite)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

// ---------------------------------------------------------------------------
// Fix B — upload route: NODE_ENV branching
// ---------------------------------------------------------------------------

// We need to control process.env.NODE_ENV and process.env.BLOB_READ_WRITE_TOKEN
// across tests.  Vitest's module cache must be cleared between each scenario so
// the top-level `if (process.env.BLOB_READ_WRITE_TOKEN)` branch is re-evaluated.
//
// Strategy: use vi.stubEnv (restores automatically via afterEach) + dynamic
// imports after stubs are in place.

// ── Common mocks (declared once, reset between tests) ───────────────────────

const mockPut = vi.fn();
vi.mock("@vercel/blob", () => ({ put: (...args: unknown[]) => mockPut(...args) }));

const mockWriteFile = vi.fn();
const mockMkdir = vi.fn();
vi.mock("fs/promises", () => ({
    writeFile: (...args: unknown[]) => mockWriteFile(...args),
    mkdir: (...args: unknown[]) => mockMkdir(...args),
}));

// Untyped vi.fn() — same pattern as cam-211-upload-hardening to avoid NextAuth overload conflicts.
const mockAuthFn = vi.fn();
vi.mock("../lib/auth", () => ({
    auth: (...args: unknown[]) => mockAuthFn(...args),
}));

vi.mock("next/cache", () => ({
    revalidateTag: vi.fn(),
    unstable_cache: (fn: (...a: unknown[]) => unknown) => fn,
}));

// A valid JPEG magic-byte buffer (just enough for the signature check to pass).
function jpegBuffer(): Uint8Array<ArrayBuffer> {
    return new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0]);
}

function makeUploadRequest(): Request {
    const formData = new FormData();
    const blob = new Blob([jpegBuffer()], { type: "image/jpeg" });
    formData.append("file", new File([blob], "avatar.jpg", { type: "image/jpeg" }));
    return new Request("http://localhost/api/upload?filename=avatar", {
        method: "POST",
        body: formData,
    });
}

// The auth mock must return a valid session for the rate-limit to not block.
// Use the same untyped vi.fn() pattern as cam-211-upload-hardening.test.ts
// so the mock's return type satisfies the NextAuth overloads.
import { _store } from "../lib/rate-limit";

function makeSession() {
    return { user: { id: "user-test-0001", email: "t@x.com", name: "T", role: "CAMPER" } };
}

beforeEach(() => {
    vi.clearAllMocks();
    _store.clear();
    mockMkdir.mockResolvedValue(undefined);
    mockWriteFile.mockResolvedValue(undefined);
    // mockAuth is the vi.fn() inside the vi.mock('../lib/auth') factory above.
    mockAuthFn.mockResolvedValue(makeSession());
});

afterEach(() => {
    vi.unstubAllEnvs();
});

// ── Scenario 1: development, no BLOB_READ_WRITE_TOKEN ───────────────────────

describe("Fix B — development, no BLOB_READ_WRITE_TOKEN → local FS path", () => {
    it("returns 200 and calls writeFile (local FS fallback is active in dev)", async () => {
        vi.stubEnv("NODE_ENV", "development");
        vi.stubEnv("BLOB_READ_WRITE_TOKEN", "");

        const { POST } = await import("../app/api/upload/route");
        const res = await POST(makeUploadRequest());

        expect(res.status).toBe(200);
        expect(mockWriteFile).toHaveBeenCalledOnce();
        expect(mockPut).not.toHaveBeenCalled();

        const body = await res.json();
        expect(typeof body.url).toBe("string");
        expect(body.url).toMatch(/^\/uploads\//);
    });
});

// ── Scenario 2: development, Blob throws → local FS fallback ────────────────

describe("Fix B — development, BLOB_READ_WRITE_TOKEN set but put() throws → local FS", () => {
    it("returns 200 from local FS when blob throws in development", async () => {
        vi.stubEnv("NODE_ENV", "development");
        vi.stubEnv("BLOB_READ_WRITE_TOKEN", "dev-token");
        mockPut.mockRejectedValueOnce(new Error("blob unavailable"));

        const { POST } = await import("../app/api/upload/route");
        const res = await POST(makeUploadRequest());

        expect(res.status).toBe(200);
        expect(mockWriteFile).toHaveBeenCalledOnce();

        const body = await res.json();
        expect(typeof body.url).toBe("string");
    });
});

// ── Scenario 3: production, no BLOB_READ_WRITE_TOKEN → 503, no FS write ─────

describe("Fix B — production, no BLOB_READ_WRITE_TOKEN → 503 + Thai message, no writeFile", () => {
    it("returns 503 with Thai message", async () => {
        vi.stubEnv("NODE_ENV", "production");
        vi.stubEnv("BLOB_READ_WRITE_TOKEN", "");

        const { POST } = await import("../app/api/upload/route");
        const res = await POST(makeUploadRequest());

        expect(res.status).toBe(503);
        const body = await res.json();
        expect(body.error).toBe("ระบบจัดเก็บรูปยังไม่พร้อม กรุณาติดต่อผู้ดูแล");
    });

    it("does NOT call writeFile (no FS write in production)", async () => {
        vi.stubEnv("NODE_ENV", "production");
        vi.stubEnv("BLOB_READ_WRITE_TOKEN", "");

        const { POST } = await import("../app/api/upload/route");
        await POST(makeUploadRequest());

        expect(mockWriteFile).not.toHaveBeenCalled();
    });
});

// ── Scenario 4: production, Blob throws → 503, no FS write ──────────────────

describe("Fix B — production, BLOB_READ_WRITE_TOKEN set but put() throws → 503, no writeFile", () => {
    it("returns 503 with Thai message when Blob put() throws in production", async () => {
        vi.stubEnv("NODE_ENV", "production");
        vi.stubEnv("BLOB_READ_WRITE_TOKEN", "prod-token");
        mockPut.mockRejectedValueOnce(new Error("network error"));

        const { POST } = await import("../app/api/upload/route");
        const res = await POST(makeUploadRequest());

        expect(res.status).toBe(503);
        const body = await res.json();
        expect(body.error).toBe("ระบบจัดเก็บรูปยังไม่พร้อม กรุณาติดต่อผู้ดูแล");
    });

    it("does NOT call writeFile when Blob throws in production", async () => {
        vi.stubEnv("NODE_ENV", "production");
        vi.stubEnv("BLOB_READ_WRITE_TOKEN", "prod-token");
        mockPut.mockRejectedValueOnce(new Error("network error"));

        const { POST } = await import("../app/api/upload/route");
        await POST(makeUploadRequest());

        expect(mockWriteFile).not.toHaveBeenCalled();
    });
});

// ── Scenario 5: production, Blob succeeds → 200 from Blob (success path) ────

describe("Fix B — production, Blob succeeds → 200 Blob response (success path unchanged)", () => {
    it("returns the Blob response when put() succeeds", async () => {
        vi.stubEnv("NODE_ENV", "production");
        vi.stubEnv("BLOB_READ_WRITE_TOKEN", "prod-token");
        const blobResult = {
            url: "https://example.public.blob.vercel-storage.com/avatar.jpg",
            pathname: "avatar.jpg",
            contentType: "image/jpeg",
            contentDisposition: "inline",
        };
        mockPut.mockResolvedValueOnce(blobResult);

        const { POST } = await import("../app/api/upload/route");
        const res = await POST(makeUploadRequest());

        expect(res.status).toBe(200);
        expect(mockWriteFile).not.toHaveBeenCalled();

        const body = await res.json();
        expect(body.url).toBe(blobResult.url);
    });
});

// ---------------------------------------------------------------------------
// Fix C — CSP img-src: googleusercontent.com
// ---------------------------------------------------------------------------

const rootDir = join(__dirname, "..");

function readProxy(): string {
    return readFileSync(join(rootDir, "proxy.ts"), "utf-8");
}

describe("Fix C — proxy.ts img-src includes googleusercontent.com", () => {
    it("img-src directive contains https://*.googleusercontent.com", () => {
        const src = readProxy();
        const imgSrcLine = src.split("\n").find((l) => l.includes("img-src")) ?? "";
        expect(imgSrcLine).toContain("https://*.googleusercontent.com");
    });

    it("img-src still contains the pre-existing Blob storage origin", () => {
        const src = readProxy();
        const imgSrcLine = src.split("\n").find((l) => l.includes("img-src")) ?? "";
        expect(imgSrcLine).toContain("https://*.public.blob.vercel-storage.com");
    });

    it("img-src still contains OpenStreetMap tile origin", () => {
        const src = readProxy();
        const imgSrcLine = src.split("\n").find((l) => l.includes("img-src")) ?? "";
        expect(imgSrcLine).toContain("https://*.tile.openstreetmap.org");
    });

    it("script-src is NOT changed — still contains strict-dynamic (prod CSP otherwise unchanged)", () => {
        expect(readProxy()).toContain("'strict-dynamic'");
    });

    it("style-src is NOT changed — still 'self' 'unsafe-inline'", () => {
        const src = readProxy();
        // Find the executable (non-comment) line containing the style-src directive.
        const styleLine = src
            .split("\n")
            .filter((l) => !l.trimStart().startsWith("*") && !l.trimStart().startsWith("//"))
            .find((l) => l.includes("style-src")) ?? "";
        expect(styleLine).toContain("'self' 'unsafe-inline'");
    });

    it("nonce logic is NOT changed — still uses crypto.getRandomValues + btoa", () => {
        const src = readProxy();
        expect(src).toContain("crypto.getRandomValues");
        expect(src).toContain("btoa(");
    });

    it("COMING_SOON gate is NOT changed — still guards /api routes", () => {
        const src = readProxy();
        expect(src).toContain("COMING_SOON");
        expect(src).toContain('/api"');
    });
});

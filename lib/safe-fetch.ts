// CAM-555 — generic never-throw GET+JSON fetch. Same never-throw contract as
// lib/zone-client.ts's fetchZonesSafe (CAM-362 G3 fix), extracted as its own
// standalone module (no React) so the never-throw contract gets a real
// behavioral unit test (__tests__/cam-555-safe-fetch.test.ts) instead of only
// source-inspection — same rationale as lib/zone-client.ts.
//
// Root cause this closes (components/spot-management-section.tsx's
// loadData): campRes/sessionRes used to be plain `fetch()` calls sharing one
// Promise.all + one shared catch with spotsRes. A transient network-level
// hiccup on EITHER of those two requests — unrelated to spot data, e.g. a
// dropped connection under CI resource contention — rejected the whole
// Promise.all before `setSpots` ever ran, so the shared catch set
// loadError=true and replaced the spots list with the error banner even
// though spotsRes itself had already succeeded and contained the spot the
// host just created (the ac6-spot-lifecycle intermittent flake, CAM-555).
// fetchJsonSafe resolves both a bad HTTP status AND a network-level
// rejection to `{ ok: false }` instead of throwing/rejecting, so a caller
// can place it inside a Promise.all alongside an independent hard-required
// fetch without risking the whole batch rejecting over an unrelated hiccup.
export type SafeJsonResult<T> = { ok: true; data: T } | { ok: false };

export async function fetchJsonSafe<T>(url: string): Promise<SafeJsonResult<T>> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return { ok: false };
    const data: T = await res.json();
    return { ok: true, data };
  } catch {
    return { ok: false };
  }
}

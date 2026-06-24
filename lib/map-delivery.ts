/**
 * lib/map-delivery.ts — CAM-171
 * Pure helper for the delivery gift indicator: localStorage seam + data derivation.
 * No React, no DOM beyond localStorage. SSR-safe (typeof window guards).
 */

import type { MapEpicItem } from "@/app/status/map/campsite-scene";

// ── Types ────────────────────────────────────────────────────────────────────

export interface DeliveryItem {
  id: string;
  title: string;
  epic: string;
  completedAt: string | null;
}

// ── Constants ────────────────────────────────────────────────────────────────

export const DELIVERY_SEEN_KEY = "cv-map-delivery-seen";

// ── Data helpers (pure, no side-effects) ─────────────────────────────────────

/**
 * Flatten epics[].stories[] where statusType === "completed",
 * sorted newest-first by completedAt.
 */
export function selectDeliveries(epics: MapEpicItem[]): DeliveryItem[] {
  const items: DeliveryItem[] = [];
  for (const epic of epics) {
    for (const story of epic.stories) {
      if (story.statusType === "completed") {
        items.push({
          id: story.id,
          title: story.title,
          epic: epic.label,
          completedAt: story.completedAt,
        });
      }
    }
  }
  // Sort newest first; null completedAt goes to end
  items.sort((a, b) => {
    if (!a.completedAt && !b.completedAt) return 0;
    if (!a.completedAt) return 1;
    if (!b.completedAt) return -1;
    return new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime();
  });
  return items;
}

/**
 * Return deliveries whose id is NOT in seenIds.
 */
export function selectUnseen(
  deliveries: DeliveryItem[],
  seenIds: Set<string>
): DeliveryItem[] {
  return deliveries.filter((d) => !seenIds.has(d.id));
}

// ── localStorage helpers (SSR-safe, no-throw) ─────────────────────────────────

/**
 * Read the seen-set from localStorage. Returns empty Set when key absent.
 */
export function readSeenIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(DELIVERY_SEEN_KEY);
    if (raw === null) return new Set();
    const arr = JSON.parse(raw) as string[];
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

/**
 * Write ids array to localStorage.
 */
export function writeSeenIds(ids: string[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(DELIVERY_SEEN_KEY, JSON.stringify(ids));
  } catch {
    /* ignore quota / SSR */
  }
}

/**
 * Merge ids into the existing seen-set and persist.
 */
export function markSeen(ids: string[]): void {
  if (typeof window === "undefined") return;
  try {
    const current = readSeenIds();
    for (const id of ids) current.add(id);
    writeSeenIds([...current]);
  } catch {
    /* ignore */
  }
}

// ── First-visit pre-seed ──────────────────────────────────────────────────────

/**
 * Returns true when the seen-key already exists in localStorage
 * (i.e. the user has visited before and was pre-seeded).
 */
export function hasInitialized(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(DELIVERY_SEEN_KEY) !== null;
  } catch {
    return false;
  }
}

/**
 * Seed the seen-set with the current Done ids so that only stories
 * completed AFTER the first visit trigger the gift indicator.
 * Must be called exactly once, when !hasInitialized().
 */
export function preSeed(currentDoneIds: string[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      DELIVERY_SEEN_KEY,
      JSON.stringify(currentDoneIds)
    );
  } catch {
    /* ignore */
  }
}

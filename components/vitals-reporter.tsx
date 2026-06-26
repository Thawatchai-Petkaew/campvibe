'use client';

/**
 * CAM-187 MEAS-1a — Field CWV reporter.
 *
 * Mounts once in app/layout.tsx (inside <Providers>).
 * Uses web-vitals onLCP/onINP/onCLS/onTTFB/onFCP callbacks to fire
 * navigator.sendBeacon('/api/vitals', ...) for each metric.
 *
 * routeTemplate strips dynamic segments from the raw pathname so the
 * endpoint never receives a raw camp slug or user id. Pattern:
 *   - UUID-shaped segments → [id]
 *   - known slug-pattern segments → [slug]
 *   - pure numeric segments → [id]
 *
 * Renders null — no visible DOM output (AC-1: no behavior change for users).
 */

import { useEffect } from 'react';
import type { Metric } from 'web-vitals';

function toRouteTemplate(pathname: string): string {
  return pathname
    // UUID: 8-4-4-4-12 hex chars
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '[id]')
    // Pure numeric segment
    .replace(/\/\d+(?=\/|$)/g, '/[id]')
    // Slug-like segments that contain a mix of letters, digits, and hyphens
    // and are at least 16 chars (typical camp slugs are long kebab strings)
    .replace(/\/[a-z0-9][a-z0-9-]{15,}(?=\/|$)/gi, '/[slug]');
}

function sendVital(metric: Metric): void {
  if (typeof navigator === 'undefined' || typeof navigator.sendBeacon !== 'function') {
    return;
  }

  const routeTemplate =
    typeof window !== 'undefined'
      ? toRouteTemplate(window.location.pathname)
      : 'unknown';

  const payload = {
    name: metric.name,
    value: metric.value,
    rating: metric.rating,
    id: metric.id,
    navigationType:
      'navigationType' in metric && typeof metric.navigationType === 'string'
        ? metric.navigationType
        : undefined,
    routeTemplate,
  };

  try {
    navigator.sendBeacon('/api/vitals', JSON.stringify(payload));
  } catch {
    // sendBeacon is fire-and-forget; silently ignore failures
  }
}

export default function VitalsReporter(): null {
  useEffect(() => {
    // Dynamic import keeps web-vitals out of the critical path
    import('web-vitals').then(({ onLCP, onINP, onCLS, onTTFB, onFCP }) => {
      onLCP(sendVital);
      onINP(sendVital);
      onCLS(sendVital);
      onTTFB(sendVital);
      onFCP(sendVital);
    }).catch(() => {
      // If web-vitals fails to load, measurement silently skips — no user impact
    });
  }, []);

  return null;
}

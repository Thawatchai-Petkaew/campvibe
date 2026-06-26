import { z } from 'zod';

/**
 * CAM-187 MEAS-1a — Zod schema for POST /api/vitals.
 *
 * routeTemplate must be a URL pattern, NOT a raw URL with IDs/slugs.
 * The client strips dynamic segments before sending (see VitalsReporter).
 * No PII fields — vitalsId is a web-vitals internal attribution id, not a user id.
 */
export const VitalPayloadSchema = z.object({
  name: z.enum(['LCP', 'INP', 'CLS', 'TTFB', 'FCP']),
  value: z.number().finite().nonnegative(),
  rating: z.enum(['good', 'needs-improvement', 'poor']),
  id: z.string().max(64),
  navigationType: z.string().max(32).optional(),
  routeTemplate: z.string().max(200),
});

export type VitalPayload = z.infer<typeof VitalPayloadSchema>;

import { z } from 'zod';

/**
 * Query params for GET /api/campsites/[id]/remaining-capacity — CAM-267 PREP-1.
 * Re-parsed at the server boundary; client-supplied dates are never trusted as-is.
 */
export const remainingCapacityQuerySchema = z
  .object({
    startDate: z.string().refine((v) => !isNaN(new Date(v).getTime()), {
      message: 'Invalid startDate',
    }),
    endDate: z.string().refine((v) => !isNaN(new Date(v).getTime()), {
      message: 'Invalid endDate',
    }),
  })
  .refine((data) => new Date(data.endDate) > new Date(data.startDate), {
    message: 'endDate must be after startDate',
    path: ['endDate'],
  });

export type RemainingCapacityQuery = z.infer<typeof remainingCapacityQuerySchema>;

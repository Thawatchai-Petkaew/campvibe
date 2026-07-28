import { z } from 'zod';

// CAM-634: exported so lib/booking-prefill.ts shares ONE cap instead of a
// second independently-chosen 30 (the exact drift shape this ticket exists
// to prevent — see lib/booking-prefill.ts's header comment).
export const MAX_BOOKING_NIGHTS = 30;

export const bookingSchema = z.object({
    campSiteId: z.string().uuid(),
    spotId: z.string().uuid().optional(),

    checkInDate: z.string().refine((date) => new Date(date).toString() !== 'Invalid Date', {
        message: "Invalid check-in date",
    }),
    checkOutDate: z.string().refine((date) => new Date(date).toString() !== 'Invalid Date', {
        message: "Invalid check-out date",
    }),

    guests: z.number().min(1).default(1),

    // CAM-642: attribution label only (which route created this booking) —
    // never read for authz/pricing/capacity (see app/api/bookings/route.ts).
    // Constrained to the enum so no unexpected value can be smuggled through;
    // absent → defaults to WEB (matches the DB column default).
    source: z.enum(['WEB', 'CHAT']).default('WEB'),

    // For testing, we might pass userId manually, though normally this comes from session
    userId: z.string().uuid(),
}).refine((data) => {
    const start = new Date(data.checkInDate);
    const end = new Date(data.checkOutDate);
    return end > start;
}, {
    message: "Check-out date must be after check-in date",
    path: ["checkOutDate"],
// RISK-3: cap booking window at 30 nights to kill the O(nights) query loop.
}).refine((data) => {
    const start = new Date(data.checkInDate);
    const end = new Date(data.checkOutDate);
    const nights = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    return nights <= MAX_BOOKING_NIGHTS;
}, {
    message: "Booking cannot exceed 30 nights",
    path: ["checkOutDate"],
});

export type BookingInput = z.infer<typeof bookingSchema>;

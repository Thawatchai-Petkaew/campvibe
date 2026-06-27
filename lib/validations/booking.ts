import { z } from 'zod';

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
    return nights <= 30;
}, {
    message: "Booking cannot exceed 30 nights",
    path: ["checkOutDate"],
});

export type BookingInput = z.infer<typeof bookingSchema>;

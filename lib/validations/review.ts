import { z } from 'zod';

export const reviewSchema = z.object({
    campSiteId: z.string().uuid(),
    authorId: z.string().uuid(), // In real app, this comes from session

    rating: z.number().min(1).max(5),
    title: z.string().optional(),
    content: z.string().min(10, "Review content must be at least 10 characters"),

    visitDate: z.string().optional(), // ISO String
}).refine((data) => {
    // Optional: Add logic to ensure visitDate is in the past
    return true;
});

export type ReviewInput = z.infer<typeof reviewSchema>;

import { z } from 'zod';

export const campgroundSchema = z.object({
    nameTh: z.string().min(1, "Name (TH) is required"),
    nameEn: z.string().optional(),
    nameThSlug: z.string().min(1, "Slug (TH) is required"),
    nameEnSlug: z.string().min(1, "Slug (EN) is required"),
    description: z.string().optional(),

    campgroundType: z.enum(["CAGD", "CACP"]),

    // Accepting arrays from frontend, will be joined to CSV for DB
    accessTypes: z.array(z.enum(["BAOT", "DRIV", "HIKE", "WALK"])),
    accommodationTypes: z.array(z.enum(["CABI", "DISP", "GROU", "HORS", "RECR", "TENT"])),
    facilities: z.array(z.string()), // Too many codes to list all right now, keeping generic string array

    latitude: z.number(),
    longitude: z.number(),

    checkInTime: z.string().min(1),
    checkOutTime: z.string().min(1),
    bookingMethod: z.enum(["ONLI", "ONCA", "ONST"]),

    priceLow: z.number().optional(),
    priceHigh: z.number().optional(),

    locationId: z.string().uuid(),
    operatorId: z.string().uuid(),

    partner: z.string().optional(),
    nationalPark: z.string().optional(),
});

export type CampgroundInput = z.infer<typeof campgroundSchema>;

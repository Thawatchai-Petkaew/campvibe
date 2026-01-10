# API Schema & Types System

## Overview
This system provides type safety and consistency between frontend and backend using JSON Schema and TypeScript types.

## Files Structure

```
/schema
  └── api-schema.json          # JSON Schema definitions
/types
  └── api.ts                   # TypeScript types & enums
/lib
  └── api-client.ts            # Type-safe API client
```

## Usage

### Frontend: Using the API Client

```typescript
import { campgroundAPI, bookingAPI } from '@/lib/api-client';
import type { CampgroundDTO, BookingDTO } from '@/types/api';

// Fetch campgrounds with type safety
const { data, error } = await campgroundAPI.list({ type: 'CAGD' });
if (data) {
  // data is typed as CampgroundDTO[]
  console.log(data[0].nameTh);
}

// Create a booking
const bookingData: BookingDTO = {
  campgroundId: 'uuid-here',
  userId: 'uuid-here',
  checkInDate: '2026-02-01',
  checkOutDate: '2026-02-05',
  guests: 2,
};

const result = await bookingAPI.create(bookingData);
```

### Backend: Using Types for Validation

```typescript
import type { CampgroundDTO, BookingDTO } from '@/types/api';
import { FACILITY_LABELS, parseFacilities } from '@/types/api';

// Type-safe response
export async function GET(): Promise<Response> {
  const campgrounds: CampgroundDTO[] = await prisma.campground.findMany();
  return Response.json(campgrounds);
}

// Parse facilities
const facilities = parseFacilities(campground.facilities);
const labels = facilities.map(code => FACILITY_LABELS[code]);
```

### Using Enums

```typescript
import { 
  CAMPGROUND_TYPE_LABELS,
  FACILITY_LABELS,
  BOOKING_STATUS_LABELS 
} from '@/types/api';

// Display friendly names
const typeName = CAMPGROUND_TYPE_LABELS['CAGD']; // "Campground"
const facilityName = FACILITY_LABELS['WIFI']; // "Wifi"
```

## Benefits

1. **Type Safety**: TypeScript ensures correct data structures
2. **Single Source of Truth**: JSON schema defines the contract
3. **Auto-completion**: IDE support for all API types
4. **Validation**: Consistent validation rules
5. **Documentation**: Self-documenting API structure

## Extending the Schema

To add new fields or types:

1. Update `schema/api-schema.json`
2. Regenerate types in `types/api.ts`
3. Update API client methods in `lib/api-client.ts`
4. Update Zod schemas in `lib/validations/*` to match

## Example: Adding a New Enum

```json
// In api-schema.json
"enums": {
  "NewEnum": {
    "CODE1": "Display Name 1",
    "CODE2": "Display Name 2"
  }
}
```

```typescript
// In types/api.ts
export type NewEnum = 'CODE1' | 'CODE2';

export const NEW_ENUM_LABELS: Record<NewEnum, string> = {
  CODE1: 'Display Name 1',
  CODE2: 'Display Name 2',
};
```

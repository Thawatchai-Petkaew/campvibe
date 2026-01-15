import { NextResponse } from 'next/server';

/**
 * Standardized API error response helper
 */
export function apiError(message: string, status: number = 500, details?: unknown) {
  console.error(`[API Error ${status}]:`, message, details);
  const response: { error: string; details?: unknown } = { error: message };
  if (details) {
    response.details = details;
  }
  return NextResponse.json(response, { status });
}

/**
 * Standardized API success response helper
 */
export function apiSuccess<T>(data: T, status: number = 200) {
  return NextResponse.json(data, { status });
}

/**
 * Convert array to CSV string (for database storage)
 */
export function arrayToCsv(arr: string[] | undefined | null): string | undefined {
  if (!arr || arr.length === 0) return undefined;
  return arr.join(',');
}

/**
 * Convert CSV string to array (for frontend use)
 */
export function csvToArray(csv: string | null | undefined): string[] {
  if (!csv) return [];
  return csv.split(',').filter(Boolean);
}

/**
 * Calculate number of nights between two dates
 */
export function calculateNights(checkIn: Date, checkOut: Date): number {
  const diffTime = Math.abs(checkOut.getTime() - checkIn.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

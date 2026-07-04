/**
 * CAM-348 — edit-form images prefill normalizer.
 *
 * GET /api/campsites/[id] returns `images` as an Image[] relation (S4b);
 * the pre-S4b payload was a CSV string. The prefill must never call
 * `.split` on an array (the crash the owner hit at M1 G4) — everything
 * funnels through the exported `toImageUrlList` normalizer (BR-1).
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { toImageUrlList } from '@/components/CampgroundForm';

describe('CAM-348 toImageUrlList (BR-1 / AC-1 / AC-2 / EC-1)', () => {
    it('maps Image relation rows to their urls (AC-1)', () => {
        expect(
            toImageUrlList([
                { id: '1', url: 'https://cdn/a.jpg', sortOrder: 0 },
                { id: '2', url: 'https://cdn/b.jpg', sortOrder: 1 },
            ])
        ).toEqual(['https://cdn/a.jpg', 'https://cdn/b.jpg']);
    });

    it('empty relation array yields [] and never throws (AC-2 — the G4 crash case)', () => {
        expect(toImageUrlList([])).toEqual([]);
    });

    it('drops rows with a missing/blank url and null rows (EC-1)', () => {
        expect(
            toImageUrlList([{ url: 'https://cdn/a.jpg' }, { url: '' }, {}, null])
        ).toEqual(['https://cdn/a.jpg']);
    });

    it('passes through an array of url strings unchanged', () => {
        expect(toImageUrlList(['https://cdn/a.jpg', ''])).toEqual(['https://cdn/a.jpg']);
    });

    it('still splits the legacy CSV string shape', () => {
        expect(toImageUrlList('https://cdn/a.jpg,https://cdn/b.jpg')).toEqual([
            'https://cdn/a.jpg',
            'https://cdn/b.jpg',
        ]);
        expect(toImageUrlList('')).toEqual([]);
    });

    it('null / undefined / non-string non-array yield [] (EC-1)', () => {
        expect(toImageUrlList(null)).toEqual([]);
        expect(toImageUrlList(undefined)).toEqual([]);
        expect(toImageUrlList(42)).toEqual([]);
        expect(toImageUrlList({ url: 'https://cdn/a.jpg' })).toEqual([]);
    });
});

describe('CAM-348 source guards', () => {
    const formSrc = fs.readFileSync(
        path.join(process.cwd(), 'components', 'CampgroundForm.tsx'),
        'utf8'
    );

    it('prefill routes images through the normalizer', () => {
        expect(formSrc).toContain('images: toImageUrlList(initialData.images)');
    });

    it('no CSV-era .images.split( call remains in the form', () => {
        expect(formSrc.includes('.images.split(')).toBe(false);
    });
});

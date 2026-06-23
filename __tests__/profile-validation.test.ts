import { describe, it, expect } from 'vitest';
import { imageUrlSchema, updateProfileSchema } from '../lib/validations/profile';

describe('imageUrlSchema', () => {
  describe('absolute https URL (Vercel Blob use-case)', () => {
    it('accepts a valid https URL', () => {
      const result = imageUrlSchema.safeParse(
        'https://public.blob.vercel-storage.com/profile-abc123.jpg',
      );
      expect(result.success).toBe(true);
    });

    it('accepts a valid http URL', () => {
      const result = imageUrlSchema.safeParse('http://example.com/avatar.png');
      expect(result.success).toBe(true);
    });
  });

  describe('relative /uploads/ path (local fallback — root cause case)', () => {
    it('accepts /uploads/profile-123.jpg', () => {
      const result = imageUrlSchema.safeParse('/uploads/profile-123.jpg');
      expect(result.success).toBe(true);
    });

    it('accepts /uploads/avatar_2024.webp', () => {
      const result = imageUrlSchema.safeParse('/uploads/avatar_2024.webp');
      expect(result.success).toBe(true);
    });
  });

  describe('reject relative paths outside /uploads/', () => {
    it('rejects /etc/passwd', () => {
      const result = imageUrlSchema.safeParse('/etc/passwd');
      expect(result.success).toBe(false);
    });

    it('rejects /foo', () => {
      const result = imageUrlSchema.safeParse('/foo');
      expect(result.success).toBe(false);
    });

    it('rejects bare filename with no leading slash', () => {
      const result = imageUrlSchema.safeParse('image.jpg');
      expect(result.success).toBe(false);
    });
  });

  describe('reject dangerous schemes / patterns', () => {
    it('rejects javascript:alert(1)', () => {
      const result = imageUrlSchema.safeParse('javascript:alert(1)');
      expect(result.success).toBe(false);
    });

    it('rejects protocol-relative //evil.com/x.jpg', () => {
      const result = imageUrlSchema.safeParse('//evil.com/x.jpg');
      expect(result.success).toBe(false);
    });

    it('rejects data: URI', () => {
      const result = imageUrlSchema.safeParse('data:image/png;base64,abc');
      expect(result.success).toBe(false);
    });
  });

  describe('reject path traversal', () => {
    it('rejects /uploads/../secret', () => {
      const result = imageUrlSchema.safeParse('/uploads/../secret');
      expect(result.success).toBe(false);
    });

    it('rejects /uploads/../../etc/passwd', () => {
      const result = imageUrlSchema.safeParse('/uploads/../../etc/passwd');
      expect(result.success).toBe(false);
    });

    it('rejects https URL with .. in path', () => {
      const result = imageUrlSchema.safeParse('https://cdn.example.com/../secret');
      // https:// prefix passes scheme check; .. check must fire first
      expect(result.success).toBe(false);
    });
  });

  describe('optional / nullable / empty', () => {
    it('accepts empty string', () => {
      const result = imageUrlSchema.safeParse('');
      expect(result.success).toBe(true);
    });

    it('accepts null', () => {
      const result = imageUrlSchema.safeParse(null);
      expect(result.success).toBe(true);
    });

    it('accepts undefined (field omitted)', () => {
      const result = imageUrlSchema.safeParse(undefined);
      expect(result.success).toBe(true);
    });
  });
});

describe('updateProfileSchema', () => {
  it('accepts a full valid payload with /uploads/ image', () => {
    const result = updateProfileSchema.safeParse({
      name: 'สมชาย รักเดิน',
      email: 'somchai@example.com',
      phone: '0812345678',
      image: '/uploads/profile-abc.jpg',
    });
    expect(result.success).toBe(true);
  });

  it('accepts a full valid payload with absolute https image', () => {
    const result = updateProfileSchema.safeParse({
      name: 'Alice',
      email: 'alice@example.com',
      phone: null,
      image: 'https://cdn.example.com/alice.jpg',
    });
    expect(result.success).toBe(true);
  });

  it('accepts payload with no image field (optional)', () => {
    const result = updateProfileSchema.safeParse({
      name: 'Bob',
      email: 'bob@example.com',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid email format', () => {
    const result = updateProfileSchema.safeParse({
      name: 'Charlie',
      email: 'not-an-email',
    });
    expect(result.success).toBe(false);
  });

  it('rejects image with path traversal', () => {
    const result = updateProfileSchema.safeParse({
      name: 'Eve',
      image: '/uploads/../etc/passwd',
    });
    expect(result.success).toBe(false);
  });

  it('rejects image with javascript: scheme', () => {
    const result = updateProfileSchema.safeParse({
      image: 'javascript:alert(1)',
    });
    expect(result.success).toBe(false);
  });

  it('accepts empty string for email (preserves original behaviour)', () => {
    const result = updateProfileSchema.safeParse({ email: '' });
    expect(result.success).toBe(true);
  });

  it('accepts null image (clear existing image)', () => {
    const result = updateProfileSchema.safeParse({ image: null });
    expect(result.success).toBe(true);
  });
});

import { z } from 'zod';

/**
 * imageUrlSchema
 *
 * ยอมรับ:
 *  - absolute https:// หรือ http:// URL (เช่น Vercel Blob)
 *  - relative path ที่ขึ้นต้นด้วย /uploads/ เท่านั้น
 *    (กัน path traversal, javascript:, protocol-relative)
 *  - empty string, null, undefined (field optional/nullable)
 *
 * ปฏิเสธ:
 *  - relative path นอก /uploads/ (เช่น /etc/passwd, /foo)
 *  - javascript:... , //evil.com
 *  - path ที่มี .. (path traversal)
 */
export const imageUrlSchema = z
  .string()
  .nullable()
  .optional()
  .refine(
    (val) => {
      // null / undefined / empty string — ยอมรับทุกกรณี
      if (val == null || val === '') return true;

      // ปฏิเสธทันทีถ้ามี path traversal
      if (val.includes('..')) return false;

      // ยอมรับ absolute http(s) URL
      if (/^https?:\/\//i.test(val)) return true;

      // ยอมรับ relative path ใต้ /uploads/ เท่านั้น
      // รูปแบบ: /uploads/<ชื่อไฟล์> ไม่มี segment เพิ่มเติม
      if (/^\/uploads\/[^/]+$/.test(val)) return true;

      return false;
    },
    {
      message:
        'image must be an absolute http(s) URL or a relative path under /uploads/',
    },
  );

export const updateProfileSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional().nullable(),
  image: imageUrlSchema,
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

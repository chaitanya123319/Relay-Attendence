import { z } from 'zod';
import { isDateStr, isMonthStr } from '../lib/time';

/** Multipart form fields arrive as strings — coerce numbers explicitly. */
const num = (min: number, max: number) => z.coerce.number().min(min).max(max);

export const checkEventSchema = z.object({
  lat: num(-90, 90),
  lng: num(-180, 180),
  accuracy: z.coerce.number().min(0).max(100000),
  clientTimestamp: z
    .string()
    .refine((s) => !Number.isNaN(Date.parse(s)), 'clientTimestamp must be an ISO-8601 string'),
  deviceId: z.string().trim().min(4).max(200),
  // 'true' | 'false' arrives as a string over multipart; treat only explicit truthiness as mocked.
  mocked: z
    .union([z.boolean(), z.enum(['true', 'false'])])
    .transform((v) => v === true || v === 'true')
    .default(false),
  captureSource: z.string().optional(),
  siteId: z.string().min(1).optional(),
});

export type CheckEventInput = z.infer<typeof checkEventSchema>;

export const historyQuerySchema = z.object({
  from: z.string().refine(isDateStr, 'from must be YYYY-MM-DD').optional(),
  to: z.string().refine(isDateStr, 'to must be YYYY-MM-DD').optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(31),
});

export const summaryQuerySchema = z.object({
  month: z.string().refine(isMonthStr, 'month must be YYYY-MM').optional(),
});

export const teamQuerySchema = z.object({
  date: z.string().refine(isDateStr, 'date must be YYYY-MM-DD').optional(),
  siteId: z.string().min(1).optional(),
});

export const signedUrlSchema = z.object({
  path: z.string().trim().min(1).max(300).startsWith('/api/'),
});

export const photoParamsSchema = z.object({
  id: z.string().min(1),
  side: z.enum(['in', 'out']),
});

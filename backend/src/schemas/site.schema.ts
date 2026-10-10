import { z } from 'zod';
import { OUT_OF_RANGE_BEHAVIORS } from '../lib/roles';

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'must be HH:mm');

export const siteCreateSchema = z.object({
  name: z.string().trim().min(2).max(120),
  address: z.string().trim().min(2).max(300),
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  radiusM: z.coerce.number().int().min(10).max(5000).default(150),
  outOfRangeBehavior: z.enum(OUT_OF_RANGE_BEHAVIORS).default('REJECT'),
  shiftStart: hhmm.default('09:00'),
  shiftEnd: hhmm.default('18:00'),
  lateGraceMinutes: z.coerce.number().int().min(0).max(240).default(15),
  halfDayMinutes: z.coerce.number().int().min(30).max(720).default(240),
});

export const siteUpdateSchema = siteCreateSchema.partial();

export const assignmentCreateSchema = z.object({
  userId: z.string().min(1),
});

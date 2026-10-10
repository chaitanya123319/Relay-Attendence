import { z } from 'zod';
import { HALF_DAY_PERIODS, LEAVE_STATUSES } from '../lib/roles';
import { isDateStr } from '../lib/time';

/** Multipart booleans arrive as strings — accept both shapes explicitly. */
const boolish = z
  .union([z.boolean(), z.enum(['true', 'false'])])
  .transform((v) => v === true || v === 'true');

export const applyLeaveSchema = z.object({
  leaveTypeId: z.string().min(1),
  fromDate: z.string().refine(isDateStr, 'fromDate must be YYYY-MM-DD'),
  toDate: z.string().refine(isDateStr, 'toDate must be YYYY-MM-DD'),
  isHalfDay: boolish.default(false),
  halfDayPeriod: z.enum(HALF_DAY_PERIODS).optional(),
  reason: z.string().trim().min(3).max(1000),
});

export const decisionSchema = z.object({
  comment: z.string().trim().max(1000).optional(),
});

export const rejectSchema = z.object({
  comment: z.string().trim().min(3).max(1000),
});

export const mineQuerySchema = z.object({
  status: z.enum(LEAVE_STATUSES).optional(),
});

export const queueQuerySchema = z.object({
  status: z.enum(LEAVE_STATUSES).optional(),
  userId: z.string().min(1).optional(),
});

export const balancesQuerySchema = z.object({
  userId: z.string().min(1, 'userId is required'),
  year: z.coerce.number().int().min(2000).max(2100).optional(),
});

export const allocationSchema = z.object({
  userId: z.string().min(1),
  leaveTypeId: z.string().min(1),
  year: z.coerce.number().int().min(2000).max(2100),
  allocated: z.coerce.number().min(0).max(365),
});

export const leaveTypeCreateSchema = z.object({
  code: z.string().trim().min(2).max(30).transform((s) => s.toUpperCase()),
  name: z.string().trim().min(2).max(80),
  annualQuota: z.coerce.number().min(0).max(365).default(0),
  paid: z.union([z.boolean(), z.enum(['true', 'false'])]).transform((v) => v === true || v === 'true').default(true),
  requiresDocument: z.union([z.boolean(), z.enum(['true', 'false'])]).transform((v) => v === true || v === 'true').default(false),
  minNoticeDays: z.coerce.number().int().min(0).max(90).default(0),
  maxConsecutiveDays: z.coerce.number().int().min(1).max(365).nullable().optional(),
  allowHalfDay: z.union([z.boolean(), z.enum(['true', 'false'])]).transform((v) => v === true || v === 'true').default(true),
});

export const leaveTypeUpdateSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  annualQuota: z.coerce.number().min(0).max(365).optional(),
  paid: z.union([z.boolean(), z.enum(['true', 'false'])]).transform((v) => v === true || v === 'true').optional(),
  requiresDocument: z.union([z.boolean(), z.enum(['true', 'false'])]).transform((v) => v === true || v === 'true').optional(),
  minNoticeDays: z.coerce.number().int().min(0).max(90).optional(),
  maxConsecutiveDays: z.coerce.number().int().min(1).max(365).nullable().optional(),
  allowHalfDay: z.union([z.boolean(), z.enum(['true', 'false'])]).transform((v) => v === true || v === 'true').optional(),
  isActive: z.union([z.boolean(), z.enum(['true', 'false'])]).transform((v) => v === true || v === 'true').optional(),
});

export const idParamsSchema = z.object({ id: z.string().min(1) });

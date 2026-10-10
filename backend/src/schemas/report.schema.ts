import { z } from 'zod';
import { isDateStr, isMonthStr } from '../lib/time';

export const reportFormatSchema = z.enum(['json', 'csv', 'pdf']).default('json');

export const attendanceReportQuerySchema = z.object({
  month: z.string().refine(isMonthStr, 'month must be YYYY-MM').optional(),
  siteId: z.string().min(1).optional(),
  format: reportFormatSchema,
});

export const leaveReportQuerySchema = z.object({
  from: z.string().refine(isDateStr, 'from must be YYYY-MM-DD').optional(),
  to: z.string().refine(isDateStr, 'to must be YYYY-MM-DD').optional(),
  format: reportFormatSchema,
});

export const payrollReportQuerySchema = z.object({
  month: z.string().refine(isMonthStr, 'month must be YYYY-MM').optional(),
  format: reportFormatSchema,
});

import { z } from 'zod';
import { ROLES } from '../lib/roles';

const boolish = z
  .union([z.boolean(), z.enum(['true', 'false'])])
  .transform((v) => v === true || v === 'true');

export const userCreateSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().min(5).max(160),
  employeeId: z.string().trim().min(2).max(40),
  password: z.string().min(8).max(100),
  role: z.enum(ROLES),
  phone: z.string().trim().min(6).max(20).optional(),
});

export const userUpdateSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  phone: z.string().trim().min(6).max(20).optional(),
  role: z.enum(ROLES).optional(),
  isActive: boolish.optional(),
  password: z.string().min(8).max(100).optional(),
});

export const usersQuerySchema = z.object({
  role: z.enum(ROLES).optional(),
  q: z.string().trim().max(120).optional(),
});

export const pushTokenSchema = z.object({
  token: z.string().trim().min(8).max(500),
  platform: z.enum(['ios', 'android']),
});

import { z } from 'zod';

export const loginSchema = z.object({
  identifier: z.string().trim().min(3).max(120), // email OR employee ID
  password: z.string().min(6).max(200),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(20).max(500),
});

export const logoutSchema = z.object({
  refreshToken: z.string().min(20).max(500).optional(),
});

export const googleLoginSchema = z.object({
  /** Google ID token (JWT) from the web GIS button or the mobile app. */
  idToken: z.string().min(20).max(10000),
});

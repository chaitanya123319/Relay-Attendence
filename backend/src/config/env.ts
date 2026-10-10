import * as dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  ACCESS_TOKEN_TTL_MIN: z.coerce.number().int().positive().default(15),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(7),
  COMPANY_TZ: z.string().default('Asia/Kolkata'),
  STORAGE_DIR: z.string().default('./storage'),
  MAX_UPLOAD_MB: z.coerce.number().positive().default(10),
  MAX_DOC_UPLOAD_MB: z.coerce.number().positive().default(5),
  GPS_ACCURACY_MAX_M: z.coerce.number().positive().default(50),
  TIME_DRIFT_MAX_S: z.coerce.number().positive().default(600),
  LOGIN_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(20),
  // Comma-separated allowlist of Google OAuth client IDs (web, iOS, Android).
  // Empty = Google sign-in disabled. See README "Sign in with Google".
  GOOGLE_CLIENT_IDS: z.string().default(''),
  CORS_ORIGIN: z.string().default('*'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // Fail fast with an actionable message — never boot with a broken config.
  console.error('[env] Invalid environment configuration:');
  console.error(parsed.error.flatten().fieldErrors);
  console.error('[env] Did you run `npm run setup` to create .env from .env.example?');
  process.exit(1);
}

export const env = parsed.data;
export const isTest = env.NODE_ENV === 'test';

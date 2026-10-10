import rateLimit from 'express-rate-limit';
import { env, isTest } from '../config/env';

const envelope = (message: string) => ({ error: { code: 'RATE_LIMITED', message } });

/** Broad API protection: 300 requests/minute/IP. */
export const globalLimiter = rateLimit({
  windowMs: 60_000,
  limit: 300,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: () => isTest, // rate limiting is bypassed under Jest (fires hundreds of requests)
  message: envelope('Too many requests — please slow down.'),
});

/** Credential-stuffing protection on login: N attempts / 15 min / IP (env-tunable). */
export const loginLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: env.LOGIN_RATE_LIMIT_MAX,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: () => isTest,
  message: envelope('Too many login attempts — try again in a few minutes.'),
});

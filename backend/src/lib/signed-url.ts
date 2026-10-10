import { env } from '../config/env';
import { hmacSign, timingSafeEqualHex } from './crypto';

/**
 * HMAC-signed, expiring URLs for photo/document streaming.
 * Signature covers "<path>|<expiry>"; verification is constant-time.
 * The signing secret is the access-token secret — rotating it invalidates
 * outstanding signed URLs (acceptable: they live 15 minutes).
 */
export const SIGNED_URL_TTL_SECONDS = 15 * 60;

export interface SignedUrl {
  url: string;
  expiresAt: string;
}

export function createSignedUrl(path: string, baseUrl: string, ttlSeconds = SIGNED_URL_TTL_SECONDS): SignedUrl {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const sig = hmacSign(`${path}|${exp}`, env.JWT_ACCESS_SECRET);
  const qs = new URLSearchParams({ p: path, e: String(exp), s: sig });
  return { url: `${baseUrl}/api/uploads/signed?${qs.toString()}`, expiresAt: new Date(exp * 1000).toISOString() };
}

export type SignedUrlVerification = { ok: true } | { ok: false; reason: 'expired' | 'bad_signature' | 'malformed' };

export function verifySignedUrl(path: string, expRaw: string, sig: string): SignedUrlVerification {
  const exp = Number(expRaw);
  if (!Number.isFinite(exp) || !path || !sig) return { ok: false, reason: 'malformed' };
  if (exp * 1000 < Date.now()) return { ok: false, reason: 'expired' };
  const expected = hmacSign(`${path}|${exp}`, env.JWT_ACCESS_SECRET);
  return timingSafeEqualHex(expected, sig) ? { ok: true } : { ok: false, reason: 'bad_signature' };
}

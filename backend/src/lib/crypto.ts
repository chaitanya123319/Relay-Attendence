import crypto from 'crypto';

export const sha256Hex = (data: Buffer | string): string =>
  crypto.createHash('sha256').update(data).digest('hex');

export const randomHex = (bytes = 32): string => crypto.randomBytes(bytes).toString('hex');

export const hmacSign = (payload: string, secret: string): string =>
  crypto.createHmac('sha256', secret).update(payload).digest('hex');

/** Constant-time comparison of two hex digests. */
export function timingSafeEqualHex(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

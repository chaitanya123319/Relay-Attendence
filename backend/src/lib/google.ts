import { OAuth2Client } from 'google-auth-library';
import { env } from '../config/env';
import { AppError, unauthorized } from './errors';

/**
 * Google Sign-In: verifies a Google-issued ID token (JWT) and returns the
 * identity it proves. Verification = signature against Google's JWKS +
 * issuer check + audience check + expiry, all handled by google-auth-library.
 *
 * `GOOGLE_CLIENT_IDS` is a comma-separated allowlist of OAuth client IDs
 * (web / iOS / Android); a token is only accepted if issued for one of them.
 * When the allowlist is empty, Google sign-in is disabled server-side.
 */

export interface GoogleIdentity {
  email: string;
  emailVerified: boolean;
  name?: string;
  picture?: string;
}

const client = new OAuth2Client();

export function googleClientIds(): string[] {
  return env.GOOGLE_CLIENT_IDS.split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function verifyGoogleIdToken(idToken: string): Promise<GoogleIdentity> {
  const audiences = googleClientIds();
  if (audiences.length === 0) {
    throw new AppError(
      503,
      'GOOGLE_DISABLED',
      'Google sign-in is not configured on this server (GOOGLE_CLIENT_IDS is empty)',
    );
  }

  let payload;
  try {
    const ticket = await client.verifyIdToken({ idToken, audience: audiences });
    payload = ticket.getPayload();
  } catch {
    throw unauthorized('GOOGLE_TOKEN_INVALID', 'Google credential could not be verified');
  }

  if (!payload?.email) {
    throw unauthorized('GOOGLE_TOKEN_INVALID', 'Google credential carries no email address');
  }

  return {
    email: payload.email,
    emailVerified: payload.email_verified === true,
    name: payload.name,
    picture: payload.picture,
  };
}

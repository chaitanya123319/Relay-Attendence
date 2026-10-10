import * as Google from 'expo-auth-session/providers/google';
import type { AuthSessionResult } from 'expo-auth-session';

/**
 * Google Sign-In for the RELAY mobile app.
 *
 * Configure the OAuth client IDs in `mobile/.env` (see README → Sign in with
 * Google). At minimum set the WEB client ID — Expo Go and web builds use it;
 * native builds additionally use the platform-specific IDs:
 *
 *   EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=xxxx.apps.googleusercontent.com
 *   EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=xxxx.apps.googleusercontent.com
 *   EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=xxxx.apps.googleusercontent.com
 *
 * The app only ever receives a short-lived ID token; the backend verifies it
 * against Google's JWKS and maps the Google account to an existing active
 * RELAY user (no self-registration).
 */

const WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
const IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
const ANDROID_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID;

export const googleSignInConfigured = Boolean(WEB_CLIENT_ID || IOS_CLIENT_ID || ANDROID_CLIENT_ID);

export function useGoogleIdTokenRequest() {
  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    clientId: WEB_CLIENT_ID,
    iosClientId: IOS_CLIENT_ID,
    androidClientId: ANDROID_CLIENT_ID,
  });
  return { ready: Boolean(request), response, promptAsync };
}

/** Extracts the id_token from a successful auth-session result, else null. */
export function idTokenFromResponse(response: AuthSessionResult | null): string | null {
  if (response?.type !== 'success') return null;
  const token = response.params?.id_token;
  return typeof token === 'string' && token.length > 0 ? token : null;
}

import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';

type ExpoNotificationsModule = typeof import('expo-notifications');

/**
 * expo-notifications is loaded lazily, and never on Android inside Expo Go:
 * since SDK 53 the remote-push APIs were removed from Expo Go on Android, and
 * the package's own auto-registration side-effect module calls one of them at
 * evaluation time — importing the package eagerly crashes the app at startup
 * ("Android Push notifications ... was removed from Expo Go", redbox).
 *
 * A dynamic import keeps the package off the bundle's eager evaluation path:
 *   - native builds (dev client / production): loaded normally, full push
 *   - Expo Go on iOS: loaded normally (local + remote still work there)
 *   - Expo Go on Android: never loaded; callers degrade gracefully
 */
const isExpoGo =
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient ||
  // Legacy field, still populated in Expo Go; belt-and-braces detection.
  (Constants as unknown as { appOwnership?: string | null }).appOwnership === 'expo';

/** True where remote push can't work — callers may hint the user (e.g. "use a dev build"). */
export const remotePushUnavailable = Platform.OS === 'android' && isExpoGo;

let cached: Promise<ExpoNotificationsModule | null> | null = null;

/** Resolves to the expo-notifications module, or null where it must not be loaded. */
export function getNotifications(): Promise<ExpoNotificationsModule | null> {
  if (remotePushUnavailable) return Promise.resolve(null);
  if (!cached) {
    cached = import('expo-notifications').catch(() => null);
  }
  return cached;
}

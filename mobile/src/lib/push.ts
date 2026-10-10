import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { notificationsApi } from '../api/endpoints';

export type PushRegistrationResult = 'registered' | 'denied' | 'skipped';

/**
 * Best-effort Expo push registration:
 *  1. ask for notification permission (skipped silently if denied),
 *  2. ensure the Android high-level channel exists,
 *  3. fetch the Expo push token (impossible on simulators/emulators → skip),
 *  4. register it with the backend.
 * Never throws — push is a convenience, not a requirement.
 */
export async function registerPushToken(): Promise<PushRegistrationResult> {
  try {
    const current = await Notifications.getPermissionsAsync();
    let granted = current.granted;
    if (!granted && current.canAskAgain) {
      const asked = await Notifications.requestPermissionsAsync();
      granted = asked.granted;
    }
    if (!granted) return 'denied';

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Attendance & leave alerts',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
    const token = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    await notificationsApi.registerPushToken(token.data, Platform.OS);
    return 'registered';
  } catch {
    // Simulators, emulators without Play services, and devices missing
    // push credentials can't mint a token — that's fine, skip.
    return 'skipped';
  }
}

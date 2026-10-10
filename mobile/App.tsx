import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import RootNavigator from './src/navigation';
import { getNotifications } from './src/lib/expoNotifications';
import { AuthProvider } from './src/store/AuthContext';
import { NotificationsProvider } from './src/store/NotificationsContext';

// Foreground notifications: show banner + list entry, no sound, no badge.
// Loaded lazily — expo-notifications must not be imported eagerly: in Expo Go
// on Android (SDK 53+) its auto-registration module throws during bundle
// evaluation. See src/lib/expoNotifications.ts.
void getNotifications().then((Notifications) => {
  Notifications?.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
});

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <NotificationsProvider>
          <RootNavigator />
          <StatusBar style="light" />
        </NotificationsProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

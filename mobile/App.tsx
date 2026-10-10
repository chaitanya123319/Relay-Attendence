import React from 'react';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import RootNavigator from './src/navigation';
import { AuthProvider } from './src/store/AuthContext';
import { NotificationsProvider } from './src/store/NotificationsContext';

// Foreground notifications: show banner + list entry, no sound, no badge.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
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

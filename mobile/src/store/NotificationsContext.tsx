import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { notificationsApi } from '../api/endpoints';
import { getNotifications } from '../lib/expoNotifications';
import { useAuth } from './AuthContext';

interface NotificationsContextValue {
  unreadCount: number;
  refreshUnread: () => Promise<void>;
  setUnreadCount: (n: number) => void;
}

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const inFlight = useRef(false);

  const refreshUnread = useCallback(async () => {
    if (status !== 'signedIn' || inFlight.current) return;
    inFlight.current = true;
    try {
      const items = await notificationsApi.list(true);
      setUnreadCount(items.length);
    } catch {
      // Offline / transient — keep the last known count.
    } finally {
      inFlight.current = false;
    }
  }, [status]);

  useEffect(() => {
    if (status !== 'signedIn') {
      setUnreadCount(0);
      return;
    }
    void refreshUnread();
    const timer = setInterval(() => void refreshUnread(), 60000);
    // Listener is best-effort: expo-notifications isn't loaded in Expo Go on Android.
    let sub: { remove: () => void } | null = null;
    let cancelled = false;
    void getNotifications().then((N) => {
      if (cancelled || !N) return;
      sub = N.addNotificationReceivedListener(() => void refreshUnread());
    });
    return () => {
      cancelled = true;
      clearInterval(timer);
      sub?.remove();
    };
  }, [status, refreshUnread]);

  return (
    <NotificationsContext.Provider value={{ unreadCount, refreshUnread, setUnreadCount }}>
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications(): NotificationsContextValue {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error('useNotifications must be used inside NotificationsProvider');
  return ctx;
}

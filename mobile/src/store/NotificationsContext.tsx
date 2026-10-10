import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import * as Notifications from 'expo-notifications';
import { notificationsApi } from '../api/endpoints';
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
    const sub = Notifications.addNotificationReceivedListener(() => void refreshUnread());
    return () => {
      clearInterval(timer);
      sub.remove();
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

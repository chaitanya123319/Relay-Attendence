import React, { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect } from '@react-navigation/native';
import { notificationsApi } from '../api/endpoints';
import { Button, EmptyState, ErrorBox, Loader } from '../components/ui';
import { apiError, NormalizedApiError } from '../lib/api';
import { useNotifications } from '../store/NotificationsContext';
import type { NotificationItem } from '../types';
import { colors, font, spacing } from '../theme';
import { timeAgo } from '../utils/dates';

const TYPE_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  LEAVE_SUBMITTED: 'paper-plane-outline',
  LEAVE_APPROVED: 'checkmark-circle-outline',
  LEAVE_REJECTED: 'close-circle-outline',
  LEAVE_CANCELLED: 'ban-outline',
  ATTENDANCE_FLAGGED: 'warning-outline',
};

export default function NotificationsScreen() {
  const { refreshUnread } = useNotifications();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<NormalizedApiError | null>(null);

  const load = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (mode === 'refresh') setRefreshing(true);
      else setLoading(true);
      try {
        setError(null);
        const data = await notificationsApi.list(unreadOnly);
        setItems(data);
        void refreshUnread();
      } catch (e) {
        setError(apiError(e));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [unreadOnly, refreshUnread],
  );

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const markRead = async (item: NotificationItem) => {
    if (item.readAt) return;
    // Optimistic update — flipping the dot immediately.
    setItems((prev) =>
      prev.map((n) => (n.id === item.id ? { ...n, readAt: new Date().toISOString() } : n)),
    );
    try {
      await notificationsApi.markRead(item.id);
      void refreshUnread();
    } catch {
      // revert on failure
      setItems((prev) => prev.map((n) => (n.id === item.id ? item : n)));
    }
  };

  const markAll = async () => {
    const snapshot = items;
    setItems((prev) => prev.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })));
    try {
      await notificationsApi.markAllRead();
      void refreshUnread();
    } catch (e) {
      setError(apiError(e));
      setItems(snapshot);
    }
  };

  const unreadCount = items.filter((n) => !n.readAt).length;

  const renderItem = ({ item }: { item: NotificationItem }) => {
    const unread = !item.readAt;
    return (
      <Pressable onPress={() => void markRead(item)} style={[styles.item, unread && styles.itemUnread]}>
        <View style={styles.iconWrap}>
          <Ionicons
            name={TYPE_ICON[item.type] ?? 'notifications-outline'}
            size={18}
            color={unread ? colors.primary : colors.textDim}
          />
        </View>
        <View style={styles.flex}>
          <View style={styles.titleRow}>
            <Text style={[styles.title, unread && styles.titleUnread]}>{item.title}</Text>
            {unread ? <View style={styles.dot} /> : null}
          </View>
          <Text style={styles.body}>{item.body}</Text>
          <Text style={styles.time}>{timeAgo(item.createdAt)}</Text>
        </View>
      </Pressable>
    );
  };

  return (
    <View style={styles.flex}>
      <FlatList
        data={items}
        keyExtractor={(n) => n.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void load('refresh')}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        ListHeaderComponent={
          <View style={styles.headerWrap}>
            {error ? <ErrorBox error={error} onRetry={() => void load()} /> : null}
            <View style={styles.controls}>
              <Pressable
                onPress={() => setUnreadOnly((v) => !v)}
                style={[styles.filter, unreadOnly && styles.filterActive]}
              >
                <Ionicons
                  name={unreadOnly ? 'funnel' : 'funnel-outline'}
                  size={13}
                  color={unreadOnly ? colors.info : colors.textDim}
                />
                <Text style={[styles.filterText, unreadOnly && styles.filterTextActive]}>
                  Unread only
                </Text>
              </Pressable>
              {unreadCount > 0 ? (
                <Button title={`Mark all read (${unreadCount})`} variant="ghost" onPress={() => void markAll()} />
              ) : null}
            </View>
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <Loader label="Loading notifications…" />
          ) : (
            <EmptyState
              icon="notifications-off-outline"
              title={unreadOnly ? 'No unread notifications' : 'No notifications yet'}
              subtitle="Leave decisions and flagged attendance show up here."
            />
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  listContent: { padding: spacing.lg, paddingBottom: spacing.xxl },
  headerWrap: { gap: spacing.md, marginBottom: spacing.sm },
  controls: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  filter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.cardAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterActive: { backgroundColor: colors.primarySoft, borderColor: colors.primaryDim },
  filterText: { color: colors.textDim, fontSize: font.tiny, fontWeight: '700' },
  filterTextActive: { color: colors.info },
  item: {
    flexDirection: 'row',
    gap: spacing.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  itemUnread: { borderColor: colors.primaryDim, backgroundColor: colors.cardAlt },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.cardAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { color: colors.textDim, fontSize: font.small, fontWeight: '600', flex: 1 },
  titleUnread: { color: colors.text, fontWeight: '700' },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary, marginLeft: spacing.sm },
  body: { color: colors.textDim, fontSize: font.small, marginTop: 4, lineHeight: 19 },
  time: { color: colors.textFaint, fontSize: font.tiny, marginTop: 6 },
});

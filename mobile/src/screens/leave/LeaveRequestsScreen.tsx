import React, { useCallback, useState } from 'react';
import { Alert, FlatList, Linking, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect } from '@react-navigation/native';
import { leaveApi, uploadsApi } from '../../api/endpoints';
import { Button, Card, EmptyState, ErrorBox, Loader, StatusChip } from '../../components/ui';
import { apiError, NormalizedApiError } from '../../lib/api';
import type { LeaveRequest, LeaveStatus } from '../../types';
import { colors, font, radius, spacing } from '../../theme';
import { formatDateStr } from '../../utils/dates';

type Filter = 'ALL' | LeaveStatus;

const FILTERS: Filter[] = ['ALL', 'PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'];

export default function LeaveRequestsScreen() {
  const [filter, setFilter] = useState<Filter>('ALL');
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<NormalizedApiError | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const load = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (mode === 'refresh') setRefreshing(true);
      else setLoading(true);
      try {
        setError(null);
        const data = await leaveApi.requests(filter === 'ALL' ? undefined : filter);
        setRequests(data);
      } catch (e) {
        setError(apiError(e));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [filter],
  );

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const confirmCancel = (req: LeaveRequest) => {
    Alert.alert(
      'Cancel request?',
      `${req.leaveType.name} · ${formatDateStr(req.fromDate)} → ${formatDateStr(req.toDate)} (${req.days} day(s)). The reserved balance will be released.`,
      [
        { text: 'Keep it', style: 'cancel' },
        {
          text: 'Cancel request',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setCancellingId(req.id);
              try {
                const updated = await leaveApi.cancel(req.id);
                setRequests((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
              } catch (e) {
                setError(apiError(e));
              } finally {
                setCancellingId(null);
              }
            })();
          },
        },
      ],
    );
  };

  const openDocument = async (path: string, name: string) => {
    try {
      const { url } = await uploadsApi.sign(path);
      await Linking.openURL(url);
    } catch (e) {
      setError(apiError(e));
    }
  };

  const renderItem = ({ item }: { item: LeaveRequest }) => (
    <Card style={styles.card}>
      <View style={styles.header}>
        <View style={styles.flex}>
          <Text style={styles.typeName}>{item.leaveType.name}</Text>
          <Text style={styles.range}>
            {formatDateStr(item.fromDate)} → {formatDateStr(item.toDate)}
            {item.isHalfDay ? ` · half day (${item.halfDayPeriod ?? 'AM'})` : ''}
          </Text>
        </View>
        <StatusChip status={item.status} />
      </View>

      <View style={styles.metaRow}>
        <Text style={styles.days}>{item.days} day(s)</Text>
        <Text style={styles.created}>applied {formatDateStr(item.createdAt.slice(0, 10))}</Text>
      </View>

      <Text style={styles.reason}>{item.reason}</Text>

      {item.decisionComment ? (
        <View style={styles.decisionBox}>
          <Ionicons name="chatbubble-ellipses-outline" size={14} color={colors.textDim} />
          <Text style={styles.decisionText}>
            {item.decidedBy?.name ? `${item.decidedBy.name}: ` : ''}
            {item.decisionComment}
          </Text>
        </View>
      ) : null}

      {item.documents.length ? (
        <View style={styles.docsRow}>
          {item.documents.map((doc) => (
            <Pressable
              key={doc.id}
              style={styles.docLink}
              onPress={() => void openDocument(doc.endpoint, doc.originalName)}
            >
              <Ionicons name="document-attach-outline" size={14} color={colors.info} />
              <Text style={styles.docLinkText} numberOfLines={1}>
                {doc.originalName}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {item.status === 'PENDING' ? (
        <Button
          title="Cancel request"
          variant="danger"
          icon="close-circle-outline"
          onPress={() => confirmCancel(item)}
          loading={cancellingId === item.id}
          disabled={cancellingId === item.id}
          style={styles.cancelButton}
        />
      ) : null}
    </Card>
  );

  return (
    <View style={styles.flex}>
      <FlatList
        data={requests}
        keyExtractor={(r) => r.id}
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
            <View style={styles.filters}>
              {FILTERS.map((f) => (
                <Pressable
                  key={f}
                  onPress={() => setFilter(f)}
                  style={[styles.filter, filter === f && styles.filterActive]}
                >
                  <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>{f}</Text>
                </Pressable>
              ))}
            </View>
            {error ? <ErrorBox error={error} onRetry={() => void load()} /> : null}
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <Loader label="Loading your requests…" />
          ) : (
            <EmptyState
              icon="calendar-outline"
              title="No leave requests"
              subtitle="Requests you submit will appear here with their approval status."
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
  headerWrap: { gap: spacing.md, marginBottom: spacing.md },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  filter: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.cardAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterActive: { backgroundColor: colors.primarySoft, borderColor: colors.primaryDim },
  filterText: { color: colors.textDim, fontSize: font.tiny, fontWeight: '700', letterSpacing: 0.4 },
  filterTextActive: { color: colors.info },
  card: { marginBottom: spacing.md },
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  typeName: { color: colors.text, fontSize: font.body, fontWeight: '700' },
  range: { color: colors.textDim, fontSize: font.small, marginTop: 2 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.sm },
  days: { color: colors.info, fontSize: font.small, fontWeight: '700' },
  created: { color: colors.textFaint, fontSize: font.tiny },
  reason: { color: colors.text, fontSize: font.small, marginTop: spacing.sm, lineHeight: 19 },
  decisionBox: {
    flexDirection: 'row',
    gap: spacing.xs,
    backgroundColor: colors.cardAlt,
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginTop: spacing.sm,
  },
  decisionText: { color: colors.textDim, fontSize: font.small, flex: 1, lineHeight: 18 },
  docsRow: { marginTop: spacing.sm, gap: spacing.xs },
  docLink: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  docLinkText: { color: colors.info, fontSize: font.small, flex: 1 },
  cancelButton: { marginTop: spacing.md, minHeight: 42 },
});

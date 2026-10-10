import React, { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useFocusEffect } from '@react-navigation/native';
import { attendanceApi } from '../api/endpoints';
import { Card, ErrorBox, FlagChip, Loader, StatusChip } from '../components/ui';
import { PhotoThumb } from '../components/Photo';
import { apiError, NormalizedApiError } from '../lib/api';
import type { AttendanceRecord } from '../types';
import { colors, font, radius, spacing } from '../theme';
import { formatDateStr, formatMinutes, formatTime, parseDateStr, toDateStr } from '../utils/dates';

const PAGE_SIZE = 20;

type RangePreset = 'thisMonth' | 'last30' | 'all';

function presetRange(preset: RangePreset): { from?: string; to?: string } {
  const today = new Date();
  if (preset === 'thisMonth') {
    const first = new Date(today.getFullYear(), today.getMonth(), 1);
    return { from: toDateStr(first), to: toDateStr(today) };
  }
  if (preset === 'last30') {
    const start = new Date(today.getTime() - 29 * 86400000);
    return { from: toDateStr(start), to: toDateStr(today) };
  }
  return {};
}

export default function HistoryScreen() {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [preset, setPreset] = useState<RangePreset>('thisMonth');
  const [from, setFrom] = useState<string | undefined>(presetRange('thisMonth').from);
  const [to, setTo] = useState<string | undefined>(presetRange('thisMonth').to);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<NormalizedApiError | null>(null);

  const [pickerFor, setPickerFor] = useState<'from' | 'to' | null>(null);

  const fetchPage = useCallback(
    async (pageToLoad: number, replace: boolean) => {
      const res = await attendanceApi.history({
        from,
        to,
        page: pageToLoad,
        pageSize: PAGE_SIZE,
      });
      setTotal(res.total);
      setPage(res.page);
      setRecords((prev) => (replace ? res.items : [...prev, ...res.items]));
    },
    [from, to],
  );

  const load = useCallback(async () => {
    try {
      setError(null);
      setLoading(true);
      await fetchPage(1, true);
    } catch (e) {
      setError(apiError(e));
    } finally {
      setLoading(false);
    }
  }, [fetchPage]);

  useEffect(() => {
    void load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      // light refresh on re-focus only when already loaded once
      if (!loading) void fetchPage(1, true).catch(() => undefined);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [fetchPage]),
  );

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      setError(null);
      await fetchPage(1, true);
    } catch (e) {
      setError(apiError(e));
    } finally {
      setRefreshing(false);
    }
  }, [fetchPage]);

  const loadMore = useCallback(async () => {
    if (loadingMore || records.length >= total || loading) return;
    setLoadingMore(true);
    try {
      await fetchPage(page + 1, false);
    } catch {
      // keep the list as-is; pull-to-refresh re-syncs
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, records.length, total, loading, fetchPage, page]);

  const applyPreset = (p: RangePreset) => {
    setPreset(p);
    const r = presetRange(p);
    setFrom(r.from);
    setTo(r.to);
  };

  const onPicked = (event: DateTimePickerEvent, date?: Date) => {
    const target = pickerFor;
    if (Platform.OS === 'android') setPickerFor(null);
    if (event.type !== 'set' || !date || !target) return;
    const value = toDateStr(date);
    if (target === 'from') {
      setPreset('all');
      setFrom(value);
    } else {
      setPreset('all');
      setTo(value);
    }
  };

  const renderItem = ({ item }: { item: AttendanceRecord }) => (
    <Card style={styles.recordCard}>
      <View style={styles.recordHeader}>
        <View>
          <Text style={styles.recordDate}>{formatDateStr(item.date)}</Text>
          <Text style={styles.recordSite}>{item.site?.name ?? '—'}</Text>
        </View>
        <StatusChip status={item.status} />
      </View>

      {item.flags.length ? (
        <View style={styles.flagsRow}>
          {item.flags.map((f) => (
            <FlagChip key={f} flag={f} />
          ))}
        </View>
      ) : null}

      <View style={styles.timesRow}>
        <View style={styles.timeCol}>
          <View style={styles.timeLine}>
            <Ionicons name="log-in-outline" size={14} color={colors.success} />
            <Text style={styles.timeValue}>{formatTime(item.checkIn.time)}</Text>
          </View>
          <Text style={styles.timeMeta}>
            {item.checkIn.distanceMeters ?? '—'} m · ±{Math.round(item.checkIn.accuracy)} m
          </Text>
        </View>
        <View style={styles.timeCol}>
          <View style={styles.timeLine}>
            <Ionicons name="log-out-outline" size={14} color={colors.warning} />
            <Text style={styles.timeValue}>
              {item.checkOut ? formatTime(item.checkOut.time) : 'still open'}
            </Text>
          </View>
          <Text style={styles.timeMeta}>
            {item.checkOut
              ? `${item.checkOut.distanceMeters ?? '—'} m · ±${Math.round(item.checkOut.accuracy)} m`
              : 'no check-out yet'}
          </Text>
        </View>
        <View style={styles.timeCol}>
          <View style={styles.timeLine}>
            <Ionicons name="hourglass-outline" size={14} color={colors.textDim} />
            <Text style={styles.timeValue}>{formatMinutes(item.workedMinutes)}</Text>
          </View>
          <Text style={styles.timeMeta}>worked</Text>
        </View>
      </View>

      <View style={styles.photosRow}>
        <PhotoThumb path={item.checkIn.photoEndpoint} label="IN" />
        {item.checkOut ? <PhotoThumb path={item.checkOut.photoEndpoint} label="OUT" /> : null}
      </View>
    </Card>
  );

  const listHeader = (
    <View style={styles.header}>
      <View style={styles.presets}>
        {(
          [
            ['thisMonth', 'This month'],
            ['last30', 'Last 30 days'],
            ['all', 'All time'],
          ] as [RangePreset, string][]
        ).map(([key, label]) => (
          <Pressable
            key={key}
            onPress={() => applyPreset(key)}
            style={[styles.preset, preset === key && styles.presetActive]}
          >
            <Text style={[styles.presetText, preset === key && styles.presetTextActive]}>{label}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.rangeRow}>
        <Pressable style={styles.rangeButton} onPress={() => setPickerFor('from')}>
          <Ionicons name="calendar-outline" size={14} color={colors.textDim} />
          <Text style={styles.rangeText}>{from ? formatDateStr(from) : 'Any'}</Text>
        </Pressable>
        <Text style={styles.rangeDash}>→</Text>
        <Pressable style={styles.rangeButton} onPress={() => setPickerFor('to')}>
          <Ionicons name="calendar-outline" size={14} color={colors.textDim} />
          <Text style={styles.rangeText}>{to ? formatDateStr(to) : 'Any'}</Text>
        </Pressable>
      </View>

      {error ? <ErrorBox error={error} onRetry={() => void load()} /> : null}
      {!error ? (
        <Text style={styles.countText}>
          {total} record{total === 1 ? '' : 's'}
        </Text>
      ) : null}
    </View>
  );

  if (loading) return <Loader label="Loading attendance history…" />;

  return (
    <View style={styles.flex}>
      <FlatList
        data={records}
        keyExtractor={(r) => r.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={listHeader}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void refresh()}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        onEndReached={() => void loadMore()}
        onEndReachedThreshold={0.4}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="file-tray-outline" size={36} color={colors.textFaint} />
            <Text style={styles.emptyTitle}>No attendance records</Text>
            <Text style={styles.emptySub}>Try widening the date range, or check in from the Home tab.</Text>
          </View>
        }
        ListFooterComponent={
          loadingMore ? (
            <View style={styles.footer}>
              <Text style={styles.footerText}>Loading more…</Text>
            </View>
          ) : records.length > 0 && records.length >= total ? (
            <View style={styles.footer}>
              <Text style={styles.footerText}>End of history</Text>
            </View>
          ) : null
        }
      />

      {pickerFor === 'from' || pickerFor === 'to' ? (
        <DateTimePicker
          value={parseDateStr((pickerFor === 'from' ? from : to) ?? toDateStr(new Date()))}
          mode="date"
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          onChange={onPicked}
        />
      ) : null}
      {pickerFor !== null && Platform.OS === 'ios' ? (
        <View style={styles.iosPickerDone}>
          <Pressable onPress={() => setPickerFor(null)} style={styles.presetActive}>
            <Text style={styles.presetTextActive}>Done</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  listContent: { padding: spacing.lg, paddingBottom: spacing.xxl },
  header: { gap: spacing.md, marginBottom: spacing.md },
  presets: { flexDirection: 'row', gap: spacing.sm },
  preset: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.cardAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  presetActive: { backgroundColor: colors.primarySoft, borderColor: colors.primaryDim },
  presetText: { color: colors.textDim, fontSize: font.small, fontWeight: '600' },
  presetTextActive: { color: colors.info },
  rangeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  rangeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.cardAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flex: 1,
    justifyContent: 'center',
  },
  rangeText: { color: colors.text, fontSize: font.small, fontWeight: '600' },
  rangeDash: { color: colors.textFaint },
  countText: { color: colors.textFaint, fontSize: font.small },
  recordCard: { marginBottom: spacing.md },
  recordHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  recordDate: { color: colors.text, fontSize: font.body, fontWeight: '700' },
  recordSite: { color: colors.textDim, fontSize: font.small, marginTop: 2 },
  flagsRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: spacing.sm },
  timesRow: { flexDirection: 'row', marginTop: spacing.md, gap: spacing.md },
  timeCol: { flex: 1 },
  timeLine: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  timeValue: { color: colors.text, fontSize: font.small, fontWeight: '700' },
  timeMeta: { color: colors.textFaint, fontSize: font.tiny, marginTop: 2 },
  photosRow: { flexDirection: 'row', marginTop: spacing.md },
  empty: { alignItems: 'center', paddingVertical: spacing.xxl * 2 },
  emptyTitle: { color: colors.text, fontSize: font.h2, fontWeight: '700', marginTop: spacing.md },
  emptySub: { color: colors.textDim, fontSize: font.small, marginTop: spacing.xs, textAlign: 'center' },
  footer: { paddingVertical: spacing.lg, alignItems: 'center' },
  footerText: { color: colors.textFaint, fontSize: font.small },
  iosPickerDone: { position: 'absolute', bottom: spacing.xl, right: spacing.lg },
});

import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { attendanceApi } from '../api/endpoints';
import { Card, ErrorBox, Loader, StatusChip } from '../components/ui';
import { apiError, NormalizedApiError } from '../lib/api';
import type { SummaryResponse } from '../types';
import { colors, font, radius, spacing } from '../theme';
import {
  addMonths,
  formatDateStr,
  formatMinutes,
  formatTime,
  formatWeekday,
  monthLabel,
  toMonthStr,
} from '../utils/dates';

export default function SummaryScreen() {
  const [month, setMonth] = useState(toMonthStr(new Date()));
  const [data, setData] = useState<SummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<NormalizedApiError | null>(null);

  const load = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (mode === 'refresh') setRefreshing(true);
      try {
        setError(null);
        setData(await attendanceApi.summary(month));
      } catch (e) {
        setError(apiError(e));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [month],
  );

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  const currentMonth = toMonthStr(new Date());

  const s = data?.summary;

  const tiles: { label: string; value: string; color: string }[] = s
    ? [
        { label: 'Present', value: String(s.present), color: colors.success },
        { label: 'Late', value: String(s.late), color: colors.warning },
        { label: 'Half days', value: String(s.halfDay), color: colors.warning },
        { label: 'Incomplete', value: String(s.incomplete), color: colors.danger },
        { label: 'Absent', value: String(s.absent), color: colors.danger },
        { label: 'On leave', value: String(s.onLeave), color: colors.info },
        { label: 'Weekly off', value: String(s.weeklyOff), color: colors.textDim },
        { label: 'Worked', value: formatMinutes(s.totalWorkedMinutes), color: colors.text },
      ]
    : [];

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => void load('refresh')}
          tintColor={colors.primary}
          colors={[colors.primary]}
        />
      }
    >
      <View style={styles.monthRow}>
        <Pressable onPress={() => setMonth((m) => addMonths(m, -1))} style={styles.monthButton} hitSlop={8}>
          <Ionicons name="chevron-back" size={20} color={colors.text} />
        </Pressable>
        <Pressable onPress={() => setMonth(currentMonth)} style={styles.monthLabelWrap}>
          <Text style={styles.monthLabel}>{monthLabel(month)}</Text>
          <Text style={styles.monthSub}>{month === currentMonth ? 'tap to jump to today' : 'tap for current month'}</Text>
        </Pressable>
        <Pressable
          onPress={() => setMonth((m) => addMonths(m, 1))}
          style={[styles.monthButton, month >= currentMonth && styles.monthButtonDisabled]}
          disabled={month >= currentMonth}
          hitSlop={8}
        >
          <Ionicons name="chevron-forward" size={20} color={month >= currentMonth ? colors.textFaint : colors.text} />
        </Pressable>
      </View>

      {error ? <ErrorBox error={error} onRetry={() => void load()} /> : null}

      {loading ? (
        <Loader label="Loading monthly summary…" />
      ) : data ? (
        <>
          <View style={styles.grid}>
            {tiles.map((t) => (
              <Card key={t.label} style={styles.tile}>
                <Text style={[styles.tileValue, { color: t.color }]}>{t.value}</Text>
                <Text style={styles.tileLabel}>{t.label}</Text>
              </Card>
            ))}
          </View>

          <Text style={styles.sectionTitle}>Day by day</Text>
          <Card style={styles.daysCard}>
            {data.days.map((d, idx) => (
              <View
                key={d.date}
                style={[styles.dayRow, idx < data.days.length - 1 && styles.dayRowBorder]}
              >
                <View style={styles.dayDate}>
                  <Text style={styles.dayDateMain}>{formatDateStr(d.date)}</Text>
                  <Text style={styles.dayDateSub}>{formatWeekday(d.date)}</Text>
                </View>
                <View style={styles.dayMiddle}>
                  <StatusChip status={d.status} />
                  {d.leaveType ? <Text style={styles.dayLeave}>{d.leaveType}</Text> : null}
                </View>
                <View style={styles.dayRight}>
                  {d.checkInAt ? (
                    <Text style={styles.dayTimes}>
                      {formatTime(d.checkInAt)} – {d.checkOutAt ? formatTime(d.checkOutAt) : 'open'}
                    </Text>
                  ) : (
                    <Text style={styles.dayTimes}>—</Text>
                  )}
                  <Text style={styles.dayWorked}>{formatMinutes(d.workedMinutes)}</Text>
                </View>
              </View>
            ))}
          </Card>
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  container: { padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md },
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  monthButton: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.cardAlt,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthButtonDisabled: { opacity: 0.4 },
  monthLabelWrap: { alignItems: 'center' },
  monthLabel: { color: colors.text, fontSize: font.h2, fontWeight: '800' },
  monthSub: { color: colors.textFaint, fontSize: font.tiny, marginTop: 2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  tile: {
    width: '47%',
    flexGrow: 1,
    alignItems: 'center',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.sm,
  },
  tileValue: { fontSize: font.title, fontWeight: '800' },
  tileLabel: { color: colors.textDim, fontSize: font.tiny, marginTop: spacing.xs, fontWeight: '600', letterSpacing: 0.4 },
  sectionTitle: {
    color: colors.textDim,
    fontSize: font.small,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: spacing.sm,
  },
  daysCard: { paddingVertical: spacing.xs, paddingHorizontal: spacing.lg },
  dayRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md },
  dayRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  dayDate: { width: 92 },
  dayDateMain: { color: colors.text, fontSize: font.small, fontWeight: '700' },
  dayDateSub: { color: colors.textFaint, fontSize: font.tiny, marginTop: 2 },
  dayMiddle: { flex: 1, alignItems: 'flex-start' },
  dayLeave: { color: colors.info, fontSize: font.tiny, marginTop: spacing.xs },
  dayRight: { alignItems: 'flex-end' },
  dayTimes: { color: colors.text, fontSize: font.small, fontWeight: '600' },
  dayWorked: { color: colors.textFaint, fontSize: font.tiny, marginTop: 2 },
});

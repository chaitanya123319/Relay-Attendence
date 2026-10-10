import React, { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { attendanceApi, sitesApi } from '../api/endpoints';
import { FlagChip, Button, Card, ErrorBox, InfoBox, KeyValue, Loader, StatusChip } from '../components/ui';
import { apiError, NormalizedApiError } from '../lib/api';
import type { AttendanceRecord, SiteWithAssignments } from '../types';
import { useAuth } from '../store/AuthContext';
import { colors, font, radius, spacing } from '../theme';
import { formatDateStr, formatMinutes, formatTime, toDateStr } from '../utils/dates';
import type { RootStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function HomeScreen() {
  const { user } = useAuth();
  const navigation = useNavigation<Nav>();
  const [record, setRecord] = useState<AttendanceRecord | null>(null);
  const [site, setSite] = useState<SiteWithAssignments | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<NormalizedApiError | null>(null);
  const [now, setNow] = useState(Date.now());

  const load = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (mode === 'refresh') setRefreshing(true);
      try {
        setError(null);
        const today = toDateStr(new Date());
        const [history, sites] = await Promise.all([
          attendanceApi.history({ from: today, to: today, page: 1, pageSize: 1 }),
          sitesApi.list().catch(() => [] as SiteWithAssignments[]),
        ]);
        setRecord(history.items[0] ?? null);
        const mine = sites.find(
          (s) => s.isActive && s.assignments.some((a) => a.userId === user?.id),
        );
        setSite(mine ?? null);
      } catch (e) {
        setError(apiError(e));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [user?.id],
  );

  // Re-fetch whenever the engineer returns to the tab (e.g. after a check-in).
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  // Keep the "worked so far" figure live while the day is open.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  const checkedIn = Boolean(record?.checkIn);
  const checkedOut = Boolean(record?.checkOut);
  const elapsedMinutes =
    record && !checkedOut
      ? Math.max(0, Math.floor((now - new Date(record.checkIn.time).getTime()) / 60000))
      : null;

  if (loading) return <Loader label="Loading today's status…" />;

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
      <View style={styles.greetingRow}>
        <View style={styles.flex}>
          <Text style={styles.greeting}>Hello, {user?.name?.split(' ')[0] ?? 'Engineer'}</Text>
          <Text style={styles.greetingSub}>
            {user?.employeeId} · {formatDateStr(toDateStr(new Date()))}
          </Text>
        </View>
        <Ionicons name="shield-checkmark" size={26} color={colors.primary} />
      </View>

      {error ? <ErrorBox error={error} onRetry={() => void load()} /> : null}

      <Card style={styles.statusCard}>
        <View style={styles.statusHeader}>
          <Text style={styles.statusTitle}>Today</Text>
          {record ? <StatusChip status={record.status} /> : (
            <View style={styles.notYet}>
              <Text style={styles.notYetText}>NOT CHECKED IN</Text>
            </View>
          )}
        </View>

        {record?.flags?.length ? (
          <View style={styles.flagsRow}>
            {record.flags.map((f) => (
              <FlagChip key={f} flag={f} />
            ))}
          </View>
        ) : null}

        <View style={styles.kvBlock}>
          <KeyValue label="Check-in" value={record ? formatTime(record.checkIn.time) : '—'} />
          <KeyValue label="Check-out" value={record?.checkOut ? formatTime(record.checkOut.time) : '—'} />
          <KeyValue
            label={checkedOut ? 'Worked' : 'Worked so far'}
            value={
              checkedOut
                ? formatMinutes(record?.workedMinutes ?? null)
                : elapsedMinutes !== null
                  ? formatMinutes(elapsedMinutes)
                  : '—'
            }
          />
          <KeyValue label="Site" value={record?.site?.name ?? site?.name ?? 'Not assigned'} />
          {record?.checkIn ? (
            <KeyValue
              label="Check-in distance"
              value={`${record.checkIn.distanceMeters ?? '—'} m from site`}
            />
          ) : null}
        </View>
      </Card>

      <View style={styles.actions}>
        <Button
          title="Check In"
          icon="log-in-outline"
          onPress={() => navigation.navigate('Capture', { mode: 'in' })}
          disabled={checkedIn}
          loading={false}
          style={styles.actionButton}
        />
        <Button
          title="Check Out"
          icon="log-out-outline"
          variant="secondary"
          onPress={() => navigation.navigate('Capture', { mode: 'out' })}
          disabled={!checkedIn || checkedOut}
          style={styles.actionButton}
        />
      </View>

      {checkedIn && !checkedOut ? (
        <InfoBox text="You are checked in. Remember to check out with a live photo before leaving site." />
      ) : null}
      {!checkedIn ? (
        <InfoBox text="Check-in needs a live in-app photo and a GPS fix inside your site's geofence. Photos from the gallery are not accepted." />
      ) : null}

      <Text style={styles.sectionTitle}>Assigned site</Text>
      <Card>
        {site ? (
          <View>
            <Text style={styles.siteName}>{site.name}</Text>
            <View style={styles.kvBlock}>
              <KeyValue label="Geofence radius" value={`${site.radiusM} m`} />
              <KeyValue label="Coordinates" value={`${site.lat.toFixed(5)}, ${site.lng.toFixed(5)}`} />
              <KeyValue label="Out-of-range policy" value={site.outOfRangeBehavior} />
            </View>
            <Text style={styles.siteHint}>
              Attendance is recorded against this site; distance is verified server-side.
            </Text>
          </View>
        ) : (
          <Text style={styles.siteHint}>
            No active project site is assigned to you yet — contact your manager to be assigned.
          </Text>
        )}
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  container: { padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md },
  greetingRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xs },
  greeting: { color: colors.text, fontSize: font.title - 2, fontWeight: '800' },
  greetingSub: { color: colors.textDim, fontSize: font.small, marginTop: 2 },
  statusCard: { borderColor: colors.borderLight },
  statusHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  statusTitle: { color: colors.text, fontSize: font.h2, fontWeight: '700' },
  notYet: {
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
  },
  notYetText: { color: colors.textFaint, fontSize: font.tiny, fontWeight: '700', letterSpacing: 0.5 },
  flagsRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing.sm },
  kvBlock: { marginTop: spacing.xs },
  actions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm },
  actionButton: { flex: 1, minHeight: 56 },
  sectionTitle: {
    color: colors.textDim,
    fontSize: font.small,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: spacing.md,
  },
  siteName: { color: colors.text, fontSize: font.h2 - 1, fontWeight: '700', marginBottom: spacing.xs },
  siteHint: { color: colors.textFaint, fontSize: font.small, marginTop: spacing.sm, lineHeight: 18 },
});

import React, { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { leaveApi } from '../../api/endpoints';
import { Button, Card, Chip, ErrorBox, Loader } from '../../components/ui';
import { apiError, NormalizedApiError } from '../../lib/api';
import type { BalanceRow } from '../../types';
import { colors, font, radius, spacing } from '../../theme';
import type { LeaveStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<LeaveStackParamList, 'LeaveHome'>;

export default function LeaveHomeScreen() {
  const navigation = useNavigation<Nav>();
  const [year, setYear] = useState(new Date().getFullYear());
  const [balances, setBalances] = useState<BalanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<NormalizedApiError | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      setBalances(await leaveApi.balances(year));
    } catch (e) {
      setError(apiError(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [year]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const onRefresh = () => {
    setRefreshing(true);
    void load();
  };

  if (loading) return <Loader label="Loading leave balances…" />;

  const currentYear = new Date().getFullYear();

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.primary}
          colors={[colors.primary]}
        />
      }
    >
      <View style={styles.yearRow}>
        <Pressable onPress={() => setYear((y) => y - 1)} style={styles.yearButton} hitSlop={8}>
          <Ionicons name="chevron-back" size={18} color={colors.text} />
        </Pressable>
        <Text style={styles.yearLabel}>{year}</Text>
        <Pressable
          onPress={() => setYear((y) => y + 1)}
          style={[styles.yearButton, year >= currentYear + 1 && styles.yearButtonDisabled]}
          disabled={year >= currentYear + 1}
          hitSlop={8}
        >
          <Ionicons
            name="chevron-forward"
            size={18}
            color={year >= currentYear + 1 ? colors.textFaint : colors.text}
          />
        </Pressable>
      </View>

      {error ? <ErrorBox error={error} onRetry={() => void load()} /> : null}

      <View style={styles.actions}>
        <Button
          title="Apply for leave"
          icon="add-circle-outline"
          onPress={() => navigation.navigate('ApplyLeave')}
          style={styles.flex}
        />
        <Button
          title="My requests"
          variant="secondary"
          icon="list-outline"
          onPress={() => navigation.navigate('LeaveRequests')}
          style={styles.flex}
        />
      </View>

      {balances.length === 0 && !error ? (
        <Card>
          <Text style={styles.emptyText}>No leave types are configured for this year.</Text>
        </Card>
      ) : null}

      {balances.map((b) => {
        const usedRatio =
          b.allocated > 0 ? Math.min(1, (b.used + b.pending) / b.allocated) : 0;
        return (
          <Card key={b.leaveType.id}>
            <View style={styles.balanceHeader}>
              <View style={styles.flex}>
                <Text style={styles.typeName}>{b.leaveType.name}</Text>
                <View style={styles.chipRow}>
                  <Chip label={b.leaveType.code} />
                  <Chip
                    label={b.leaveType.paid ? 'PAID' : 'UNPAID'}
                    fg={b.leaveType.paid ? colors.success : colors.textDim}
                    bg={b.leaveType.paid ? colors.successSoft : colors.cardAlt}
                  />
                </View>
              </View>
              <View style={styles.availableWrap}>
                <Text style={styles.availableValue}>{b.available}</Text>
                <Text style={styles.availableLabel}>days left</Text>
              </View>
            </View>

            <View style={styles.progressTrack}>
              <View
                style={[styles.progressFill, { width: `${Math.round(usedRatio * 100)}%` }]}
              />
            </View>

            <View style={styles.breakdown}>
              <Text style={styles.breakdownText}>Allocated {b.allocated}</Text>
              <Text style={styles.breakdownText}>Used {b.used}</Text>
              <Text style={styles.breakdownText}>Pending {b.pending}</Text>
            </View>
          </Card>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md },
  yearRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.lg },
  yearButton: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    backgroundColor: colors.cardAlt,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  yearButtonDisabled: { opacity: 0.4 },
  yearLabel: { color: colors.text, fontSize: font.h2, fontWeight: '800', minWidth: 70, textAlign: 'center' },
  actions: { flexDirection: 'row', gap: spacing.md },
  emptyText: { color: colors.textDim, fontSize: font.small },
  balanceHeader: { flexDirection: 'row', alignItems: 'center' },
  typeName: { color: colors.text, fontSize: font.h2 - 2, fontWeight: '700' },
  chipRow: { flexDirection: 'row', gap: spacing.xs, marginTop: spacing.xs },
  availableWrap: { alignItems: 'flex-end' },
  availableValue: { color: colors.success, fontSize: font.title, fontWeight: '800' },
  availableLabel: { color: colors.textFaint, fontSize: font.tiny },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.cardAlt,
    marginTop: spacing.md,
    overflow: 'hidden',
  },
  progressFill: { height: 6, borderRadius: 3, backgroundColor: colors.primary },
  breakdown: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.sm },
  breakdownText: { color: colors.textDim, fontSize: font.tiny },
});

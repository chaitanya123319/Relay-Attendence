import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import * as DocumentPicker from 'expo-document-picker';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { leaveApi } from '../../api/endpoints';
import { Button, Card, Chip, ErrorBox, InfoBox, Loader, TextField } from '../../components/ui';
import { apiError, NormalizedApiError } from '../../lib/api';
import type { BalanceRow, LeaveType } from '../../types';
import { colors, font, radius, spacing } from '../../theme';
import { daysBetweenInclusive, formatDateStr, parseDateStr, toDateStr } from '../../utils/dates';
import type { LeaveStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<LeaveStackParamList, 'ApplyLeave'>;

interface PickedDocument {
  uri: string;
  name: string;
  mimeType: string;
  size: number | null;
}

const MAX_DOC_MB = 5;

export default function ApplyLeaveScreen() {
  const navigation = useNavigation<Nav>();

  const [types, setTypes] = useState<LeaveType[]>([]);
  const [balances, setBalances] = useState<BalanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<NormalizedApiError | null>(null);

  const [typeId, setTypeId] = useState<string | null>(null);
  const [fromDate, setFromDate] = useState(new Date());
  const [toDate, setToDate] = useState(new Date());
  const [pickerFor, setPickerFor] = useState<'from' | 'to' | null>(null);
  const [isHalfDay, setIsHalfDay] = useState(false);
  const [halfDayPeriod, setHalfDayPeriod] = useState<'AM' | 'PM'>('AM');
  const [reason, setReason] = useState('');
  const [document, setDocument] = useState<PickedDocument | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<NormalizedApiError | null>(null);

  const load = useCallback(async () => {
    try {
      setLoadError(null);
      const [ts, bs] = await Promise.all([leaveApi.types(), leaveApi.balances()]);
      setTypes(ts);
      setBalances(bs);
      setTypeId((current) => current ?? ts[0]?.id ?? null);
    } catch (e) {
      setLoadError(apiError(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const selectedType = useMemo(() => types.find((t) => t.id === typeId) ?? null, [types, typeId]);
  const selectedBalance = useMemo(
    () => balances.find((b) => b.leaveType.id === typeId) ?? null,
    [balances, typeId],
  );

  const days = isHalfDay ? 0.5 : daysBetweenInclusive(toDateStr(fromDate), toDateStr(toDate));
  const needsDocument = Boolean(selectedType?.requiresDocument);
  const documentMissing = needsDocument && !document;

  const pickDocument = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/jpeg', 'image/png'],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (res.canceled) return;
      const asset = res.assets[0];
      if (!asset) return;
      if (asset.size !== undefined && asset.size > MAX_DOC_MB * 1024 * 1024) {
        setSubmitError({ code: 'FILE_TOO_LARGE', message: `Documents must be under ${MAX_DOC_MB} MB.`, status: null });
        return;
      }
      setSubmitError(null);
      setDocument({
        uri: asset.uri,
        name: asset.name,
        mimeType: asset.mimeType ?? 'application/octet-stream',
        size: asset.size ?? null,
      });
    } catch (e) {
      setSubmitError(apiError(e));
    }
  };

  const onPicked = (event: DateTimePickerEvent, date?: Date) => {
    const target = pickerFor;
    if (Platform.OS === 'android') setPickerFor(null);
    if (event.type !== 'set' || !date || !target) return;
    if (target === 'from') {
      setFromDate(date);
      if (isHalfDay || date > toDate) setToDate(date);
    } else {
      setToDate(date);
    }
  };

  const validate = (): string | null => {
    if (!selectedType) return 'Pick a leave type.';
    if (daysBetweenInclusive(toDateStr(fromDate), toDateStr(toDate)) <= 0) {
      return 'The end date must be on or after the start date.';
    }
    if (isHalfDay && toDateStr(fromDate) !== toDateStr(toDate)) {
      return 'A half-day request must be for a single date.';
    }
    if (reason.trim().length < 3) return 'Give a short reason (at least 3 characters).';
    if (documentMissing) return `${selectedType.name} requires a supporting document.`;
    if (selectedBalance && selectedBalance.available < days) {
      return `Only ${selectedBalance.available} day(s) of ${selectedType.name} are available — the request will be rejected server-side.`;
    }
    return null;
  };

  const submit = async () => {
    const problem = validate();
    if (problem) {
      setSubmitError({ code: null, message: problem, status: null });
      return;
    }
    if (!selectedType) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const created = await leaveApi.apply({
        leaveTypeId: selectedType.id,
        fromDate: toDateStr(fromDate),
        toDate: toDateStr(toDate),
        isHalfDay,
        halfDayPeriod: isHalfDay ? halfDayPeriod : undefined,
        reason: reason.trim(),
        document: document
          ? { uri: document.uri, name: document.name, mimeType: document.mimeType }
          : undefined,
      });
      Alert.alert(
        'Request submitted',
        `${created.leaveType.name}: ${created.days} day(s) from ${formatDateStr(created.fromDate)}. You'll be notified once your manager decides.`,
        [{ text: 'OK', onPress: () => navigation.goBack() }],
      );
    } catch (e) {
      setSubmitError(apiError(e));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <Loader label="Loading leave types…" />;

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.flex} contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        {loadError ? <ErrorBox error={loadError} onRetry={() => void load()} /> : null}
        {submitError ? <ErrorBox error={submitError} /> : null}

        <Text style={styles.label}>Leave type</Text>
        <View style={styles.typeList}>
          {types.map((t) => {
            const active = t.id === typeId;
            return (
              <Pressable
                key={t.id}
                onPress={() => setTypeId(t.id)}
                style={[styles.typeOption, active && styles.typeOptionActive]}
              >
                <Text style={[styles.typeOptionName, active && styles.typeOptionNameActive]}>{t.name}</Text>
                <View style={styles.typeOptionMeta}>
                  {t.requiresDocument ? <Chip label="DOC REQUIRED" fg={colors.warning} bg={colors.warningSoft} /> : null}
                  {!t.allowHalfDay ? <Chip label="FULL DAY ONLY" /> : null}
                </View>
              </Pressable>
            );
          })}
        </View>

        {selectedBalance ? (
          <InfoBox
            tone="info"
            text={`${selectedBalance.leaveType.name}: ${selectedBalance.available} of ${selectedBalance.allocated} day(s) available (${selectedBalance.used} used, ${selectedBalance.pending} pending).`}
          />
        ) : null}
        {selectedType && selectedType.minNoticeDays > 0 ? (
          <InfoBox
            tone="warning"
            text={`${selectedType.name} can start no earlier than today − ${selectedType.minNoticeDays} day(s).`}
          />
        ) : null}
        {selectedType?.maxConsecutiveDays ? (
          <InfoBox tone="warning" text={`${selectedType.name} allows at most ${selectedType.maxConsecutiveDays} consecutive day(s) per request.`} />
        ) : null}

        <Text style={styles.label}>Dates</Text>
        <View style={styles.dateRow}>
          <Pressable style={styles.dateField} onPress={() => setPickerFor('from')}>
            <Text style={styles.dateFieldLabel}>From</Text>
            <Text style={styles.dateFieldValue}>{formatDateStr(toDateStr(fromDate))}</Text>
          </Pressable>
          <Pressable
            style={[styles.dateField, isHalfDay && styles.dateFieldDisabled]}
            onPress={() => !isHalfDay && setPickerFor('to')}
          >
            <Text style={styles.dateFieldLabel}>To</Text>
            <Text style={styles.dateFieldValue}>{formatDateStr(toDateStr(isHalfDay ? fromDate : toDate))}</Text>
          </Pressable>
        </View>

        <View style={styles.halfDayRow}>
          <View style={styles.flex}>
            <Text style={styles.halfDayTitle}>Half day</Text>
            <Text style={styles.halfDaySub}>
              {selectedType && !selectedType.allowHalfDay
                ? `${selectedType?.name ?? 'This type'} does not allow half days`
                : 'Book 0.5 day for a single date'}
            </Text>
          </View>
          <Switch
            value={isHalfDay}
            onValueChange={(v) => {
              setIsHalfDay(v);
              if (v) setToDate(fromDate);
            }}
            disabled={!selectedType?.allowHalfDay}
            trackColor={{ false: colors.border, true: colors.primaryDim }}
            thumbColor={isHalfDay ? colors.primary : colors.textFaint}
          />
        </View>

        {isHalfDay ? (
          <View style={styles.periodRow}>
            {(['AM', 'PM'] as const).map((p) => (
              <Pressable
                key={p}
                onPress={() => setHalfDayPeriod(p)}
                style={[styles.periodOption, halfDayPeriod === p && styles.periodOptionActive]}
              >
                <Text style={[styles.periodText, halfDayPeriod === p && styles.periodTextActive]}>
                  {p === 'AM' ? 'Morning (AM)' : 'Afternoon (PM)'}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        <View style={styles.summaryRow}>
          <Ionicons name="information-circle-outline" size={16} color={colors.textDim} />
          <Text style={styles.summaryText}>
            Requesting <Text style={styles.summaryStrong}>{days}</Text> day(s)
            {isHalfDay ? ` (${halfDayPeriod})` : ''}
          </Text>
        </View>

        <Text style={styles.label}>Reason</Text>
        <TextField
          value={reason}
          onChangeText={setReason}
          placeholder="e.g. Family function out of town"
          multiline
          numberOfLines={3}
          style={styles.reasonInput}
        />

        <Text style={styles.label}>Supporting document{needsDocument ? ' (required)' : ' (optional)'}</Text>
        {document ? (
          <Card style={styles.docCard}>
            <Ionicons
              name={document.mimeType === 'application/pdf' ? 'document-text-outline' : 'image-outline'}
              size={22}
              color={colors.info}
            />
            <View style={styles.flex}>
              <Text style={styles.docName} numberOfLines={1}>
                {document.name}
              </Text>
              <Text style={styles.docMeta}>
                {document.mimeType}
                {document.size ? ` · ${(document.size / (1024 * 1024)).toFixed(2)} MB` : ''}
              </Text>
            </View>
            <Pressable onPress={() => setDocument(null)} hitSlop={8}>
              <Ionicons name="close-circle" size={22} color={colors.danger} />
            </Pressable>
          </Card>
        ) : (
          <Button
            title="Attach document (PDF/JPG/PNG)"
            variant="ghost"
            icon="attach-outline"
            onPress={() => void pickDocument()}
          />
        )}

        <Button
          title="Submit request"
          icon="send-outline"
          onPress={() => void submit()}
          loading={submitting}
          disabled={submitting || !selectedType}
          style={styles.submit}
        />
      </ScrollView>

      {pickerFor !== null ? (
        <DateTimePicker
          value={pickerFor === 'from' ? fromDate : toDate}
          mode="date"
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          onChange={onPicked}
        />
      ) : null}
      {pickerFor !== null && Platform.OS === 'ios' ? (
        <View style={styles.pickerDone}>
          <Button title="Done" variant="secondary" onPress={() => setPickerFor(null)} />
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md },
  label: {
    color: colors.textDim,
    fontSize: font.small,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: spacing.sm,
  },
  typeList: { gap: spacing.sm },
  typeOption: {
    backgroundColor: colors.cardAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  typeOptionActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  typeOptionName: { color: colors.text, fontSize: font.body, fontWeight: '600' },
  typeOptionNameActive: { color: colors.info },
  typeOptionMeta: { flexDirection: 'row', gap: spacing.xs, marginTop: spacing.xs },
  dateRow: { flexDirection: 'row', gap: spacing.md },
  dateField: {
    flex: 1,
    backgroundColor: colors.cardAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  dateFieldDisabled: { opacity: 0.5 },
  dateFieldLabel: { color: colors.textFaint, fontSize: font.tiny, fontWeight: '700', letterSpacing: 0.5 },
  dateFieldValue: { color: colors.text, fontSize: font.body, fontWeight: '600', marginTop: spacing.xs },
  halfDayRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  halfDayTitle: { color: colors.text, fontSize: font.body, fontWeight: '600' },
  halfDaySub: { color: colors.textFaint, fontSize: font.tiny, marginTop: 2 },
  periodRow: { flexDirection: 'row', gap: spacing.md },
  periodOption: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.cardAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  periodOptionActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  periodText: { color: colors.textDim, fontSize: font.small, fontWeight: '600' },
  periodTextActive: { color: colors.info },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  summaryText: { color: colors.textDim, fontSize: font.small },
  summaryStrong: { color: colors.text, fontWeight: '800' },
  reasonInput: { minHeight: 84, textAlignVertical: 'top' },
  docCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  docName: { color: colors.text, fontSize: font.small, fontWeight: '600' },
  docMeta: { color: colors.textFaint, fontSize: font.tiny, marginTop: 2 },
  submit: { marginTop: spacing.md },
  pickerDone: { position: 'absolute', bottom: spacing.xl, right: spacing.lg },
});

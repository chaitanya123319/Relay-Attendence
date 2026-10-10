import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, font, radius, spacing, statusColor } from '../theme';
import type { NormalizedApiError } from '../lib/api';

// ── Buttons ──────────────────────────────────────────────────────────────────

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'success';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  loading?: boolean;
  disabled?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  style?: ViewStyle;
}

const buttonBg: Record<ButtonVariant, string> = {
  primary: colors.primary,
  secondary: colors.primarySoft,
  danger: colors.danger,
  ghost: 'transparent',
  success: colors.success,
};

const buttonFg: Record<ButtonVariant, string> = {
  primary: colors.white,
  secondary: colors.info,
  danger: colors.white,
  ghost: colors.info,
  success: '#06251A',
};

export function Button({ title, onPress, variant = 'primary', loading, disabled, icon, style }: ButtonProps) {
  const inactive = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: buttonBg[variant] },
        variant === 'ghost' && styles.buttonGhost,
        inactive && styles.buttonDisabled,
        pressed && !inactive && styles.buttonPressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={buttonFg[variant]} />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={18} color={buttonFg[variant]} style={styles.buttonIcon} /> : null}
          <Text style={[styles.buttonText, { color: buttonFg[variant] }]}>{title}</Text>
        </>
      )}
    </Pressable>
  );
}

// ── Containers ───────────────────────────────────────────────────────────────

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionTitle({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <Text style={[styles.sectionTitle, style]}>{children}</Text>;
}

// ── Chips & badges ───────────────────────────────────────────────────────────

export function Chip({
  label,
  fg = colors.textDim,
  bg = colors.cardAlt,
  style,
}: {
  label: string;
  fg?: string;
  bg?: string;
  style?: ViewStyle;
}) {
  return (
    <View style={[styles.chip, { backgroundColor: bg }, style]}>
      <Text style={[styles.chipText, { color: fg }]}>{label}</Text>
    </View>
  );
}

export function StatusChip({ status, style }: { status: string; style?: ViewStyle }) {
  const c = statusColor(status);
  return <Chip label={status.replace(/_/g, ' ')} fg={c.fg} bg={c.bg} style={style} />;
}

export function FlagChip({ flag }: { flag: string }) {
  return (
    <Chip
      label={flag.replace(/_/g, ' ')}
      fg={colors.warning}
      bg={colors.warningSoft}
      style={styles.flagChip}
    />
  );
}

// ── Text fields ──────────────────────────────────────────────────────────────

interface TextFieldProps extends TextInputProps {
  label?: string;
}

export function TextField({ label, style, ...rest }: TextFieldProps) {
  const [focused, setFocused] = React.useState(false);
  return (
    <View>
      {label ? <Text style={styles.fieldLabel}>{label}</Text> : null}
      <TextInput
        placeholderTextColor={colors.textFaint}
        {...rest}
        onFocus={(e) => {
          setFocused(true);
          rest.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          rest.onBlur?.(e);
        }}
        style={[styles.input, focused && styles.inputFocused, style]}
      />
    </View>
  );
}

// ── Feedback ─────────────────────────────────────────────────────────────────

export function ErrorBox({
  error,
  onRetry,
}: {
  error: NormalizedApiError | string;
  onRetry?: () => void;
}) {
  const err = typeof error === 'string' ? { code: null as string | null, message: error, details: undefined, status: null } : error;
  return (
    <View style={styles.errorBox}>
      <View style={styles.errorHeader}>
        <Ionicons name="alert-circle" size={18} color={colors.danger} />
        <Text style={styles.errorTitle}>{err.code ? err.code.replace(/_/g, ' ') : 'Something went wrong'}</Text>
      </View>
      <Text style={styles.errorMessage}>{err.message}</Text>
      {onRetry ? (
        <Button title="Retry" variant="secondary" onPress={onRetry} style={styles.errorRetry} icon="refresh" />
      ) : null}
    </View>
  );
}

export function InfoBox({ text, tone = 'info' }: { text: string; tone?: 'info' | 'success' | 'warning' }) {
  const map = {
    info: { fg: colors.info, bg: colors.infoSoft, icon: 'information-circle' as const },
    success: { fg: colors.success, bg: colors.successSoft, icon: 'checkmark-circle' as const },
    warning: { fg: colors.warning, bg: colors.warningSoft, icon: 'warning' as const },
  };
  const c = map[tone];
  return (
    <View style={[styles.infoBox, { backgroundColor: c.bg }]}>
      <Ionicons name={c.icon} size={16} color={c.fg} />
      <Text style={[styles.infoText, { color: c.fg }]}>{text}</Text>
    </View>
  );
}

export function EmptyState({ icon, title, subtitle }: { icon: keyof typeof Ionicons.glyphMap; title: string; subtitle?: string }) {
  return (
    <View style={styles.empty}>
      <Ionicons name={icon} size={40} color={colors.textFaint} />
      <Text style={styles.emptyTitle}>{title}</Text>
      {subtitle ? <Text style={styles.emptySubtitle}>{subtitle}</Text> : null}
    </View>
  );
}

export function Loader({ label }: { label?: string }) {
  return (
    <View style={styles.loader}>
      <ActivityIndicator size="large" color={colors.primary} />
      {label ? <Text style={styles.loaderLabel}>{label}</Text> : null}
    </View>
  );
}

export function KeyValue({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <View style={styles.kvRow}>
      <Text style={styles.kvLabel}>{label}</Text>
      <Text style={[styles.kvValue, valueColor ? { color: valueColor } : null]}>{value}</Text>
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  button: {
    minHeight: 48,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
  },
  buttonGhost: { borderWidth: 1, borderColor: colors.borderLight },
  buttonDisabled: { opacity: 0.45 },
  buttonPressed: { opacity: 0.85 },
  buttonIcon: { marginRight: spacing.sm },
  buttonText: { fontSize: font.body, fontWeight: '700' },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  sectionTitle: {
    color: colors.textDim,
    fontSize: font.small,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: spacing.sm,
    marginTop: spacing.lg,
  },
  chip: {
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  chipText: { fontSize: font.tiny, fontWeight: '700', letterSpacing: 0.5 },
  flagChip: { marginRight: spacing.xs, marginTop: spacing.xs },
  fieldLabel: { color: colors.textDim, fontSize: font.small, marginBottom: spacing.xs, fontWeight: '600' },
  input: {
    backgroundColor: colors.cardAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    color: colors.text,
    fontSize: font.body,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    minHeight: 48,
  },
  inputFocused: { borderColor: colors.primaryDim },
  errorBox: {
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.danger,
    padding: spacing.md,
  },
  errorHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xs },
  errorTitle: { color: colors.danger, fontWeight: '700', marginLeft: spacing.xs, fontSize: font.small, letterSpacing: 0.4 },
  errorMessage: { color: colors.text, fontSize: font.small, lineHeight: 19 },
  errorRetry: { marginTop: spacing.md, alignSelf: 'flex-start', minHeight: 40 },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: radius.md,
    padding: spacing.md,
  },
  infoText: { fontSize: font.small, lineHeight: 19, marginLeft: spacing.sm, flex: 1, fontWeight: '500' },
  empty: { alignItems: 'center', paddingVertical: spacing.xxl * 2, paddingHorizontal: spacing.xl },
  emptyTitle: { color: colors.text, fontSize: font.h2, fontWeight: '700', marginTop: spacing.md, textAlign: 'center' },
  emptySubtitle: { color: colors.textDim, fontSize: font.small, marginTop: spacing.xs, textAlign: 'center', lineHeight: 19 },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  loaderLabel: { color: colors.textDim, marginTop: spacing.md, fontSize: font.small },
  kvRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.xs + 2 },
  kvLabel: { color: colors.textDim, fontSize: font.small, flex: 1 },
  kvValue: { color: colors.text, fontSize: font.small, fontWeight: '600', flex: 1.4, textAlign: 'right' },
});

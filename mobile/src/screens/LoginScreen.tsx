import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Button, ErrorBox, TextField } from '../components/ui';
import { API_URL, apiError, NormalizedApiError } from '../lib/api';
import { useAuth } from '../store/AuthContext';
import { colors, font, radius, spacing } from '../theme';

export default function LoginScreen() {
  const { signIn } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<NormalizedApiError | null>(null);

  const submit = async () => {
    if (!identifier.trim() || !password) {
      setError({ code: null, message: 'Enter your employee ID or email and your password.', status: null });
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await signIn(identifier.trim(), password);
    } catch (e) {
      setError(apiError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.logoWrap}>
          <View style={styles.logoBadge}>
            <Ionicons name="construct" size={30} color={colors.white} />
          </View>
          <Text style={styles.title}>RELAY Attendance</Text>
          <Text style={styles.subtitle}>Geo-verified site attendance for engineers</Text>
        </View>

        <View style={styles.form}>
          {error ? <ErrorBox error={error} /> : null}

          <TextField
            label="Employee ID or email"
            value={identifier}
            onChangeText={setIdentifier}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            placeholder="EMP-0011 or you@relay.local"
            returnKeyType="next"
          />

          <View style={styles.passwordRow}>
            <Text style={styles.fieldLabel}>Password</Text>
          </View>
          <View style={styles.passwordWrap}>
            <TextField
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              placeholder="Your password"
              returnKeyType="go"
              onSubmitEditing={() => void submit()}
              style={styles.passwordInput}
            />
            <Ionicons
              name={showPassword ? 'eye-off' : 'eye'}
              size={20}
              color={colors.textDim}
              style={styles.eye}
              onPress={() => setShowPassword((v) => !v)}
              suppressHighlighting
            />
          </View>

          <Button
            title="Sign in"
            onPress={() => void submit()}
            loading={busy}
            disabled={busy}
            style={styles.submit}
          />
        </View>

        <View style={styles.hintBox}>
          <Text style={styles.hintTitle}>Demo account (seeded backend)</Text>
          <Text style={styles.hintText}>engineer1@relay.local · Relay@123</Text>
          <Text style={styles.hintText}>API: {API_URL}</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing.xl,
  },
  logoWrap: { alignItems: 'center', marginBottom: spacing.xxl },
  logoBadge: {
    width: 64,
    height: 64,
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  title: { color: colors.text, fontSize: font.title + 4, fontWeight: '800' },
  subtitle: { color: colors.textDim, fontSize: font.small, marginTop: spacing.xs },
  form: { gap: spacing.lg },
  passwordRow: { marginBottom: -spacing.md },
  fieldLabel: { color: colors.textDim, fontSize: font.small, fontWeight: '600', marginBottom: spacing.xs },
  passwordWrap: { position: 'relative', justifyContent: 'center' },
  passwordInput: { paddingRight: 44 },
  eye: { position: 'absolute', right: spacing.md },
  submit: { marginTop: spacing.sm },
  hintBox: {
    marginTop: spacing.xxl,
    backgroundColor: colors.cardAlt,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
  },
  hintTitle: { color: colors.textDim, fontSize: font.tiny, fontWeight: '700', letterSpacing: 0.6, marginBottom: spacing.xs },
  hintText: { color: colors.textFaint, fontSize: font.tiny, marginTop: 2 },
});

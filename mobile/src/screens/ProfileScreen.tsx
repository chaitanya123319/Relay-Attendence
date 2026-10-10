import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import Constants from 'expo-constants';
import { Button, Card, KeyValue } from '../components/ui';
import { API_URL } from '../lib/api';
import { registerPushToken, PushRegistrationResult } from '../lib/push';
import { getDeviceId } from '../lib/session';
import { useAuth } from '../store/AuthContext';
import { colors, font, radius, spacing } from '../theme';

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const [deviceId, setDeviceId] = useState('');
  const [pushStatus, setPushStatus] = useState<PushRegistrationResult | null>(null);
  const [busyPush, setBusyPush] = useState(false);

  useEffect(() => {
    void getDeviceId().then(setDeviceId);
  }, []);

  const enablePush = async () => {
    setBusyPush(true);
    try {
      const result = await registerPushToken();
      setPushStatus(result);
    } finally {
      setBusyPush(false);
    }
  };

  const confirmLogout = () => {
    Alert.alert('Sign out?', 'You will need to sign in again to mark attendance.', [
      { text: 'Stay', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => void signOut() },
    ]);
  };

  const pushLabel =
    pushStatus === 'registered'
      ? 'Push registered on this device'
      : pushStatus === 'denied'
        ? 'Notifications were denied — enable them in device settings'
        : pushStatus === 'skipped'
          ? 'No push token on this device (emulator/simulator or push unavailable)'
          : 'Not yet registered on this device';

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.container}>
      <View style={styles.avatarWrap}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {(user?.name ?? '?')
              .split(' ')
              .map((p) => p[0])
              .slice(0, 2)
              .join('')
              .toUpperCase()}
          </Text>
        </View>
        <Text style={styles.name}>{user?.name}</Text>
        <Text style={styles.role}>
          {user?.role} · {user?.employeeId}
        </Text>
      </View>

      <Card>
        <Text style={styles.cardTitle}>Account</Text>
        <KeyValue label="Email" value={user?.email ?? '—'} />
        <KeyValue label="Phone" value={user?.phone ?? '—'} />
        <KeyValue label="Role" value={user?.role ?? '—'} />
        <KeyValue label="Status" value={user?.isActive ? 'Active' : 'Inactive'} valueColor={user?.isActive ? colors.success : colors.danger} />
      </Card>

      <Card>
        <Text style={styles.cardTitle}>Device & app</Text>
        <KeyValue label="API endpoint" value={API_URL} />
        <KeyValue label="Device ID" value={deviceId || '…'} />
        <KeyValue label="App version" value={Constants.expoConfig?.version ?? '1.0.0'} />
        <KeyValue label="Expo SDK" value={Constants.expoConfig?.sdkVersion ?? '—'} />
      </Card>

      <Card>
        <Text style={styles.cardTitle}>Push notifications</Text>
        <Text style={styles.pushText}>{pushLabel}</Text>
        <Button
          title="Enable push notifications"
          variant="secondary"
          icon="notifications-outline"
          onPress={() => void enablePush()}
          loading={busyPush}
          disabled={busyPush}
          style={styles.pushButton}
        />
      </Card>

      <Button title="Sign out" variant="danger" icon="log-out-outline" onPress={confirmLogout} style={styles.logout} />

      <Text style={styles.footer}>RELAY Attendance · geo-verified site attendance</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  container: { padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md },
  avatarWrap: { alignItems: 'center', marginVertical: spacing.lg },
  avatar: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: colors.primarySoft,
    borderWidth: 2,
    borderColor: colors.primaryDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: colors.info, fontSize: font.title, fontWeight: '800' },
  name: { color: colors.text, fontSize: font.h2, fontWeight: '800', marginTop: spacing.md },
  role: { color: colors.textDim, fontSize: font.small, marginTop: 2 },
  cardTitle: { color: colors.text, fontSize: font.small, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: spacing.sm },
  pushText: { color: colors.textDim, fontSize: font.small, lineHeight: 19 },
  pushButton: { marginTop: spacing.md },
  logout: { marginTop: spacing.sm },
  footer: { color: colors.textFaint, fontSize: font.tiny, textAlign: 'center', marginTop: spacing.md },
});

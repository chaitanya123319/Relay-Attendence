import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { CameraView, useCameraPermissions, type CameraCapturedPicture } from 'expo-camera';
import * as Location from 'expo-location';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { attendanceApi, CapturePayload, sitesApi } from '../api/endpoints';
import { Button, Card, ErrorBox, FlagChip, InfoBox, KeyValue, Loader, StatusChip } from '../components/ui';
import { apiError, NormalizedApiError } from '../lib/api';
import { getDeviceId } from '../lib/session';
import type { CheckResult, SiteWithAssignments } from '../types';
import { useAuth } from '../store/AuthContext';
import { colors, font, radius, spacing } from '../theme';
import { formatDistance, haversineMeters } from '../utils/geo';
import { formatTime } from '../utils/dates';
import type { RootStackScreenProps } from '../navigation/types';

type Props = RootStackScreenProps<'Capture'>;

type Phase = 'camera' | 'review' | 'success';

interface LocationIssue {
  kind: 'services-off' | 'permission-denied' | 'error';
  message: string;
}

/** GPS accuracy above the documented server limit gets a pre-submit warning. */
const ACCURACY_HINT_METERS = 50;

export default function CaptureScreen({ navigation, route }: Props) {
  const mode = route.params.mode;
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const cameraRef = useRef<CameraView | null>(null);
  const [permission, requestPermission] = useCameraPermissions();

  const [phase, setPhase] = useState<Phase>('camera');
  const [cameraReady, setCameraReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [photo, setPhoto] = useState<CameraCapturedPicture | null>(null);
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [locationIssue, setLocationIssue] = useState<LocationIssue | null>(null);
  const [deviceId, setDeviceId] = useState<string>('');
  const [site, setSite] = useState<SiteWithAssignments | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<NormalizedApiError | null>(null);
  const [result, setResult] = useState<CheckResult | null>(null);

  useEffect(() => {
    void getDeviceId().then(setDeviceId);
    void sitesApi
      .list()
      .then((sites) => {
        const mine = sites.find(
          (s) => s.isActive && s.assignments.some((a) => a.userId === user?.id),
        );
        setSite(mine ?? null);
      })
      .catch(() => {
        /* preview only — the server resolves the authoritative site */
      });
  }, [user?.id]);

  const collectProof = useCallback(async (): Promise<boolean> => {
    setLocationIssue(null);
    try {
      const servicesOn = await Location.hasServicesEnabledAsync();
      if (!servicesOn) {
        setLocationIssue({
          kind: 'services-off',
          message:
            'Location services (GPS) are turned off on this device. Turn them on to prove you are at the site — you can do it from Quick Settings or the app settings.',
        });
        return false;
      }
      const perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) {
        setLocationIssue({
          kind: 'permission-denied',
          message:
            'Location permission is required to verify you are inside the site geofence. You can grant it in the app settings.',
        });
        return false;
      }
      const fix = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const cam = cameraRef.current;
      if (!cam) {
        setLocationIssue({ kind: 'error', message: 'The camera is not ready yet — try again in a moment.' });
        return false;
      }
      const pic = await cam.takePictureAsync({ quality: 0.6 });
      if (!pic?.uri) {
        setLocationIssue({ kind: 'error', message: 'The photo could not be captured — please retry.' });
        return false;
      }
      setLocation(fix);
      setPhoto(pic);
      setSubmitError(null);
      setPhase('review');
      return true;
    } catch (e) {
      setLocationIssue({
        kind: 'error',
        message: e instanceof Error ? e.message : 'Could not acquire a GPS fix — move to open sky and retry.',
      });
      return false;
    }
  }, []);

  const handleShutter = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      await collectProof();
    } finally {
      setBusy(false);
    }
  }, [busy, collectProof]);

  const handleSubmit = useCallback(async () => {
    if (!photo || !location || !deviceId) return;
    const accuracy = location.coords.accuracy;
    if (accuracy === null || accuracy === undefined) {
      setSubmitError({
        code: 'NO_ACCURACY',
        message: 'GPS accuracy could not be read from this fix — go back and capture again in open sky.',
        status: null,
      });
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const payload: CapturePayload = {
        lat: location.coords.latitude,
        lng: location.coords.longitude,
        accuracy,
        mocked: Boolean(location.mocked),
        siteId: site?.id,
        photo: {
          uri: photo.uri,
          name: `${mode === 'in' ? 'checkin' : 'checkout'}-${Date.now()}.jpg`,
          mimeType: 'image/jpeg',
        },
      };
      const res =
        mode === 'in'
          ? await attendanceApi.checkIn(payload, deviceId)
          : await attendanceApi.checkOut(payload, deviceId);
      setResult(res);
      setPhase('success');
    } catch (e) {
      setSubmitError(apiError(e));
    } finally {
      setSubmitting(false);
    }
  }, [photo, location, deviceId, site?.id, mode]);

  const retake = useCallback(() => {
    setPhoto(null);
    setLocation(null);
    setSubmitError(null);
    setResult(null);
    setPhase('camera');
  }, []);

  // ── Success ────────────────────────────────────────────────────────────────

  if (phase === 'success' && result) {
    return (
      <ScrollView
        style={styles.flex}
        contentContainerStyle={[styles.successWrap, { paddingTop: insets.top + spacing.xxl }]}
      >
        <View style={styles.successIcon}>
          <Ionicons name="checkmark" size={44} color="#06251A" />
        </View>
        <Text style={styles.successTitle}>{result.message}</Text>
        <Text style={styles.successSub}>
          {mode === 'in' ? 'Checked in at' : 'Checked out at'}{' '}
          {formatTime(mode === 'in' ? result.record.checkIn.time : result.record.checkOut?.time ?? null)}{' '}
          on the server clock.
        </Text>

        <Card style={styles.successCard}>
          <View style={styles.rowBetween}>
            <Text style={styles.successCardTitle}>Record</Text>
            <StatusChip status={result.record.status} />
          </View>
          <View style={styles.kvBlock}>
            <KeyValue label="Distance from site" value={`${result.distanceMeters} m`} />
            {result.record.site ? <KeyValue label="Site" value={result.record.site.name} /> : null}
            {mode === 'out' && result.record.workedMinutes !== null ? (
              <KeyValue
                label="Worked today"
                value={`${Math.floor(result.record.workedMinutes / 60)}h ${result.record.workedMinutes % 60}m`}
              />
            ) : null}
          </View>
          {result.flags.length ? (
            <View style={styles.flagsRow}>
              {result.flags.map((f) => (
                <FlagChip key={f} flag={f} />
              ))}
            </View>
          ) : (
            <Text style={styles.noFlags}>No anti-fraud flags on this record.</Text>
          )}
        </Card>

        <Button title="Done" onPress={() => navigation.goBack()} style={styles.wideButton} />
      </ScrollView>
    );
  }

  // ── Review ─────────────────────────────────────────────────────────────────

  if (phase === 'review' && photo && location) {
    const accuracy = location.coords.accuracy ?? null;
    const mocked = Boolean(location.mocked);
    const distance =
      site !== null
        ? haversineMeters(location.coords.latitude, location.coords.longitude, site.lat, site.lng)
        : null;
    const withinFence = distance !== null && site !== null ? distance <= site.radiusM : null;

    return (
      <ScrollView style={styles.flex} contentContainerStyle={styles.reviewContainer}>
        <Image source={{ uri: photo.uri }} style={styles.preview} resizeMode="cover" />

        {mocked ? (
          <InfoBox
            tone="warning"
            text="This device reports a MOCK location. The server rejects spoofed GPS fixes — the check-in will fail while mock locations are enabled."
          />
        ) : null}
        {accuracy !== null && accuracy > ACCURACY_HINT_METERS ? (
          <InfoBox
            tone="warning"
            text={`GPS accuracy is ±${Math.round(accuracy)} m, which may exceed the server limit (typically ±${ACCURACY_HINT_METERS} m). Move to open sky and retake if the submission is rejected.`}
          />
        ) : null}
        {submitError ? <ErrorBox error={submitError} onRetry={() => void handleSubmit()} /> : null}

        <Card>
          <Text style={styles.cardTitle}>Location proof</Text>
          <View style={styles.kvBlock}>
            <KeyValue
              label="Coordinates"
              value={`${location.coords.latitude.toFixed(6)}, ${location.coords.longitude.toFixed(6)}`}
            />
            <KeyValue
              label="Accuracy"
              value={accuracy === null ? 'unknown' : `±${Math.round(accuracy)} m`}
              valueColor={accuracy !== null && accuracy <= ACCURACY_HINT_METERS ? colors.success : colors.warning}
            />
            <KeyValue label="Mock location" value={mocked ? 'YES (will be rejected)' : 'No'} valueColor={mocked ? colors.danger : colors.success} />
            {site ? (
              <>
                <KeyValue label="Site" value={site.name} />
                <KeyValue
                  label="Distance to site"
                  value={distance === null ? '—' : `${formatDistance(distance)} (fence ${site.radiusM} m)`}
                  valueColor={withinFence === false ? colors.warning : colors.success}
                />
              </>
            ) : (
              <KeyValue label="Site" value="Resolved by server on submit" />
            )}
          </View>
          {site && withinFence === false ? (
            <Text style={styles.warnText}>
              You appear to be outside the geofence — the server may reject this {mode === 'in' ? 'check-in' : 'check-out'}.
            </Text>
          ) : null}
          {site && withinFence === true ? (
            <Text style={styles.okText}>You are inside the geofence. Server-side verification still applies.</Text>
          ) : null}
        </Card>

        <Button
          title={mode === 'in' ? 'Submit check-in' : 'Submit check-out'}
          icon="cloud-upload-outline"
          onPress={() => void handleSubmit()}
          loading={submitting}
          disabled={submitting}
        />
        <Button title="Retake photo" variant="ghost" onPress={retake} disabled={submitting} />
      </ScrollView>
    );
  }

  // ── Camera ─────────────────────────────────────────────────────────────────

  if (!permission) {
    return <Loader label="Preparing camera…" />;
  }

  if (!permission.granted) {
    const canAsk = permission.canAskAgain !== false;
    return (
      <View style={[styles.flex, styles.permissionWrap]}>
        <Ionicons name="camera-outline" size={44} color={colors.textDim} />
        <Text style={styles.permissionTitle}>Camera permission needed</Text>
        <Text style={styles.permissionText}>
          Attendance photos must be captured live with the in-app camera — this is what makes the record
          trustworthy. There is no gallery option for attendance.
        </Text>
        <Button
          title="Allow camera"
          icon="camera"
          onPress={() => void requestPermission()}
          disabled={!canAsk}
          style={styles.wideButton}
        />
        <Button
          title="Open device settings"
          variant="secondary"
          icon="settings-outline"
          onPress={() => void Linking.openSettings()}
          style={styles.wideButton}
        />
        <Button title="Cancel" variant="ghost" onPress={() => navigation.goBack()} style={styles.wideButton} />
      </View>
    );
  }

  return (
    <View style={styles.flex}>
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing="front"
        onCameraReady={() => setCameraReady(true)}
      />

      {/* Top bar */}
      <View style={[styles.cameraTop, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.closeButton} hitSlop={12}>
          <Ionicons name="close" size={24} color={colors.white} />
        </Pressable>
        <View style={styles.modePill}>
          <Ionicons
            name={mode === 'in' ? 'log-in-outline' : 'log-out-outline'}
            size={14}
            color={colors.white}
          />
          <Text style={styles.modePillText}>{mode === 'in' ? 'CHECK IN' : 'CHECK OUT'}</Text>
        </View>
        <View style={styles.closeButton} />
      </View>

      {/* GPS issue overlay */}
      {locationIssue ? (
        <View style={styles.overlay}>
          <View style={styles.overlayCard}>
            <Ionicons
              name={locationIssue.kind === 'permission-denied' ? 'navigate-outline' : 'location-outline'}
              size={34}
              color={colors.warning}
            />
            <Text style={styles.overlayTitle}>
              {locationIssue.kind === 'services-off'
                ? 'Location (GPS) is off'
                : locationIssue.kind === 'permission-denied'
                  ? 'Location permission needed'
                  : 'GPS problem'}
            </Text>
            <Text style={styles.overlayText}>{locationIssue.message}</Text>
            <Button
              title="Open device settings"
              icon="settings-outline"
              onPress={() => void Linking.openSettings()}
              style={styles.wideButton}
            />
            <Button
              title="I've fixed it — try again"
              variant="secondary"
              icon="refresh"
              onPress={() => void handleShutter()}
              style={styles.wideButton}
            />
            <Button title="Cancel" variant="ghost" onPress={() => setLocationIssue(null)} style={styles.wideButton} />
          </View>
        </View>
      ) : null}

      {/* Busy overlay while GPS + photo are collected */}
      {busy ? (
        <View style={styles.overlay}>
          <View style={styles.overlayCard}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.overlayTitle}>Getting GPS fix & capturing…</Text>
            <Text style={styles.overlayText}>Hold steady — a live photo is being taken with your location.</Text>
          </View>
        </View>
      ) : null}

      {/* Bottom controls */}
      <View style={[styles.cameraBottom, { paddingBottom: insets.bottom + spacing.xl }]}>
        <Text style={styles.cameraHint}>Live photo + GPS are verified by the server</Text>
        <Pressable
          onPress={() => void handleShutter()}
          disabled={!cameraReady || busy}
          style={({ pressed }) => [
            styles.shutterOuter,
            (!cameraReady || busy) && styles.shutterDisabled,
            pressed && styles.shutterPressed,
          ]}
        >
          <View style={styles.shutterInner} />
        </Pressable>
        <Text style={styles.cameraHintSmall}>
          {cameraReady ? 'Position yourself at the site, then tap to capture' : 'Starting camera…'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  kvBlock: { marginTop: spacing.sm },
  flagsRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: spacing.sm },
  wideButton: { alignSelf: 'stretch', marginTop: spacing.md },

  // Success
  successWrap: { padding: spacing.xl, alignItems: 'center', flexGrow: 1 },
  successIcon: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xl,
  },
  successTitle: { color: colors.text, fontSize: font.title, fontWeight: '800', marginTop: spacing.lg, textAlign: 'center' },
  successSub: { color: colors.textDim, fontSize: font.small, marginTop: spacing.xs, textAlign: 'center', lineHeight: 20 },
  successCard: { alignSelf: 'stretch', marginTop: spacing.xl },
  successCardTitle: { color: colors.text, fontWeight: '700', fontSize: font.body },
  noFlags: { color: colors.textFaint, fontSize: font.small, marginTop: spacing.sm },

  // Review
  reviewContainer: { padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md },
  preview: {
    width: '100%',
    height: 320,
    borderRadius: radius.lg,
    backgroundColor: colors.cardAlt,
  },
  cardTitle: { color: colors.text, fontWeight: '700', fontSize: font.body, marginBottom: spacing.xs },
  warnText: { color: colors.warning, fontSize: font.small, marginTop: spacing.sm, lineHeight: 18 },
  okText: { color: colors.success, fontSize: font.small, marginTop: spacing.sm, lineHeight: 18 },

  // Camera chrome
  cameraTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    backgroundColor: 'rgba(8,13,24,0.55)',
  },
  closeButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  modePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: 'rgba(79,140,255,0.9)',
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  modePillText: { color: colors.white, fontSize: font.tiny, fontWeight: '800', letterSpacing: 1 },
  cameraBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingTop: spacing.lg,
    backgroundColor: 'rgba(8,13,24,0.55)',
  },
  cameraHint: { color: colors.white, fontSize: font.small, marginBottom: spacing.md, fontWeight: '600' },
  cameraHintSmall: { color: 'rgba(233,239,250,0.7)', fontSize: font.tiny, marginTop: spacing.md },
  shutterOuter: {
    width: 78,
    height: 78,
    borderRadius: 39,
    borderWidth: 4,
    borderColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInner: { width: 58, height: 58, borderRadius: 29, backgroundColor: colors.white },
  shutterDisabled: { opacity: 0.5 },
  shutterPressed: { transform: [{ scale: 0.95 }] },

  // Overlays / permission
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(5,9,17,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  overlayCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: spacing.xl,
    alignItems: 'center',
    width: '100%',
  },
  overlayTitle: { color: colors.text, fontSize: font.h2, fontWeight: '700', marginTop: spacing.md, textAlign: 'center' },
  overlayText: { color: colors.textDim, fontSize: font.small, textAlign: 'center', lineHeight: 20, marginTop: spacing.sm },
  permissionWrap: { alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  permissionTitle: { color: colors.text, fontSize: font.title - 2, fontWeight: '800', marginTop: spacing.lg },
  permissionText: {
    color: colors.textDim,
    fontSize: font.body,
    textAlign: 'center',
    lineHeight: 22,
    marginTop: spacing.md,
    maxWidth: 420,
  },
});

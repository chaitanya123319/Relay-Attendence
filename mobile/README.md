# RELAY Attendance — Mobile App (Site Engineer)

Expo (React Native + TypeScript) app for construction-site engineers: geo-verified
check-in / check-out with a **live in-app camera photo** and GPS, attendance history,
monthly summary, the full leave workflow (balance / apply / status / cancel),
notifications with an unread badge, and profile.

Every anti-fraud and business rule is enforced **server-side** (geofence, mock-GPS
rejection, low-accuracy rejection, duplicate blocking, camera-only photos, leave
balance reservation, overlap checks, half-day rules, document-required types) — this
app collects the proof, submits it, and renders exactly what the API returns.

---

## 1. Prerequisites

- Node.js 18+ and npm (developed against Node 26 / npm 11 on Windows 11)
- The RELAY backend running locally (`backend/`, default `http://localhost:4000`) with seeded data
- For device testing: the **Expo Go** app (Android/iOS) on a phone on the same Wi-Fi as your PC
- No Android SDK / Xcode needed for the checks in this repo (`expo export` bundles with Metro only)

## 2. Setup

```bash
cd mobile
npm install
```

Already wired in `package.json`: `expo-camera`, `expo-location`, `expo-secure-store`,
`expo-notifications`, `expo-document-picker`, `@react-native-community/datetimepicker`,
`@expo/vector-icons`, `axios`, `@react-navigation/native` + `native-stack` + `bottom-tabs`,
`react-native-screens`, `react-native-safe-area-context` (the last two pinned to the
versions Expo SDK 57 expects — `npx expo install --check` reports "Dependencies are up to date").

## 3. Configure the API URL (important for physical phones)

The base URL comes from `EXPO_PUBLIC_API_URL` and falls back to `http://localhost:4000`:

- **Emulator/simulator**: `http://localhost:4000` works as-is (Android emulator reaches the
  host loopback via the Expo proxy; if not, use `http://10.0.2.2:4000`).
- **Physical phone**: `localhost` points at the phone itself. Set your PC's LAN IP:

  ```bash
  # find the PC's LAN IP (Windows: ipconfig), then:
  EXPO_PUBLIC_API_URL=http://192.168.1.20:4000 npx expo start
  # or copy .env.example to .env and edit it (Expo reads .env automatically)
  ```

  The backend must listen on `0.0.0.0` (it does) and the Windows firewall must allow
  inbound TCP on port 4000.
- Cleartext HTTP is enabled for local dev (`android.usesCleartextTraffic: true` in `app.json`).

## 4. Run

```bash
npx expo start            # then press "a" for Android, or scan the QR with Expo Go
```

Sign in with a seeded engineer account (below). The app targets the **ENGINEER** role —
the self-service attendance/leave endpoints are engineer-only on the backend.

## 5. Demo accounts (seeded backend, password for ALL: `Relay@123`)

| Role     | Email                  | Employee ID |
|----------|------------------------|-------------|
| ENGINEER | engineer1@relay.local  | EMP-0011    |
| ENGINEER | engineer2@relay.local  | EMP-0012    |
| ENGINEER | engineer3@relay.local  | EMP-0013    |
| ENGINEER | engineer4@relay.local  | EMP-0014    |
| ENGINEER | engineer5@relay.local  | EMP-0015    |
| MANAGER  | manager1@relay.local   | EMP-0003    |
| HR       | hr@relay.local         | EMP-0002    |
| ADMIN    | admin@relay.local      | EMP-0001    |

You can sign in with the email **or** the employee ID.

## 6. What the app does (screen map)

| Area | Screen | Behaviour |
|---|---|---|
| Auth | Login | `POST /auth/login`; session (access + refresh + deviceId) persisted in `expo-secure-store` |
| Home | Today | Today's status card, live "worked so far", assigned site card, big Check-In / Check-Out buttons |
| Home → Capture | Camera flow | Front-camera `CameraView` → GPS fix (`expo-location`) → review (photo, coords, ±accuracy, mock flag, client-side distance vs geofence) → multipart submit `captureSource=camera` → server distance / flags / message, or the exact server error (GEO_OUT_OF_RANGE with distance, LOW_GPS_ACCURACY, MOCKED_LOCATION, ALREADY_CHECKED_IN, CHECK_IN_REQUIRED, ALREADY_CHECKED_OUT, PHOTO_SOURCE_INVALID…) |
| History | Records | `GET /attendance/me` with date-range filter + presets, pagination, pull-to-refresh, signed-URL photo thumbnails (IN/OUT) with full-screen viewer |
| Summary | Month | Month stepper + `GET /attendance/me/summary`: counts grid (present/late/half-day/incomplete/absent/on-leave/weekly-off/worked) + day-by-day rows |
| Leave | Balance | `GET /leave/balances/me` per year with allocated / used / pending / available |
| Leave | Apply | Type picker (document requirements, half-day & notice limits surfaced), `@react-native-community/datetimepicker` date fields, half-day toggle + AM/PM, reason, supporting document via `expo-document-picker` (PDF/JPG/PNG ≤ 5 MB) → multipart `POST /leave/requests` |
| Leave | My requests | `GET /leave/requests/me` with status filter chips, decision comments, document links (signed URLs), cancel for PENDING |
| Alerts | Notifications | `GET /notifications/me`, tap = mark read, mark-all-read, unread-only filter, unread count badge on the tab, best-effort Expo push token registration |
| Profile | Account | User info, API endpoint, device ID, push status, sign out (`POST /auth/logout`) |

Cross-cutting: camera/location permission denied → explain + retry + `Linking.openSettings()`;
GPS services off → actionable state with an "Open settings" button; no network → retry UIs and
human-readable error boxes everywhere; 401 → single transparent refresh + retry of the original
request, and refresh failure clears the session and returns to Login.

## 7. Verification (all run against this repo, real output)

1. **Type check**
   ```
   $ npx tsc --noEmit
   (no output — clean, exit 0)
   ```

2. **Production bundle (Metro, no Android SDK required)**
   ```
   $ npx expo export --platform android
   Starting Metro Bundler
   Android Bundled ... index.ts (980 modules)
   › android bundles (1):
     _expo/static/js/android/index-7937eb748fb56d81c9b3ac4ec4f05193.hbc (2.4MB)
   › Files (1): metadata.json
   Exported: dist
   ```

3. **Dev server boot smoke**
   ```
   $ npx expo start --port 8081   # in background
   Starting project at C:\Users\Admin\relay-attendance\mobile
   Starting Metro Bundler
   Waiting on http://localhost:8081
   $ curl -s -o /dev/null -w "%{http_code}" http://localhost:8081
   200        # bundler serves; process then stopped
   ```

4. **Live API sanity against the seeded backend (:4000, GETs only — no records created)**
   - `POST /auth/login` with `engineer1@relay.local / Relay@123` → `{accessToken, refreshToken, user{employeeId: EMP-0011, role: ENGINEER}}`
   - `GET /attendance/me?pageSize=1` → `items[0]` keys: `id, date, status, flags, checkIn{time,lat,lng,accuracy,distanceMeters,photoEndpoint,photoHash}, checkOut, workedMinutes, clientDriftSeconds, deviceId, site{id,name,lat,lng,radiusM}`
   - `GET /attendance/me/summary?month=2026-10` → `{month, summary{present,late,halfDay,incomplete,absent,onLeave,weeklyOff,totalWorkedMinutes}, days[]}`
   - `GET /leave/balances/me` → `[{year, leaveType{id,code,name,paid}, allocated, used, pending, available}]`
     (note: the real route is `/leave/balances/me`; `/leave/balance/me` is 404)
   - `GET /leave/types` → annualQuota / paid / requiresDocument / minNoticeDays / maxConsecutiveDays / allowHalfDay
   - `GET /leave/requests/me` → requests with `leaveType`, `documents`, `decidedBy`, `decisionComment`
   - `GET /notifications/me` → `[{id, userId, title, body, type, data, readAt, createdAt}]`
   - `POST /uploads/signed-url {path}` → `{url, expiresAt}`; fetching the returned URL without an
     auth header returned `200, image/png` — the `<Image>` thumbnail flow works as designed.

   Response shapes were confirmed to match the TypeScript types the app parses.

## 8. Project structure

```
mobile/
├── App.tsx                    # root: notification handler, providers, navigator
├── app.json                   # Expo config (plugins, permissions, cleartext for dev)
├── src/
│   ├── api/endpoints.ts       # typed API calls (auth, attendance, leave, notifications, uploads, sites)
│   ├── lib/api.ts             # axios baseURL + Bearer/401-refresh-retry interceptors + error normalisation
│   ├── lib/session.ts         # SecureStore tokens + stable deviceId
│   ├── lib/push.ts            # best-effort Expo push registration
│   ├── store/                 # AuthContext (session bootstrap) + NotificationsContext (unread badge/polling)
│   ├── navigation/            # root stack (Login | Main + Capture modal), bottom tabs, leave stack
│   ├── components/            # design-system pieces (Button, Card, chips, fields, PhotoThumb…)
│   ├── screens/               # Login, Home, Capture, History, Summary, Leave*, Notifications, Profile
│   ├── theme.ts               # dark palette + spacing tokens
│   └── utils/                 # date/time and Haversine helpers
└── dist/                      # output of `npx expo export` (git-ignored)
```

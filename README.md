<<<<<<< HEAD
# Relay-Attendence
A smart attendance and leave management system for site engineers featuring GPS-based check-in/check-out, live photo verification, real-time attendance tracking, leave approval workflows, and a centralized management dashboard.
=======
# RELAY Attendance

Geo-tagged attendance & leave management for construction site engineers.
Proves physical presence at the assigned project site using a **live camera photo + GPS**, enforces a **server-side geofence**, and adds a complete **leave management workflow** with manager/HR/admin dashboards and payroll-ready reports.

| Component | Stack | Folder |
|---|---|---|
| Backend API + DB | Node.js · Express · TypeScript · Prisma · JWT · zod · Jest | `backend/` |
| Mobile app (Engineer) | Expo / React Native · TypeScript · expo-camera · expo-location | `mobile/` |
| Web dashboard (Manager/HR/Admin) | React · Vite · TypeScript · Tailwind · recharts · Leaflet | `web/` |

Full design: **`ARCHITECTURE.md`** (API contract, ER diagram, anti-fraud rules) · decisions: **`DECISIONS.md`** · verification log: **`PROGRESS.md`** · manual E2E checklist: **`TESTING.md`**.

## What it enforces (all server-side)

- **Live photo only** — attendance photos must come from the in-app camera flow (`captureSource=camera`); every photo is SHA-256 hashed and stored behind a `StorageService`.
- **Server-authoritative time** — the client clock is only used to *flag* large drift (`TIME_DRIFT`); stored times are the server's.
- **Geofence** — Haversine distance vs site radius (default 150 m). Sites are `REJECT` (422 with the distance in the message) or `FLAG` (recorded with `OUT_OF_RANGE`).
- **GPS quality & mocking** — accuracy > 50 m and mocked/spoofed fixes are rejected.
- **Duplicates** — one record per engineer per day (`@@unique`), no check-out without check-in, no double check-out.
- **Leave balance** — `available = allocated − used(approved) − pending`; approval deducts, reject/cancel release; overlaps, past-date policy, half-day rules and required documents validated.
- **Audit** — logins, every attendance event, leave decisions and exports go to `AuditLog`.

## Prerequisites

- Node.js **20+** (developed on Node 26) and npm.
- Docker Desktop *(optional — only for the Postgres compose path and for running a local Postgres)*.
- For the mobile app: the **Expo Go** app on a phone, or an Android/iOS emulator *(optional — the app also type-checks and bundles without a device)*.

---

## Option A — Local run in ~10 minutes (SQLite, zero install)

```bash
cd backend
npm install
npm run setup        # creates .env with random JWT secrets
npm run db:deploy    # applies the committed Prisma migration
npm run db:seed      # 1 admin, 1 HR, 2 managers, 5 engineers, 3 sites, 14 days of data
npm run dev          # API on http://localhost:4000
```

Sanity check: `curl http://localhost:4000/api/health` → `{"status":"ok",...}`

Run the test suite (46 tests, includes the DB migration itself):

```bash
npm test
```

## Option B — Docker Compose (PostgreSQL + API)

```bash
docker compose up --build     # from the repository root
```

- API: `http://localhost:4000` · Postgres: exposed on `127.0.0.1:5433`.
- The container applies the schema, seeds demo data **when the DB is empty**, and restarts keep data (volume `relay_pgdata`).
- Override ports if busy: `BACKEND_PORT=4005 DB_PORT=5434 docker compose up --build`.
- Set real `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` (root `.env` or environment) for anything beyond local dev.

## Demo accounts (password for all: `Relay@123`)

| Role | Email | Employee ID |
|---|---|---|
| Admin | admin@relay.local | EMP-0001 |
| HR | hr@relay.local | EMP-0002 |
| Manager | manager1@relay.local | EMP-0003 |
| Manager | manager2@relay.local | EMP-0004 |
| Engineer ×5 | engineer1..5@relay.local | EMP-0011..0015 |

Login accepts **email or employee ID**.

## Mobile app (site engineers)

```bash
cd mobile
npm install
npx expo start        # then press a (Android), i (iOS simulator) or scan with Expo Go
```

- API URL comes from `EXPO_PUBLIC_API_URL` (defaults to `http://localhost:4000`). Create `mobile/.env`:
  - Physical phone: `EXPO_PUBLIC_API_URL=http://<your-PC-LAN-IP>:4000` (phone and PC on the same network).
  - Android emulator: `EXPO_PUBLIC_API_URL=http://10.0.2.2:4000`.
- Flows: login → Check-In/Check-Out with live camera + GPS (shows server distance / rejection reasons) → history → monthly summary → apply leave (with optional document) → balances → status tracking → notifications → logout.

## Web dashboard (manager / HR / admin)

```bash
cd web
npm install
npm run dev           # http://localhost:5173 (dev)
# or: npm run build && npm run preview
```

- **Manager**: today's team board (list + map + photos), pending leave queue with approve/reject, reports.
- **HR/Admin**: employees, project sites (map picker for the geofence), assignments, leave types & quotas, balances, attendance/leave/payroll reports with **CSV + PDF export**, photo viewer with coordinates/distance/timestamp.
- Map tiles need internet (OpenStreetMap); the site form also accepts manual lat/lng.

## Backend environment (`.env`, see `backend/.env.example`)

| Var | Default | Purpose |
|---|---|---|
| `DATABASE_URL` | `file:./dev.db` | SQLite for dev; compose sets the Postgres URL |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | generated by `npm run setup` | token signing (never commit real ones) |
| `ACCESS_TOKEN_TTL_MIN` / `REFRESH_TOKEN_TTL_DAYS` | 15 / 7 | token lifetimes |
| `COMPANY_TZ` | `Asia/Kolkata` | business timezone for attendance dates |
| `STORAGE_DIR` | `./storage` | where photos/documents live (swap for S3 behind `StorageService`) |
| `GPS_ACCURACY_MAX_M` | 50 | reject fixes worse than this |
| `TIME_DRIFT_MAX_S` | 600 | flag larger client/server clock drift |
| `LOGIN_RATE_LIMIT_MAX` | 20 | login attempts per IP / 15 min (compose demo sets 1000) |
| `MAX_UPLOAD_MB` / `MAX_DOC_UPLOAD_MB` | 10 / 5 | upload size caps |
| `CORS_ORIGIN` | `*` | comma-separated origins or `*` |

## API quick reference (full contract: `ARCHITECTURE.md` §4)

```bash
# login
ACCESS=$(curl -s -X POST http://localhost:4000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"identifier":"engineer1@relay.local","password":"Relay@123"}' | grep -o '"accessToken":"[^"]*' | cut -d'"' -f4)

# check-in (live photo + GPS, multipart)
curl -X POST http://localhost:4000/api/attendance/check-in \
  -H "Authorization: Bearer $ACCESS" \
  -F photo=@selfie.jpg \
  -F lat=18.59132 -F lng=73.73891 -F accuracy=12 \
  -F clientTimestamp=$(date -u +%Y-%m-%dT%H:%M:%S.000Z) \
  -F deviceId=curl-demo-01 -F mocked=false -F captureSource=camera

# reports (HR): CSV / PDF / JSON
curl -H "Authorization: Bearer $HR_ACCESS" \
  "http://localhost:4000/api/reports/attendance?month=2026-10&format=csv" -o attendance.csv
curl -H "Authorization: Bearer $HR_ACCESS" \
  "http://localhost:4000/api/reports/payroll?month=2026-10&format=pdf" -o payroll.pdf
```

## Tests

Backend: **46 Jest + supertest tests** across auth/RBAC, attendance anti-fraud (geofence REJECT/FLAG, duplicates, accuracy, mocking, drift, camera attestation, photo ownership, signed URLs), leave workflow (reservation/approval/rejection/cancellation balance semantics, overlap, past-date, documents, manager scope) and reports (CSV/PDF bytes, scoping, auditing).

```bash
cd backend && npm test
```

## Troubleshooting

- **npm 11 blocks install scripts** (Prisma engines, esbuild): run `npm install-scripts approve --all` then `npm rebuild` inside the package folder, then retry.
- **Port 4000 busy**: `PORT=4010 npm run dev` (and point `EXPO_PUBLIC_API_URL` / the web app at it).
- **Reset local data**: `npm run db:reset && npm run db:seed` (SQLite).
- **Phone can't reach the API**: same Wi-Fi, use the PC's LAN IP, and allow Node through the Windows firewall.
>>>>>>> e7be371 (RELAY Attendance: full system — Express/Prisma backend (46 Jest tests, geofenced anti-fraud attendance + leave workflow + reports), Expo mobile app, React dashboard, Docker Compose, docs)

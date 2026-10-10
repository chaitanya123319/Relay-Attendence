# RELAY Attendance — end-to-end test checklist

Three levels of verification: **automated backend suite** (run it), **automated live smoke** (run it against a seeded API), then **manual app/dashboard flows** (click-through, expected results listed).

---

## 1. Automated test suite (backend)

```bash
cd backend && npm test
```

Expected: **46 passed, 46 total** across 4 suites — `auth` (9), `attendance` (16), `leave` (14), `reports` (7). The suite re-creates `prisma/test.db` from the committed migration on every run (`tests/globalSetup.js`), so the migration itself is exercised.

### What the suite locks down

| Area | Scenarios |
|---|---|
| Auth/RBAC | login by email & employee ID, wrong password, unknown user, /me auth, refresh rotation + reuse revocation, logout, deactivated user, zod envelope, role guards |
| Check-in | inside radius recorded + photo hash + server timestamp; outside radius REJECT→422 w/ distance; FLAG→record + `OUT_OF_RANGE` + manager notification; duplicate→409; missing photo→400; non-camera source→422; low accuracy→422; mocked→422; clock drift→flag; RBAC; audit rows |
| Check-out | without check-in→409; double→409; worked minutes + photo + HALF_DAY rule |
| Photos | owner/role streaming, outsider 403, signed URL mint/use/tamper |
| Leave | apply + reservation, overlap→409, insufficient→422, approve deducts + notifies, reject needs comment + releases, cancel releases, half-day rules, past-date policy, document required/attached + access matrix, manager scope, double-decision guard, ON_LEAVE in attendance summary |
| Reports | JSON counts, CSV BOM + filename, real PDF bytes, scoping, RBAC, export audit |

## 2. Automated live smoke test (running backend)

With the API running and seeded (`npm run dev` in `backend/` after `npm run db:seed`):

```bash
bash scripts/e2e-smoke.sh                 # or: BASE=http://localhost:4005 bash scripts/e2e-smoke.sh
```

Journey: admin creates `SMOKE-*` engineer → assigns a site → engineer logs in → check-in (multipart live-photo) → duplicate blocked → mocked-GPS blocked → check-out → history + summary → applies leave → manager approves → balance 12→11 → HR CSV report contains the user → PDF magic bytes → signed-URL photo streams → smoke user deactivated. Expected: **`Result: N passed, 0 failed`** and exit code 0.

## 3. Docker Compose path

```bash
docker compose up --build -d
curl http://localhost:4000/api/health          # {"status":"ok",...}
curl -s -X POST http://localhost:4000/api/auth/login -H 'Content-Type: application/json' \
     -d '{"identifier":"admin@relay.local","password":"Relay@123"}' | head -c 120
BASE=http://localhost:4000 bash scripts/e2e-smoke.sh
docker compose down
```

Expected: API healthy, login returns tokens, smoke script green, data persists across `docker compose restart backend` (seed runs only when the DB is empty).

## 4. Mobile app — manual click-through (Expo Go / emulator)

Setup: `cd mobile && npm install && npx expo start`; `.env` with `EXPO_PUBLIC_API_URL` pointing at the backend (LAN IP for a physical phone).

| # | Flow | Expected |
|---|---|---|
| 1 | Login wrong password | Inline error, stays on login |
| 2 | Login engineer1@relay.local / Relay@123 | Home shows today's status + shift info |
| 3 | Deny camera permission on Check-In | Explanatory card + button to open Settings; no crash |
| 4 | Check-In with GPS off | "Location services are off" state with fix guidance |
| 5 | Check-In from far away (simulate by editing `.env` API? use site far from you) | Server rejects with the distance ("You are 1.2 km from …") — radius shown |
| 6 | Check-In on site (or with FLAG site) | Success card: distance, time, status; photo stored |
| 7 | Check-In again | "Already checked in today" |
| 8 | Check-Out | Worked time shown; HALF_DAY if < threshold |
| 9 | History | Today's record with in/out photos + flags |
| 10 | Summary | Counts grid (present/late/half/absent/leave) + per-day list |
| 11 | Apply leave (2 days, Casual) | Success; appears Pending under My Requests |
| 12 | Apply leave overlapping | Blocked with overlap message |
| 13 | Balance screen | Available decreased by the pending days |
| 14 | Airplane mode → pull to refresh | Friendly retry UI, no crash |
| 15 | Notifications | Approval/rejection entries; tapping marks read |

## 5. Web dashboard — manual click-through

Setup: `cd web && npm install && npm run dev` → http://localhost:5173.

| # | Role | Flow | Expected |
|---|---|---|---|
| 1 | Manager | Login manager1@relay.local | Team Today loads with seeded engineers + status chips |
| 2 | Manager | Open a checked-in record | Photo viewer: in/out photos, coordinates, distance, worked time, hash |
| 3 | Manager | Leave Queue → Approve with comment | Status flips; engineer notification appears |
| 4 | Manager | Reject without comment | Blocked (comment required) |
| 5 | Manager | Reports → Download CSV / PDF | Files download with real rows / real PDF |
| 6 | HR | Employees → create user | Appears in list; can log in |
| 7 | HR | Balances → adjust allocation | New value reflected (audited) |
| 8 | HR | Payroll report CSV/PDF | Columns: working days, worked, paid/unpaid leave |
| 9 | Admin | Sites → create with map picker + radius + REJECT/FLAG | New site appears; engineers can check in there |
| 10 | Admin | Assign engineer to site | Assignment visible on site card + team board updates |
| 11 | Admin | Leave types → deactivate one | Engineers no longer see it in the app |
| 12 | Any | Session expiry (wait 15 min, act) | Silent refresh; no data loss |
| 13 | Engineer login on web | Friendly "use the mobile app" message |

## 6. Verified-on-this-machine summary

See `PROGRESS.md` for the command-by-command log. Headline results:

- Backend: `npx tsc --noEmit` clean · `npx jest` **46/46 green** · live curl smoke across all modules (health, auth, team board, summary, balances, leave queue, notifications, CSV + PDF bytes).
- Docker: compose stack (Postgres 16 + API) built and served; `/api/health` + login + seeded data verified via the smoke script *(see PROGRESS.md Phase 8 entry)*.
- Mobile: `tsc --noEmit` + `expo export` results recorded in PROGRESS.md Phase 6.
- Web: `npm run build` + preview serve + live API smoke recorded in PROGRESS.md Phase 7.

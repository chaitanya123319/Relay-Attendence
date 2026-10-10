# PROGRESS

Running log, one entry per phase. "Verified" = the exact command/output that proves it.

## Phase 1 — Plan ✅
- Wrote `ARCHITECTURE.md` (folder layout, ER diagram, full API contract, auth flow, geofence/anti-fraud rules, leave engine rules, testing strategy) and `DECISIONS.md` (16 numbered decisions with rationale).
- Scaffolded repository layout + `git init`.
- Environment check: Node v26.7.0, npm 11.19.0, Docker 29.7.2 + Compose v5.5.0 available, no local Postgres → SQLite for dev/test, Postgres via Compose (decision #1).
- Verified: `node -v`, `docker ps`, folder tree created.

## Phase 2 — Backend foundation ✅
- Project setup: `package.json` (Express 4, Prisma 6.19, zod, multer, JWT, helmet, rate-limit, pdfkit), TS strict, ESLint 9 flat config, Prettier, Jest + ts-jest + supertest.
- `scripts/setup-env.js` generates random JWT secrets into `.env` (nothing hardcoded; `.env.example` tracked).
- Prisma schema with all 12 models, indexes and constraints (`AttendanceRecord @@unique([userId, date])`, `LeaveBalance @@unique([userId, leaveTypeId, year])`); migration `20261009074653_init` created & applied to `prisma/dev.db`.
- Seed: 1 admin, 1 HR, 2 managers, 5 engineers, 3 sites, assignments, 4 leave types, balances, **57 attendance records over the last 14 days** (late marks, half-day, missing check-out, OUT_OF_RANGE flag day), leaves in all 4 states, notifications, audit rows. Photos written through the real `StorageService` + sha256-hashed.
- Auth + RBAC: JWT access (15 min) + rotating hashed refresh (7 d, reuse-revocation), login by email **or** employee ID, logout revocation, `authenticate` + `requireRole` middleware, central `{error:{code,message}}` envelope, zod validation, login rate limiting, helmet, CORS.
- **Verified:** `npx tsc --noEmit` clean; `npx jest` → **9/9 auth tests pass** (login email/ID, wrong password, unknown user, /me auth, refresh rotation + reuse revocation, logout, deactivated user, validation envelope). Live boot verified by smoke run (`/api/health`, login, `/api/auth/me` curl).

## Phase 3 — Attendance APIs ✅
- Full anti-fraud pipeline server-side: server-authoritative timestamps, Haversine geofence (REJECT → 422 with distance in message/details; FLAG → record + `OUT_OF_RANGE`), mock-GPS rejection, accuracy ≤ 50 m gate, camera-only photo attestation (`captureSource`), SHA-256 photo hashing, duplicate check-in / check-out-without-check-in / double check-out blocks, clock-drift → `TIME_DRIFT` flag, device ID + IP stored, audit log on every event, manager notified on flags.
- Photo storage via `StorageService` (path-traversal guarded), authenticated streaming + HMAC signed URLs (15-min expiry, constant-time verify), ownership/role checks.
- History (date-range filter + pagination) and monthly summary (present/late/half-day/absent/on-leave + worked minutes) endpoints; manager team board scoped to managed sites.
- **Verified:** `npx tsc --noEmit` clean; Jest **16 new attendance tests pass** — inside radius, outside radius (REJECT), duplicate, check-out w/o check-in, low accuracy, mocked GPS, missing photo, non-camera source, FLAG-mode + manager notification, TIME_DRIFT, full check-out flow, RBAC matrix, photo streaming ownership, signed-URL mint/use/tamper-reject, audit trail.

## Phase 4 — Leave APIs ✅
- Apply (multipart + optional pdf/jpg/png document ≤ 5 MB), validation: overlap, past-date policy (`minNoticeDays`), `maxConsecutiveDays`, half-day rules, document-required types; balance reservation model (`available = allocated − used − pending`), approval deducts `used` (excluding the request's own reservation), reject/cancel release it; rejection comment mandatory (zod + service); manager scope = engineers on managed sites (HR/Admin company-wide); self-decision blocked; notifications on submit/approve/reject/cancel to engineer + managers; leave type admin CRUD; HR/Admin balance adjustment (audited); document streaming + signed URLs.
- Approved leave overlays attendance summary as `ON_LEAVE` (never absent).
- **Verified:** Jest **14 new leave tests pass** — apply + reservation, overlap 409, insufficient balance 422, approve deducts + notifies + double-decision 409, reject requires comment + releases, cancel releases + `LEAVE_CANCELLED` notification, half-day 0.5/blocked multi-date, past-date 422, document-required 422/201 + document access matrix + signed URL, manager scope + outsider 403, leave history filters, ON_LEAVE in summary. Total suite **39/39 green** (incl. one fix: approval check now excludes its own pending reservation).

## Phase 5 — Reports & exports ✅
- `lib/csv.ts` (RFC-4180 escaper, BOM for Excel), `lib/pdf.ts` (pure-pdfkit A4 tables with pagination + repeated headers), `report.service.ts` (attendance monthly / leave / payroll summaries; manager scope, HR/Admin company-wide; site filter).
- Routes: `GET /api/reports/{attendance,leave,payroll}?format=json|csv|pdf` with `Content-Disposition` filenames; every export writes a `REPORT_EXPORT` audit row.
- Also completed the remaining API surface needed by the apps: `users` (HR/Admin CRUD + manager-scoped engineer list), `sites` (admin CRUD + assignment management), `notifications` (list/read/read-all/push-token).
- **Verified:** `npx tsc --noEmit` clean; Jest **7 new report tests pass** — JSON counts (present + on-leave), CSV BOM + headers + filename, **real PDF bytes (`%PDF-` magic verified)**, leave report contents, payroll columns, RBAC/scope (engineer 403, empty scope for site-less managers, manager denied payroll), export auditing. Full suite **46/46 green** across 4 spec files.

## Phase 8 — Docker, docs, E2E script ✅ (backend side)
- `backend/Dockerfile` (Postgres provider flipped at build time, `scripts/docker-start.js` = schema push → seed-if-empty → start with signal forwarding), `docker-compose.yml` (Postgres 16 + API, healthcheck-gated startup, named volumes for DB + photo storage, `BACKEND_PORT`/`DB_PORT` overrides).
- **Verified live:** image built, stack started; container logs show `db push`, first-run seed (57 records) and on restart **"database already has 9 users — skipping seed"** proving persistence; reachable on host port 4005.
- `scripts/e2e-smoke.sh`: a 21-check end-to-end journey (admin creates engineer → assign site → multipart check-in → duplicate + mocked blocks → check-out → history/summary → leave apply → manager approve → balance 12→11 → HR CSV + PDF → signed-URL photo stream → deactivate). **PASSED 21/21 against BOTH the Docker/Postgres stack (4005) and the SQLite dev server (4000), exit 0.**
- Two real bugs found *by running it* and fixed: JSON helper missing `JSON.parse`; login rate limit made env-tunable (`LOGIN_RATE_LIMIT_MAX`, default 20, compose demo 1000).
- `README.md` (10-minute quickstarts for both run modes, accounts, env table, curl examples, troubleshooting) and `TESTING.md` (4-level E2E checklist: suite → live smoke → Docker → manual app/dashboard flows).
- Final backend quality gates: `eslint` **0 problems** · `tsc --noEmit` clean · `jest` **46/46 green**.

## Phase 6 — Mobile app (Expo + TypeScript) ✅ — independently re-verified
- Built by a delegated subagent against the frozen API contract; **re-verified on this machine**: `npx tsc --noEmit` **clean** (TS 6.0), `npx expo export --platform android` re-run → **"Exported: dist"** (980 modules, 2.4 MB hbc), `npx expo start` boots the bundler (HTTP 200), **zero TODO/FIXME/placeholder strings** in `mobile/src`.
- 24 source files: login (SecureStore tokens + generated deviceId), Home (today status), **Capture screen** — front camera → GPS services-off / permission-denied states with settings links → review phase with client-side distance + accuracy/mock warnings → multipart submit (`captureSource=camera`, `mocked`, `clientTimestamp`, `siteId`) → success panel with **server** distance/flags; history (filters, pagination, signed-URL photo thumbnails + viewer); monthly summary; leave (balances, apply with document picker + half-day/dispatch rules surfaced, requests + cancel-PENDING); notifications (list, badge, best-effort push token registration); profile/logout. Single-flight 401-refresh interceptor.
- Live API shape-sanity against the seeded backend (GETs only — no fabricated records).
- Honest limit: on-device camera/GPS flow needs a phone/emulator — click-through steps in `TESTING.md` §4; everything else verified headlessly.

## Phase 7 — Web dashboard (React + Vite + Tailwind) ✅ — independently re-verified
- Built by a delegated subagent; **re-verified on this machine**: `npm run build` (tsc -b + vite) **exit 0**, `npm run preview` served **HTTP 200** HTML, **zero TODO/FIXME/placeholder strings** in `web/src`; subagent additionally ran a real-Chromium pass (0 console errors) over the production build.
- 11 pages / 7 components: Manager team board (Leaflet map + geofence circles + record modal with signed-URL photos, coords, distance, hash, drift, device), leave queue (approve / reject-with-comment), reports + payroll (JSON tables + **CSV/PDF downloads**), Employees / Sites (map picker + radius + REJECT/FLAG) / Assignments / Leave Types / Balances admin, notifications bell, role-filtered navigation, engineeers redirected to a "use the mobile app" notice.
- Live API smoke against the seeded backend confirmed shapes + **manager site-scoping** end-to-end.

## Definition of done — status
- ✅ `docker compose up --build` starts Postgres + API; schema pushed; seeds when empty; **verified live** (21/21 smoke on the compose stack, restart keeps data).
- ✅ All backend tests pass — **46/46** (4 suites); ESLint 0 problems; TS clean.
- ✅ Mobile app builds (`tsc`, `expo export`); `npx expo start` boots; API flows shape-verified (device click-through steps documented).
- ✅ Web dashboard builds, serves, and was driven over the real seeded API (including a browser pass) — shows real data.
- ✅ README lets a stranger run everything in ~10 minutes; no TODO placeholders anywhere in app code; no fake data in production paths (seed data is explicitly a seed).
- 🔎 Notable during verification: subagent-reported findings were independently re-checked, not taken on trust; the mobile agent's catch of the `balances/me` naming was folded back into `ARCHITECTURE.md`.

## Google Sign-In (web + mobile) — backend ✅ verified; web integration after UI rebuild
- `POST /api/auth/google` (`src/routes/auth.routes.ts` + `auth.service.loginWithGoogle` + `lib/google.ts`): Google ID token verified server-side via `google-auth-library` (signature/JWKS, issuer, expiry, audience allowlist `GOOGLE_CLIENT_IDS`), `email_verified` required, then mapped to an existing **active** RELAY user → normal access+refresh pair; audited as `AUTH_LOGIN_GOOGLE`; disabled with `503 GOOGLE_DISABLED` when unconfigured. No self-registration (DECISIONS.md #19).
- **Verified:** `tsc` clean; Jest **7 new Google tests pass** (active-user mapping incl. using the issued access token, unlinked-email 403, unverified 401, deactivated 403, verifier failure 401, validation 400, real-module disabled-state 503) → suite **53/53**.
- Mobile app: `expo-auth-session` Google flow (`src/lib/googleAuth.ts`), "Continue with Google" on the login screen (only when a client id is configured), session applied through the shared `applySession` path; `app.json` scheme + `expo-web-browser` plugin. **Verified:** `tsc` clean, `expo export --platform android` exported (2.5 MB hbc).
- Env/docs: `GOOGLE_CLIENT_IDS` (backend), `EXPO_PUBLIC_GOOGLE_*` (mobile), README "Sign in with Google" console walkthrough. Real Google verification runs once a client ID exists; until then the endpoint correctly reports disabled.

## Dashboard: shadcn/ui rebuild — complete & live-verified
- All 16 screens/components rebuilt on shadcn/ui (new-york/radix, neutral, Geist); old kit removed. `npm run build` clean, `npm run lint` 0 errors.
- Live browser pass (admin + real seeded data) across Team board, Leave queue (approve/reject flows), Reports, Sites, Employees, Leave types, Balances, Payroll, notice/404 — in **both themes**; then DOM ground truth for map chrome (attribution/zoom `oklch(0.205 0 0)`, geofence path present, theme class applied).
- Polish fixes from the pass: palette-themed page scrollbar; **dark-mode maps = keyless inverted-OSM tiles** (CARTO dark basemap now needs an API key → watermark tiles; reverted) for both Team map + geofence picker; site pins switched to CSS `divIcon`s (stock Leaflet PNG markers render broken under the bundler; `leaflet-setup.ts` deleted as dead code); Leaflet zoom/attribution chrome themed; geofence stroke weight 2; sidebar micro-text 11px → 12px.
- **Google Sign-In (web)**: GIS button on the login card (`GoogleSignInButton.tsx`, no page reload, theme-aware), `loginWithGoogle` in `AuthContext`, visible only when `VITE_GOOGLE_CLIENT_ID` is set; `web/.env.example` added.
- Impeccable detector on the rebuilt source: `npx impeccable detect web/src` → **0 findings** (exit 0).
- Note: dev DB contains a test employee "Chaitanya Chavan (EMP - 005)" created during dashboard testing — deactivate via Employees page if unwanted.

## Google OAuth client configured (live)
- User created the OAuth client in Google Cloud Console ("Relay Attendance" project); client ID wired into `backend/.env` (`GOOGLE_CLIENT_IDS`), `web/.env.local` (`VITE_GOOGLE_CLIENT_ID`), `mobile/.env` (`EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`); client secret not used by this integration (ID-token flow).
- All three services restarted. **Verified:** `POST /api/auth/google` now returns `401 GOOGLE_TOKEN_INVALID` for a garbage token (verifier active — no longer `503 GOOGLE_DISABLED`); client ID inlined in the served Android bundle (Metro) and in the Vite-served `GoogleSignInButton` module. Button visibility on page validated by config presence (visual screenshot skipped — user's Chrome profile locked the headless capture).
- Remaining (user-side): add Google accounts as **test users** on the consent screen; click "Sign in with Google" on :5173 / in Expo Go to complete the live sign-in.

## Fix: Google client ID transcription corrected
- The first wiring used a client ID misread from the Console screenshot (`...b1ucug...qjo...`); Google rejected it with `Error 401: invalid_client — The OAuth client was not found`.
- Ground truth via Google's own authorize endpoint (it distinguishes existence): corrected string (`...blucug...qio...`) → `400 redirect_uri_mismatch` (client EXISTS, probe redirect unregistered); the old string → `invalid_client`. Corrected in all three env files; all services restarted; **verified:** corrected ID served by Vite and inlined in the Metro bundle, old string absent everywhere.
- Also relinked the `Chaitanya Chavan` employee to the user's Google account (`chaitanyachavan695@gmail.com`, employeeId normalized to `EMP-0005`) directly in the dev DB. Note: the users API intentionally does not allow email changes (login identity), so the dashboard can't do this edit — acceptable for dev; revisit if email re-linking becomes a real admin need.

## Fix: Expo Go (Android) startup crash — expo-notifications remote-push removal
- Symptom on a real phone in Expo Go: redbox `[runtime not ready]: expo-notifications: Android Push notifications ... was removed from Expo Go with the release of SDK 53` at startup, traced via the served bundle to expo-notifications' own auto-registration side-effect module calling `addPushTokenListener` during bundle evaluation (our eager import chain: `App.tsx` → `expo-notifications` → fx module → throw).
- Fix: never load expo-notifications eagerly. New `src/lib/expoNotifications.ts` lazily dynamic-imports it and returns `null` on Android Expo Go (detected via `Constants.executionEnvironment` + legacy `appOwnership`); `App.tsx`, `store/NotificationsContext.tsx` and `lib/push.ts` converted to use it. Local notifications on iOS Expo Go and full push in native builds unchanged; in-app notification list (API-driven) unaffected.
- **Verified:** zero static imports of expo-notifications remain; `tsc --noEmit` clean; Metro bundle compiles (http 200). On-device confirmation = user taps RELOAD in Expo Go.

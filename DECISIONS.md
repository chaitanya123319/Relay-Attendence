# Decisions log

Decisions made autonomously while building RELAY Attendance. Each entry: what, why, consequence.

1. **SQLite for local dev + tests; PostgreSQL for the Docker/deployment path** (allowed by the spec: "use SQLite for local dev if Postgres is unavailable, and note it"). This machine has no local Postgres server; SQLite gives a zero-install `npm run dev` and fast, hermetic Jest runs. Prisma's `provider` cannot be templated at runtime, so the repo ships one canonical `schema.prisma` (sqlite) plus `backend/scripts/use-provider.js` which flips the datasource line to `postgresql`; the backend Docker image bakes the Postgres-flavored client and `docker compose up` runs Postgres 16 + the API, applying the schema with `prisma db push` and seeding. Committed `prisma/migrations/` are SQLite-dialect; regenerating Postgres migrations in a disposable dev environment is the standard production workflow (noted in README). All column types are portable (String/Float/Int/Boolean/DateTime) so both engines accept the same schema.

2. **SQLite has no Prisma enums** → roles and statuses are `String` columns with TypeScript union types and zod enums at the API boundary. Same semantics, portable to Postgres later.

3. **`bcryptjs` instead of native `bcrypt`.** Same algorithm and hash format (`$2a$`), pure JS = no node-gyp/MSVC build issues on Windows and inside Alpine Docker images. Swappable in one line (`lib/passwords.ts`).

4. **Server-authoritative time, company timezone `COMPANY_TZ` (default Asia/Kolkata).** Business dates (`date` key `YYYY-MM-DD`) are derived from the server clock in TZ; client timestamps are only used for drift detection/flagging. Prevents client-clock tampering (a core anti-fraud requirement).

5. **Dates as `YYYY-MM-DD` strings for business dates, `DateTime` for event timestamps.** Avoids SQLite tz-storage ambiguity and makes range filters trivial and index-friendly.

6. **Photo/document storage behind a `StorageService` interface** (`save/read/exists/remove`). Ships with `LocalDiskStorage` (root = `STORAGE_DIR`); swapping S3 means implementing the interface and changing one factory line — no route/service changes.

7. **Leave balance availability model**: `available = allocated − used(approved) − pending`. Submitting reserves without deducting; **approve deducts**, reject/cancel release the reservation. This satisfies "approval deducts balance, rejection/cancel restores it" while keeping `used` = actually-consumed days (correct for payroll), and makes "insufficient balance" checks account for pending requests (no double-booking).

8. **Absent-day computation**: a date up to *today* with no attendance and no approved leave is `ABSENT`, counting Mon–Sat (Sunday = weekly off, mirroring typical Indian construction schedules; constant `WEEKLY_OFF_DAYS=[0]` centralized in `lib/time.ts`). Future dates are never marked absent. Approved leave always outranks absent.

9. **JWT: short access (15 min) + rotating refresh (7 d)** stored hashed in `RefreshToken`; presenting a revoked refresh token revokes the token chain and writes an audit entry. Chosen over session cookies because the mobile client is token-first; storage is SecureStore on device.

10. **Signed URLs for photos**: `POST /uploads/signed-url` returns an HMAC-SHA256-signed, expiring URL. Both auth-header streaming and signed URLs are supported; reporting/dashboard thumbnails use signed URLs. Photos are never publicly listed; the storage dir is not statically served.

11. **Reports without heavyweight deps**: CSV built with a small RFC-4180 escaper; PDF via `pdfkit` (text tables). No spreadsheet template coupling; payroll summary is intentionally column-stable and documented in README.

12. **Expo push**: server stores Expo push tokens and best-effort sends via `https://exp.host/--/api/v2/push/send` (fire-and-forget, logged, never blocks the API response). In-app notification rows are always written first — the app's notification list is the source of truth; push is a transport.

13. **Manager scope** = sites the manager is actively assigned to (`SiteAssignment` is role-agnostic; managers get site rows to manage, engineers get the site they work at). HR/Admin see company-wide. Enforced in services, not just routes.

14. **Mobile app verified by `tsc --noEmit` + `expo export` bundle** (no device/emulator in this environment); UI flows coded against the documented API contract and manually runnable with `npx expo start`. Handled states: permission denial (camera/location), GPS off, no network, expired session (auto-refresh + logout).
15. **Dashboard verified by production `vite build` + live smoke against the seeded backend.** Map tiles (OpenStreetMap) need internet; a "manual lat/lng" fallback input exists for offline/air-gapped set-up.
16. **Seed data** simulates two weeks of realistic activity (late arrivals, a missing check-out, an OUT_OF_RANGE flag day, approved + pending leaves) so every screen and report renders meaningful content on first run. Photos in seeds are generated 1×1 PNG placeholders written through the same `StorageService` as real uploads (a real byte flow, not a mock).
17. **Rate limiting**: global 300 req/min/IP; login 10 attempts / 15 min per IP. `trust proxy` disabled by default (single-process dev); documented for reverse-proxy deployments.
18. **Tests run `--runInBand` on a file-isolated test DB** (`prisma/test.db`) re-created by Jest `globalSetup` via `prisma migrate deploy`, so migrations themselves are exercised by the suite.

19. **Google Sign-In = linked identity, not registration.** `POST /api/auth/google` verifies the Google ID token server-side with `google-auth-library` (signature against Google's JWKS, issuer/audience/expiry, `email_verified` required) against an allowlist of OAuth client IDs (`GOOGLE_CLIENT_IDS`), then maps the verified email to an existing **active** RELAY user and issues the standard session pair. No self-registration — attendance/leave data must stay tied to provisioned employees. Endpoint returns `503 GOOGLE_DISABLED` until client IDs are configured; successful sign-ins audit as `AUTH_LOGIN_GOOGLE`.

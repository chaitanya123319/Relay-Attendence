# RELAY Attendance — Web Dashboard

Role-based web dashboard for the RELAY geo-tagged attendance system: a live team
attendance board with map + photo proof, the leave approval queue, and the full
HR/Admin back office (employees, sites, leave types, balances, reports, payroll).

Built with **Vite + React + TypeScript + Tailwind CSS v4**, `react-leaflet`
(OpenStreetMap tiles), `recharts` and `lucide-react`.

## Setup

From `relay-attendance/web/`:

```bash
npm install
```

The dashboard talks to the API at `http://localhost:4000/api` by default.
Override at build/dev time with `VITE_API_URL` if the backend lives elsewhere:

```bash
VITE_API_URL=http://localhost:4000/api npm run dev
```

## Run

```bash
npm run dev        # dev server (HMR) on http://localhost:5173
npm run build      # type-check (tsc -b) + production build → dist/
npm run preview    # serve the production build (e.g. -- --port 4173)
npm run lint       # oxlint
```

The backend must be running with seeded data (`backend/` — see its README).

## Accounts (seeded demo data — password `Relay@123` for all)

| Role     | Email                  | Lands on            | Sees |
|----------|------------------------|---------------------|------|
| ADMIN    | admin@relay.local      | Team today          | Everything (all sites/users, payroll, site & leave-type config) |
| HR       | hr@relay.local         | Team today          | All sites/users, leave config + balances + payroll, site/leave-type **view** (admin-only config) |
| MANAGER  | manager1@relay.local   | Team today          | Only their assigned sites: team board, leave queue, scoped reports |
| ENGINEER | engineer1@relay.local  | Mobile-app notice   | A friendly "use the RELAY mobile app" page — engineers are mobile-only |

## What the dashboard does

**Shared**
- Login (email **or** employee ID), JWT access + refresh tokens in
  `localStorage`; axios interceptors attach the bearer token, refresh once on
  `401` and log out to `/login` when the session dies.
- Role-aware sidebar + route guards; every page has loading / empty / error states.
- Notifications bell (polls `GET /notifications/me` every 60 s, mark-one / mark-all read).

**Manager + HR + Admin**
- **Team today** — date picker + site filter, status summary chips, roster table
  (check-in/out times, geofence distance, worked minutes, flags) and an
  OpenStreetMap panel with site geofence circles + color-coded check-in markers.
- **Photo viewer modal** — click any record: check-in/out photos via the signed-URL
  flow (`POST /uploads/signed-url` → expiring HMAC URL → `<img>`), coordinates,
  GPS accuracy, site distance, worked minutes, client clock drift, device ID and
  the SHA-256 photo hash.
- **Leave queue** — PENDING cards (employee, type, dates, days, reason, signed
  document links) with Approve (optional comment) and Reject (mandatory comment,
  min 3 chars) modals; history tabs for decided requests.
- **Reports** — attendance (month + site) and leave (range) tables rendered from
  the JSON report endpoints, with authed-blob **CSV** and **PDF** downloads, plus
  a Present-vs-Late bar chart.

**HR + Admin back office**
- **Employees** — searchable/filterable table, create user (name, email, employee
  ID, password ≥ 8, role, phone), edit (name/phone/role/active, password reset),
  and (Admin) per-row assign-to-site.
- **Sites** — cards with geofence/shift config; Admin create/edit form with a
  click-to-pick + draggable-marker Leaflet map, radius slider, REJECT/FLAG
  policy, shift times, grace and half-day thresholds — always backed by manual
  lat/lng number inputs. Assignment panel lists members with add/remove.
- **Leave types** — list + (Admin) create/edit incl. quota, paid, document
  requirement, notice, max consecutive days, half-day rule and active toggle.
- **Balances** — per-employee/year table (allocated / used / pending / available)
  with an audited adjust-allocation modal.
- **Payroll** — month picker, payroll-ready table from `/reports/payroll` (HR/Admin
  only), Days-worked chart, CSV/PDF downloads.

## Verification (what was run)

- `npm run build` — passes (tsc project build + vite production build).
- `npm run preview -- --port 4173` — serves the built dashboard; `curl -s http://localhost:4173/`
  returned HTTP 200 with the built `index.html`.
- **Live API smoke** against the seeded backend (`http://localhost:4000`) with the
  admin token — every response consumed by the UI was shape-checked against
  `src/lib/types.ts`:
  - `POST /auth/login` → tokens + user (role ADMIN); `POST /auth/refresh` → rotated pair.
  - `GET /attendance/team` → `{date, items:[{user, site, record|null, leaveType, status}]}`
    with `record.checkIn{time,lat,lng,accuracy,distanceMeters,photoEndpoint,photoHash}`.
  - `GET /attendance/:id` record detail (`user`, `site`, both photo sides, `workedMinutes`, `clientDriftSeconds`, `deviceId`).
  - `POST /uploads/signed-url` → `{url, expiresAt}`; signed URL fetched the photo (HTTP 200, `image/png`).
  - `GET /users` (+sites[]), `GET /sites` (+assignments), `GET /leave/requests?status=PENDING`,
    `GET /leave/balances?userId&year`, `GET /leave/types`, `GET /reports/attendance?format=json`,
    `GET /reports/payroll?format=json`, `GET /notifications/me`.
  - `GET /reports/attendance?format=csv` → UTF-8 BOM, header + rows, `Content-Disposition: attachment`.
  - Manager scoping confirmed live: `manager1@relay.local` sees only engineers of
    their two sites in team/users/queue/reports.
- **Browser pass** over the production build: admin walks all 8 pages (table,
  charts, modals, Leaflet map with tiles/marker/geofence circle), manager sees
  3-item nav + notification dropdown, engineer is routed to the mobile-app page;
  no console errors.

## Notes

- OSM tiles need internet access at runtime; the map degrades gracefully without it
  (the site form keeps working via the manual lat/lng inputs).
- All authorization/scoping is server-side; the UI mirrors it (e.g. HR sees
  site/leave-type config read-only because the API only lets ADMIN mutate it).

# RELAY Attendance — Product

> Durable product truth for the Impeccable skill. Surface-level visual direction lives in `DESIGN.md`.

## What this is

Geo-tagged attendance & leave management for construction site engineers.
Engineers prove physical presence with a **live camera photo + GPS** from the mobile app; managers, HR and admins run the company from the **web dashboard**. The system is a full-stack repo (`backend/` API, `mobile/` Expo app, `web/` dashboard) — see `README.md` for architecture, accounts and run instructions.

## Surfaces

- **Web dashboard (this surface, Operate mode)** — Manager / HR / Admin daily operator tool. Used in offices on desktop/laptop screens, often side-by-side with other tools: scanability, density and task completion outrank expression. Rebuilt on shadcn/ui (2026-10); light + dark.
- **Mobile app (engineers)** — in-field check-in/out, history, leave. Redesign deferred; do not touch from web work.

## Users & jobs

- **Project Manager** — see today's team at a glance (who is on site, flags, photos, distances), approve/reject leave, export reports for their sites.
- **HR** — employee records, leave types & balances, company-wide reports, payroll-ready summaries with CSV/PDF export.
- **Admin** — everything above plus users, project sites (geofence config with map picker), site assignments, leave policy.
- **Engineer (on web)** — redirected to a short notice: the product surface for them is the mobile app.

## Operating context & constraints

- All data is real, from the backend API (`web/src/lib/api.ts`); RBAC is enforced server-side and the UI mirrors it (managers are scoped to their sites). No mock data in production paths.
- Server timestamps are authoritative; business dates follow the company timezone (default Asia/Kolkata).
- Photo/document viewing goes through signed URLs (authenticated + expiring).
- Maps are OpenStreetMap tiles (need internet); everything else must work offline-tolerant per normal SPA behaviour.
- Node 22+, Vite + React + TS + Tailwind v4 in `web/`.

## Voice

Plain, operational, attributable. Controls name their action ("Approve leave", "Download CSV"). Errors name the problem and the recovery ("Cannot reach the API at … — is the backend running?"). No greetings, no exclamation marks, no marketing tone. Numbers and units are precise (m/km, h m).

## Non-goals (current pass)

No feature changes, no new pages, no backend changes. Mobile app redesign deferred. Flows stay identical; layout density and UX copy may be tightened where it clearly helps.

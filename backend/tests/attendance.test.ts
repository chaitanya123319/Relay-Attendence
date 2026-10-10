/**
 * Phase 3 acceptance tests — geofence + anti-fraud + photo upload.
 * Covers: inside-radius, outside-radius REJECT, duplicate check-in,
 * check-out without check-in, low accuracy, mocked location, missing photo,
 * non-camera source, FLAG-mode OUT_OF_RANGE, TIME_DRIFT, check-out flow,
 * summary, history, RBAC and photo streaming + signed URLs.
 */
import request from 'supertest';
import { sha256Hex } from '../src/lib/crypto';
import { prisma } from '../src/lib/prisma';
import { todayStr } from '../src/lib/time';
import { app, bearer, loginAs, PASSWORD, PNG_1x1, resetDb, seedBasic } from './helpers';
import { hashPassword } from '../src/lib/passwords';

let engToken: string;
let mgrToken: string;
let adminToken: string;
let engineerId: string;
let managerId: string;
let siteIn: { id: string; lat: number; lng: number; radiusM: number; name: string };
let siteFlag: { id: string; lat: number; lng: number; radiusM: number; name: string };

beforeEach(async () => {
  await resetDb();
  const seed = await seedBasic();
  engineerId = seed.engineer.id;
  managerId = seed.manager.id;
  siteIn = seed.siteIn;
  siteFlag = seed.siteFlag;
  engToken = (await loginAs('engineer@test.local')).accessToken;
  mgrToken = (await loginAs('manager@test.local')).accessToken;
  adminToken = (await loginAs('admin@test.local')).accessToken;
});

function baseFields(
  site: { lat: number; lng: number },
  over: Record<string, string> = {},
): Record<string, string> {
  return {
    lat: String(site.lat + 0.0002),
    lng: String(site.lng + 0.0001),
    accuracy: '10',
    clientTimestamp: new Date().toISOString(),
    deviceId: 'jest-device-01',
    mocked: 'false',
    captureSource: 'camera',
    ...over,
  };
}

function post(fields: Record<string, string>, token = engToken, withPhoto = true, path = '/api/attendance/check-in') {
  let req = request(app).post(path).set(bearer(token));
  for (const [k, v] of Object.entries(fields)) req = req.field(k, v);
  if (withPhoto) req = req.attach('photo', PNG_1x1, { filename: 'capture.png', contentType: 'image/png' });
  return req;
}

const checkIn = (fields: Record<string, string>, token = engToken) =>
  post(fields, token, true, '/api/attendance/check-in');
const checkOut = (fields: Record<string, string>, token = engToken) =>
  post(fields, token, true, '/api/attendance/check-out');

describe('Attendance — check-in', () => {
  test('check-in inside radius is recorded with photo hash and server timestamp', async () => {
    const res = await checkIn(baseFields(siteIn));
    expect(res.status).toBe(201);
    const rec = res.body.record;
    expect(rec.site.id).toBe(siteIn.id);
    expect(rec.flags).toEqual([]);
    expect(rec.checkIn.photoHash).toBe(sha256Hex(PNG_1x1));
    expect(rec.checkIn.distanceMeters).toBeLessThan(siteIn.radiusM);
    expect(['PRESENT', 'LATE']).toContain(rec.status);
    // Server-authoritative timestamp: within 15s of "now", regardless of client clock.
    expect(Math.abs(Date.now() - Date.parse(rec.checkIn.time))).toBeLessThan(15000);

    const stored = await prisma.attendanceRecord.findUniqueOrThrow({
      where: { userId_date: { userId: engineerId, date: todayStr() } },
    });
    expect(stored.checkInPhotoHash).toBe(sha256Hex(PNG_1x1));
    expect(stored.deviceId).toBe('jest-device-01');
  });

  test('check-in outside radius on a REJECT site returns 422 with the distance', async () => {
    const res = await checkIn(baseFields(siteIn, { lat: String(siteIn.lat + 0.01) }));
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('GEO_OUT_OF_RANGE');
    expect(res.body.error.details.distanceMeters).toBeGreaterThan(siteIn.radiusM);
    expect(res.body.error.message).toMatch(/from/);
    const count = await prisma.attendanceRecord.count();
    expect(count).toBe(0); // nothing recorded on reject
  });

  test('duplicate check-in on the same day is blocked', async () => {
    const first = await checkIn(baseFields(siteIn));
    expect(first.status).toBe(201);
    const second = await checkIn(baseFields(siteIn));
    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe('ALREADY_CHECKED_IN');
  });

  test('low GPS accuracy (> 50 m) is rejected', async () => {
    const res = await checkIn(baseFields(siteIn, { accuracy: '80' }));
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('LOW_GPS_ACCURACY');
  });

  test('mocked/spoofed location is rejected', async () => {
    const res = await checkIn(baseFields(siteIn, { mocked: 'true' }));
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('MOCKED_LOCATION');
  });

  test('a photo is mandatory', async () => {
    const res = await post(baseFields(siteIn), engToken, false);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('PHOTO_REQUIRED');
  });

  test('non-camera capture source is rejected (no gallery uploads)', async () => {
    const res = await checkIn(baseFields(siteIn, { captureSource: 'gallery' }));
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('PHOTO_SOURCE_INVALID');
  });

  test('large client/server clock drift flags TIME_DRIFT but still records', async () => {
    const skewed = new Date(Date.now() - 3600_000).toISOString();
    const res = await checkIn(baseFields(siteIn, { clientTimestamp: skewed }));
    expect(res.status).toBe(201);
    expect(res.body.record.flags).toContain('TIME_DRIFT');
  });

  test('FLAG-mode site records OUT_OF_RANGE and notifies managers', async () => {
    await prisma.siteAssignment.create({ data: { userId: engineerId, siteId: siteFlag.id } });
    const res = await checkIn(
      baseFields(siteFlag, { siteId: siteFlag.id, lat: String(siteFlag.lat + 0.005) }),
    );
    expect(res.status).toBe(201);
    expect(res.body.record.flags).toContain('OUT_OF_RANGE');
    expect(res.body.record.checkIn.distanceMeters).toBeGreaterThan(siteFlag.radiusM);

    const notes = await prisma.notification.findMany({ where: { userId: managerId } });
    expect(notes.length).toBeGreaterThan(0);
    expect(notes[0].type).toBe('ATTENDANCE_FLAGGED');
  });
});

describe('Attendance — check-out', () => {
  test('check-out without check-in is blocked', async () => {
    const res = await checkOut(baseFields(siteIn));
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CHECK_IN_REQUIRED');
  });

  test('check-out after check-in records worked minutes and photo', async () => {
    await checkIn(baseFields(siteIn));
    const res = await checkOut(baseFields(siteIn));
    expect(res.status).toBe(200);
    const rec = res.body.record;
    expect(rec.checkOut).not.toBeNull();
    expect(rec.checkOut.photoHash).toBe(sha256Hex(PNG_1x1));
    expect(typeof rec.workedMinutes).toBe('number');
    expect(rec.workedMinutes).toBeGreaterThanOrEqual(0);
    // Seconds after check-in → below the half-day threshold.
    expect(rec.status).toBe('HALF_DAY');

    const again = await checkOut(baseFields(siteIn));
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe('ALREADY_CHECKED_OUT');
  });
});

describe('Attendance — reads & RBAC', () => {
  test('history and monthly summary reflect a check-in', async () => {
    await checkIn(baseFields(siteIn));

    const history = await request(app).get('/api/attendance/me').set(bearer(engToken));
    expect(history.status).toBe(200);
    expect(history.body.total).toBe(1);
    expect(history.body.items[0].date).toBe(todayStr());

    const empty = await request(app)
      .get('/api/attendance/me?from=2099-01-01')
      .set(bearer(engToken));
    expect(empty.body.total).toBe(0);

    const month = todayStr().slice(0, 7);
    const summary = await request(app)
      .get(`/api/attendance/me/summary?month=${month}`)
      .set(bearer(engToken));
    expect(summary.status).toBe(200);
    const todayRow = summary.body.days.find((d: { date: string }) => d.date === todayStr());
    expect(['PRESENT', 'LATE']).toContain(todayRow.status);
    expect(summary.body.summary.present + summary.body.summary.late).toBeGreaterThanOrEqual(1);
  });

  test('managers see the team board for their sites only', async () => {
    await checkIn(baseFields(siteIn));
    const res = await request(app).get('/api/attendance/team').set(bearer(mgrToken));
    expect(res.status).toBe(200);
    expect(res.body.items.length).toBe(1);
    expect(res.body.items[0].user.id).toBe(engineerId);
    expect(res.body.items[0].record.checkIn).toBeTruthy();

    // Second manager manages nothing → empty board
    const pw = await hashPassword(PASSWORD);
    const other = await prisma.user.create({
      data: { email: 'mgr2@test.local', employeeId: 'T-0009', name: 'No Sites', role: 'MANAGER', passwordHash: pw },
    });
    const otherToken = (await loginAs(other.email)).accessToken;
    const empty = await request(app).get('/api/attendance/team').set(bearer(otherToken));
    expect(empty.body.items).toEqual([]);
  });

  test('RBAC: engineers cannot check-in as managers, managers cannot use engineer endpoints', async () => {
    const asMgr = await checkIn(baseFields(siteIn), mgrToken);
    expect(asMgr.status).toBe(403);

    const asEng = await request(app).get('/api/attendance/team').set(bearer(engToken));
    expect(asEng.status).toBe(403);

    const anon = await request(app).post('/api/attendance/check-in');
    expect(anon.status).toBe(401);
  });

  test('photo streaming respects ownership; signed URLs work without auth header', async () => {
    const created = await checkIn(baseFields(siteIn));
    const recordId = created.body.record.id;

    // Owner can stream
    const mine = await request(app)
      .get(`/api/attendance/${recordId}/photo/in`)
      .set(bearer(engToken));
    expect(mine.status).toBe(200);
    expect(mine.headers['content-type']).toContain('image/png');

    // Admin can stream (role-based access)
    const asAdmin = await request(app)
      .get(`/api/attendance/${recordId}/photo/in`)
      .set(bearer(adminToken));
    expect(asAdmin.status).toBe(200);

    // Unrelated engineer cannot
    const pw = await hashPassword(PASSWORD);
    await prisma.user.create({
      data: { email: 'other.eng@test.local', employeeId: 'T-0008', name: 'Other Eng', role: 'ENGINEER', passwordHash: pw },
    });
    const otherToken = (await loginAs('other.eng@test.local')).accessToken;
    const forbiddenRes = await request(app)
      .get(`/api/attendance/${recordId}/photo/in`)
      .set(bearer(otherToken));
    expect(forbiddenRes.status).toBe(403);

    // Check-out photo doesn't exist yet
    const noOut = await request(app)
      .get(`/api/attendance/${recordId}/photo/out`)
      .set(bearer(engToken));
    expect(noOut.status).toBe(404);

    // Signed URL: mint, use without auth, tampered signature rejected
    const signed = await request(app)
      .post('/api/uploads/signed-url')
      .set(bearer(engToken))
      .send({ path: `/api/attendance/${recordId}/photo/in` });
    expect(signed.status).toBe(200);
    const url = signed.body.url;

    const viaSigned = await request(app).get(url.replace(/^https?:\/\/[^/]+/, ''));
    expect(viaSigned.status).toBe(200);
    expect(viaSigned.headers['content-type']).toContain('image/png');

    const tampered = await request(app).get(
      url.replace(/^https?:\/\/[^/]+/, '').replace(/s=[0-9a-f]+/, 's=deadbeef'),
    );
    expect(tampered.status).toBe(403);
  });

  test('audit trail captures check-in and check-out', async () => {
    await checkIn(baseFields(siteIn));
    await checkOut(baseFields(siteIn));
    const actions = await prisma.auditLog.findMany({ select: { action: true } });
    const set = actions.map((a) => a.action);
    expect(set).toContain('ATTENDANCE_CHECK_IN');
    expect(set).toContain('ATTENDANCE_CHECK_OUT');
  });
});

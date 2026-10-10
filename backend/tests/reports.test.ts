/**
 * Phase 5 acceptance tests — reports & exports.
 * Verifies JSON payloads, CSV (BOM + escaping), real PDF bytes (%PDF magic),
 * manager scoping, RBAC and export auditing.
 */
import request from 'supertest';
import { hashPassword } from '../src/lib/passwords';
import { prisma } from '../src/lib/prisma';
import { addDays, todayStr } from '../src/lib/time';
import { app, bearer, loginAs, PASSWORD, resetDb, seedBasic } from './helpers';

let engineerId: string;
let siteInId: string;
let managerId: string;
let hrToken: string;
let adminToken: string;
let mgrToken: string;
let engToken: string;
let mgrNoSitesToken: string;
let leaveDate: string;

const month = todayStr().slice(0, 7);

/** Binary parser so PDF responses arrive as a Buffer (for the %PDF magic check). */
const binaryParser = (
  res2: NodeJS.ReadableStream,
  cb: (err: Error | null, body: Buffer) => void,
) => {
  const chunks: Buffer[] = [];
  res2.on('data', (c: Buffer) => chunks.push(c));
  res2.on('end', () => cb(null, Buffer.concat(chunks)));
};

beforeEach(async () => {
  await resetDb();
  const seed = await seedBasic();
  engineerId = seed.engineer.id;
  siteInId = seed.siteIn.id;
  managerId = seed.manager.id;

  // One full worked day today for the engineer.
  const now = new Date();
  await prisma.attendanceRecord.create({
    data: {
      userId: engineerId,
      siteId: siteInId,
      date: todayStr(),
      checkInTime: new Date(now.getTime() - 8 * 3600_000),
      checkOutTime: now,
      checkInLat: 18.5913,
      checkInLng: 73.7389,
      checkInAccuracy: 10,
      checkInDistanceM: 20,
      checkInPhotoPath: 'attendance/x/in.png',
      checkInPhotoHash: 'h1',
      checkOutLat: 18.5913,
      checkOutLng: 73.7389,
      checkOutAccuracy: 10,
      checkOutDistanceM: 25,
      checkOutPhotoPath: 'attendance/x/out.png',
      checkOutPhotoHash: 'h2',
      status: 'PRESENT',
      flags: '[]',
      workedMinutes: 480,
      deviceId: 'seed',
    },
  });

  // One approved paid leave day on a date distinct from the attendance record
  // (when both exist on a day, the worked record wins — that's by design).
  leaveDate = `${month}-01` === todayStr() ? addDays(todayStr(), 1) : `${month}-01`;

  const sick = await prisma.leaveType.create({
    data: { code: 'SICK', name: 'Sick Leave', annualQuota: 8, paid: true },
  });
  await prisma.leaveRequest.create({
    data: {
      userId: engineerId,
      leaveTypeId: sick.id,
      fromDate: leaveDate,
      toDate: leaveDate,
      days: 1,
      reason: 'test fixture',
      status: 'APPROVED',
      decidedById: managerId,
      decisionComment: 'ok',
      decidedAt: new Date(),
    },
  });

  hrToken = (await loginAs('hr@test.local')).accessToken;
  adminToken = (await loginAs('admin@test.local')).accessToken;
  mgrToken = (await loginAs('manager@test.local')).accessToken;
  engToken = (await loginAs('engineer@test.local')).accessToken;

  const pw = await hashPassword(PASSWORD);
  await prisma.user.create({
    data: { email: 'nosites@test.local', employeeId: 'T-0099', name: 'No Sites Mgr', role: 'MANAGER', passwordHash: pw },
  });
  mgrNoSitesToken = (await loginAs('nosites@test.local')).accessToken;
});

describe('Reports', () => {
  test('attendance report JSON returns scoped rows with correct counts', async () => {
    const res = await request(app)
      .get(`/api/reports/attendance?month=${month}&format=json`)
      .set(bearer(hrToken));
    expect(res.status).toBe(200);
    expect(res.body.columns).toContain('Present');
    expect(res.body.rows.length).toBe(1);
    const row = res.body.rows[0];
    expect(row[0]).toBe('T-0004'); // employeeId
    expect(row[1]).toBe('Test Engineer');
    expect(row[3]).toBe(1); // present days
    expect(row[7]).toBe(1); // on-leave days
  });

  test('attendance CSV starts with BOM, includes headers and data, sets filename', async () => {
    const res = await request(app)
      .get(`/api/reports/attendance?month=${month}&format=csv`)
      .set(bearer(hrToken));
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.headers['content-disposition']).toContain('attendance-report');
    expect(res.text.startsWith('\uFEFF')).toBe(true);
    expect(res.text).toContain('Employee ID');
    expect(res.text).toContain('Test Engineer');
  });

  test('attendance PDF is a real PDF document', async () => {
    const res = await request(app)
      .get(`/api/reports/attendance?month=${month}&format=pdf`)
      .set(bearer(hrToken))
      .buffer(true)
      .parse(binaryParser as never);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/pdf');
    const buf = res.body as Buffer;
    expect(buf.slice(0, 5).toString()).toBe('%PDF-');
    expect(buf.length).toBeGreaterThan(500);
  });

  test('leave report lists the approved request (manager scope)', async () => {
    const res = await request(app)
      .get(`/api/reports/leave?from=${leaveDate}&to=${leaveDate}&format=json`)
      .set(bearer(mgrToken));
    expect(res.status).toBe(200);
    expect(res.body.rows.length).toBe(1);
    expect(res.body.rows[0]).toContain('Sick Leave');
    expect(res.body.rows[0]).toContain('APPROVED');

    const csv = await request(app)
      .get(`/api/reports/leave?from=${leaveDate}&to=${leaveDate}&format=csv`)
      .set(bearer(mgrToken));
    expect(csv.text).toContain('Sick Leave');
    expect(csv.text).toContain('APPROVED');
  });

  test('payroll summary computes working days, days worked and paid leave', async () => {
    const res = await request(app)
      .get(`/api/reports/payroll?month=${month}&format=json`)
      .set(bearer(hrToken));
    expect(res.status).toBe(200);
    const row = res.body.rows[0];
    expect(row[0]).toBe('T-0004');
    expect(typeof row[3]).toBe('number'); // working days (Mon–Sat of month)
    expect(row[3]).toBeGreaterThan(0);
    expect(row[4]).toBe(1); // days worked
    expect(row[7]).toBe(1); // paid leave days
    expect(row[8]).toBe(0); // unpaid leave days
  });

  test('RBAC + scope: engineer 403, no-site manager empty, unknown site empty, manager cannot payroll', async () => {
    const asEng = await request(app)
      .get(`/api/reports/attendance?month=${month}`)
      .set(bearer(engToken));
    expect(asEng.status).toBe(403);

    const noSites = await request(app)
      .get(`/api/reports/attendance?month=${month}`)
      .set(bearer(mgrNoSitesToken));
    expect(noSites.status).toBe(200);
    expect(noSites.body.rows).toEqual([]);

    const unknownSite = await request(app)
      .get(`/api/reports/attendance?month=${month}&siteId=does-not-exist`)
      .set(bearer(mgrToken));
    expect(unknownSite.body.rows).toEqual([]);

    const payrollAsMgr = await request(app)
      .get(`/api/reports/payroll?month=${month}`)
      .set(bearer(mgrToken));
    expect(payrollAsMgr.status).toBe(403);

    void adminToken;
  });

  test('every export is audited', async () => {
    await request(app).get(`/api/reports/attendance?month=${month}`).set(bearer(hrToken));
    await request(app).get(`/api/reports/leave?format=csv`).set(bearer(hrToken));
    const audits = await prisma.auditLog.findMany({ where: { action: 'REPORT_EXPORT' } });
    expect(audits.length).toBe(2);
  });
});

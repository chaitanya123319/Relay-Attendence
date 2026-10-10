/**
 * Phase 4 acceptance tests — leave workflow.
 * Covers: apply + reservation, overlap, insufficient balance, approve deducts,
 * reject requires comment + releases, cancel releases, half-day rules,
 * past-date policy, required documents + document access control,
 * manager scope, RBAC, double-decision guard, ON_LEAVE in attendance summary.
 */
import request from 'supertest';
import { LeaveType } from '@prisma/client';
import { hashPassword } from '../src/lib/passwords';
import { prisma } from '../src/lib/prisma';
import { addDays, isWeeklyOff, todayStr } from '../src/lib/time';
import { app, bearer, loginAs, PASSWORD, resetDb, seedBasic } from './helpers';

let engToken: string;
let mgrToken: string;
let hrToken: string;
let adminToken: string;
let engineerId: string;
let managerId: string;

let casual: LeaveType;
let sick: LeaveType;
let medical: LeaveType;

const today = todayStr();
const tomorrow = addDays(today, 1);

beforeEach(async () => {
  await resetDb();
  const seed = await seedBasic();
  engineerId = seed.engineer.id;
  managerId = seed.manager.id;

  casual = await prisma.leaveType.create({
    data: { code: 'CASUAL', name: 'Casual Leave', annualQuota: 3, minNoticeDays: 0 },
  });
  sick = await prisma.leaveType.create({
    data: { code: 'SICK', name: 'Sick Leave', annualQuota: 8, minNoticeDays: 3 },
  });
  medical = await prisma.leaveType.create({
    data: { code: 'MEDICAL', name: 'Medical Leave', annualQuota: 5, requiresDocument: true },
  });

  engToken = (await loginAs('engineer@test.local')).accessToken;
  mgrToken = (await loginAs('manager@test.local')).accessToken;
  hrToken = (await loginAs('hr@test.local')).accessToken;
  adminToken = (await loginAs('admin@test.local')).accessToken;
});

function applyLeave(
  fields: Record<string, string>,
  token = engToken,
  attach?: { buf: Buffer; name: string; mime: string },
) {
  let req = request(app).post('/api/leave/requests').set(bearer(token));
  for (const [k, v] of Object.entries(fields)) req = req.field(k, v);
  if (attach) req = req.attach('document', attach.buf, { filename: attach.name, contentType: attach.mime });
  return req;
}

const fields = (over: Record<string, string> = {}) => ({
  leaveTypeId: casual.id,
  fromDate: tomorrow,
  toDate: tomorrow,
  reason: 'Family function out of town',
  ...over,
});

const balancesOfMe = async () => {
  const res = await request(app).get('/api/leave/balances/me').set(bearer(engToken));
  expect(res.status).toBe(200);
  return res.body as Array<{
    leaveType: { code: string };
    allocated: number;
    used: number;
    pending: number;
    available: number;
  }>;
};
const row = (rows: Awaited<ReturnType<typeof balancesOfMe>>, code: string) =>
  rows.find((r) => r.leaveType.code === code)!;

const PDF = Buffer.from('%PDF-1.4\n% RELAY test document\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF');

describe('Leave — apply & validation', () => {
  test('applies leave: PENDING, reservation reduces availability, notifications sent', async () => {
    const res = await applyLeave(fields({ toDate: addDays(tomorrow, 1) })); // 2 days
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('PENDING');
    expect(res.body.days).toBe(2);
    expect(res.body.leaveType.code).toBe('CASUAL');

    const rows = await balancesOfMe();
    const c = row(rows, 'CASUAL');
    expect(c.allocated).toBe(3);
    expect(c.used).toBe(0); // not yet approved
    expect(c.pending).toBe(2);
    expect(c.available).toBe(1);

    const mgrNotes = await prisma.notification.findMany({ where: { userId: managerId } });
    expect(mgrNotes.some((n) => n.type === 'LEAVE_SUBMITTED')).toBe(true);
    const mine = await prisma.notification.findMany({ where: { userId: engineerId } });
    expect(mine.some((n) => n.type === 'LEAVE_SUBMITTED')).toBe(true);
  });

  test('overlapping dates are rejected', async () => {
    await applyLeave(fields({ toDate: addDays(tomorrow, 2) })); // 3 days
    const res = await applyLeave(fields({ fromDate: addDays(tomorrow, 1), toDate: addDays(tomorrow, 3) }));
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('LEAVE_OVERLAP');
  });

  test('insufficient balance is rejected', async () => {
    const res = await applyLeave(fields({ toDate: addDays(tomorrow, 4) })); // 5 days > quota 3
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('INSUFFICIENT_BALANCE');
    expect(res.body.error.details.available).toBe(3);
    expect(res.body.error.details.requested).toBe(5);
  });

  test('past-date abuse beyond policy is rejected', async () => {
    const res = await applyLeave(
      fields({ leaveTypeId: sick.id, fromDate: addDays(today, -10), toDate: addDays(today, -9) }),
    );
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('PAST_DATE');
  });

  test('half-day: same-date allowed (0.5 day), multi-date blocked', async () => {
    const ok = await applyLeave(
      fields({ isHalfDay: 'true', halfDayPeriod: 'AM', toDate: tomorrow }),
    );
    expect(ok.status).toBe(201);
    expect(ok.body.days).toBe(0.5);

    const bad = await applyLeave(
      fields({ isHalfDay: 'true', fromDate: addDays(tomorrow, 2), toDate: addDays(tomorrow, 3) }),
    );
    expect(bad.status).toBe(422);
    expect(bad.body.error.code).toBe('HALF_DAY_RANGE');
  });

  test('document-required type blocks without a file, accepts with one', async () => {
    const noDoc = await applyLeave(fields({ leaveTypeId: medical.id }));
    expect(noDoc.status).toBe(422);
    expect(noDoc.body.error.code).toBe('DOCUMENT_REQUIRED');

    const withDoc = await applyLeave(fields({ leaveTypeId: medical.id }), engToken, {
      buf: PDF,
      name: 'sick-note.pdf',
      mime: 'application/pdf',
    });
    expect(withDoc.status).toBe(201);
    expect(withDoc.body.documents.length).toBe(1);
    expect(withDoc.body.documents[0].endpoint).toBe(`/api/leave/documents/${withDoc.body.documents[0].id}`);
  });
});

describe('Leave — approval workflow', () => {
  test('approve deducts balance, sets decision metadata, notifies the engineer', async () => {
    const applied = await applyLeave(fields({ toDate: addDays(tomorrow, 1) })); // 2 days
    const approve = await request(app)
      .post(`/api/leave/requests/${applied.body.id}/approve`)
      .set(bearer(mgrToken))
      .send({ comment: 'Approved — enjoy!' });

    expect(approve.status).toBe(200);
    expect(approve.body.status).toBe('APPROVED');
    expect(approve.body.decidedBy.id).toBe(managerId);

    const rows = await balancesOfMe();
    const c = row(rows, 'CASUAL');
    expect(c.used).toBe(2); // deducted on approval
    expect(c.pending).toBe(0);
    expect(c.available).toBe(1);

    const notes = await prisma.notification.findMany({ where: { userId: engineerId } });
    expect(notes.some((n) => n.type === 'LEAVE_APPROVED')).toBe(true);

    const audit = await prisma.auditLog.findMany({ where: { action: 'LEAVE_APPROVE' } });
    expect(audit.length).toBe(1);

    // Double decision is blocked.
    const again = await request(app)
      .post(`/api/leave/requests/${applied.body.id}/approve`)
      .set(bearer(mgrToken))
      .send({});
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe('NOT_PENDING');
  });

  test('reject demands a comment and releases the reservation', async () => {
    const applied = await applyLeave(fields({ toDate: addDays(tomorrow, 1) }));

    const noComment = await request(app)
      .post(`/api/leave/requests/${applied.body.id}/reject`)
      .set(bearer(mgrToken))
      .send({});
    expect(noComment.status).toBe(400);
    expect(noComment.body.error.code).toBe('VALIDATION_ERROR');

    const rejected = await request(app)
      .post(`/api/leave/requests/${applied.body.id}/reject`)
      .set(bearer(mgrToken))
      .send({ comment: 'Peak pour week — please reschedule.' });
    expect(rejected.status).toBe(200);
    expect(rejected.body.status).toBe('REJECTED');
    expect(rejected.body.decisionComment).toContain('reschedule');

    const rows = await balancesOfMe();
    const c = row(rows, 'CASUAL');
    expect(c.used).toBe(0);
    expect(c.pending).toBe(0);
    expect(c.available).toBe(3); // reservation released
  });

  test('employee can cancel while pending; reservation released; managers notified', async () => {
    const applied = await applyLeave(fields({ toDate: addDays(tomorrow, 1) }));
    const cancelled = await request(app)
      .post(`/api/leave/requests/${applied.body.id}/cancel`)
      .set(bearer(engToken));
    expect(cancelled.status).toBe(200);
    expect(cancelled.body.status).toBe('CANCELLED');

    const rows = await balancesOfMe();
    expect(row(rows, 'CASUAL').available).toBe(3);

    const mgrNotes = await prisma.notification.findMany({ where: { userId: managerId } });
    expect(mgrNotes.some((n) => n.type === 'LEAVE_CANCELLED')).toBe(true);

    // Cancelling again → not pending
    const again = await request(app)
      .post(`/api/leave/requests/${applied.body.id}/cancel`)
      .set(bearer(engToken));
    expect(again.status).toBe(409);
  });

  test('manager scope + RBAC: outsiders cannot see or decide, engineers cannot decide', async () => {
    const applied = await applyLeave(fields());

    // Engineer can't approve anyone
    const asEng = await request(app)
      .post(`/api/leave/requests/${applied.body.id}/approve`)
      .set(bearer(engToken))
      .send({});
    expect(asEng.status).toBe(403);

    // An engineer with no shared site is outside the manager's scope.
    const pw = await hashPassword(PASSWORD);
    const outsider = await prisma.user.create({
      data: { email: 'outsider@test.local', employeeId: 'T-0021', name: 'Outside Eng', role: 'ENGINEER', passwordHash: pw },
    });
    const outsiderToken = (await loginAs('outsider@test.local')).accessToken;
    const outsiderLeave = await applyLeave(fields({ fromDate: addDays(tomorrow, 5), toDate: addDays(tomorrow, 5) }), outsiderToken);
    expect(outsiderLeave.status).toBe(201);

    const queue = await request(app).get('/api/leave/requests?status=PENDING').set(bearer(mgrToken));
    expect(queue.status).toBe(200);
    const ids = queue.body.map((r: { id: string }) => r.id);
    expect(ids).toContain(applied.body.id);
    expect(ids).not.toContain(outsiderLeave.body.id);

    const decide = await request(app)
      .post(`/api/leave/requests/${outsiderLeave.body.id}/approve`)
      .set(bearer(mgrToken))
      .send({});
    expect(decide.status).toBe(403);

    // HR is company-wide: can decide for the outsider.
    const hrDecide = await request(app)
      .post(`/api/leave/requests/${outsiderLeave.body.id}/approve`)
      .set(bearer(hrToken))
      .send({ comment: 'ok' });
    expect(hrDecide.status).toBe(200);
    expect(outsider.id).toBeTruthy();
  });

  test('approved leave appears as ON_LEAVE (never absent) in the attendance summary', async () => {
    // Pick a recent past weekday within sick-leave's 3-day notice window.
    let d = addDays(today, -2);
    if (isWeeklyOff(d)) d = addDays(d, 1);

    const applied = await applyLeave(fields({ leaveTypeId: sick.id, fromDate: d, toDate: d }));
    expect(applied.status).toBe(201);
    const approve = await request(app)
      .post(`/api/leave/requests/${applied.body.id}/approve`)
      .set(bearer(mgrToken))
      .send({ comment: 'ok' });
    expect(approve.status).toBe(200);

    const month = d.slice(0, 7);
    const summary = await request(app)
      .get(`/api/attendance/me/summary?month=${month}`)
      .set(bearer(engToken));
    expect(summary.status).toBe(200);
    const dayRow = summary.body.days.find((x: { date: string }) => x.date === d);
    expect(dayRow.status).toBe('ON_LEAVE');
    expect(dayRow.leaveType).toBe('Sick Leave');
  });
});

describe('Leave — documents, types, admin', () => {
  test('documents are streamable by owner + manager, denied to outsiders, signable', async () => {
    const created = await applyLeave(fields({ leaveTypeId: medical.id }), engToken, {
      buf: PDF,
      name: 'note.pdf',
      mime: 'application/pdf',
    });
    const docId = created.body.documents[0].id;

    const owner = await request(app).get(`/api/leave/documents/${docId}`).set(bearer(engToken));
    expect(owner.status).toBe(200);
    expect(owner.headers['content-type']).toContain('application/pdf');

    const mgr = await request(app).get(`/api/leave/documents/${docId}`).set(bearer(mgrToken));
    expect(mgr.status).toBe(200);

    const pw = await hashPassword(PASSWORD);
    await prisma.user.create({
      data: { email: 'nosy@test.local', employeeId: 'T-0031', name: 'Nosy', role: 'ENGINEER', passwordHash: pw },
    });
    const nosyToken = (await loginAs('nosy@test.local')).accessToken;
    const nosy = await request(app).get(`/api/leave/documents/${docId}`).set(bearer(nosyToken));
    expect(nosy.status).toBe(403);

    const signed = await request(app)
      .post('/api/uploads/signed-url')
      .set(bearer(mgrToken))
      .send({ path: `/api/leave/documents/${docId}` });
    expect(signed.status).toBe(200);
    const viaSigned = await request(app).get(signed.body.url.replace(/^https?:\/\/[^/]+/, ''));
    expect(viaSigned.status).toBe(200);
    expect(viaSigned.headers['content-type']).toContain('application/pdf');
  });

  test('admin manages leave types; engineers only see active ones', async () => {
    const created = await request(app)
      .post('/api/leave/types')
      .set(bearer(adminToken))
      .send({ code: 'wfh', name: 'Work From Home', annualQuota: 4 });
    expect(created.status).toBe(201);
    expect(created.body.code).toBe('WFH'); // normalized to upper case

    const forbidden = await request(app)
      .post('/api/leave/types')
      .set(bearer(engToken))
      .send({ code: 'X', name: 'Nope' });
    expect(forbidden.status).toBe(403);

    const visible = await request(app).get('/api/leave/types').set(bearer(engToken));
    expect(visible.body.some((t: { code: string }) => t.code === 'WFH')).toBe(true);

    await request(app)
      .patch(`/api/leave/types/${created.body.id}`)
      .set(bearer(adminToken))
      .send({ isActive: false });

    const after = await request(app).get('/api/leave/types').set(bearer(engToken));
    expect(after.body.some((t: { code: string }) => t.code === 'WFH')).toBe(false);

    const asAdmin = await request(app).get('/api/leave/types').set(bearer(adminToken));
    expect(asAdmin.body.some((t: { code: string }) => t.code === 'WFH')).toBe(true);
  });

  test('leave history filters by status', async () => {
    const a = await applyLeave(fields());
    await request(app).post(`/api/leave/requests/${a.body.id}/approve`).set(bearer(mgrToken)).send({});
    await applyLeave(fields({ fromDate: addDays(tomorrow, 5), toDate: addDays(tomorrow, 5) }));

    const all = await request(app).get('/api/leave/requests/me').set(bearer(engToken));
    expect(all.body.length).toBe(2);

    const approved = await request(app).get('/api/leave/requests/me?status=APPROVED').set(bearer(engToken));
    expect(approved.body.length).toBe(1);
    expect(approved.body[0].status).toBe('APPROVED');

    const pending = await request(app).get('/api/leave/requests/me?status=PENDING').set(bearer(engToken));
    expect(pending.body.length).toBe(1);
  });
});

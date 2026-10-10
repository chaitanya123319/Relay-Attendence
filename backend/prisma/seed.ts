/**
 * Seed script — a full demo company.
 *
 * Creates: 1 admin, 1 HR, 2 managers, 5 site engineers, 3 project sites,
 * site assignments, 4 leave types, balances, ~2 weeks of realistic attendance
 * (late arrivals, a missing check-out, a half-day, an OUT_OF_RANGE flag) and
 * leave requests in every workflow state, plus notifications and audit rows.
 *
 * Photos are generated 1×1 PNGs written through the SAME StorageService and
 * hashed with the SAME sha256 code as real uploads — a real byte flow.
 *
 * Run: npm run db:seed   (idempotent — wipes operational tables first)
 */
import { prisma } from '../src/lib/prisma';
import { hashPassword } from '../src/lib/passwords';
import { sha256Hex } from '../src/lib/crypto';
import { buildStoragePath, storage } from '../src/lib/storage';
import { addDays, isWeeklyOff, minutesOfDayInTZ, parseHHMM, todayStr } from '../src/lib/time';
import { haversineMeters } from '../src/lib/geo';

const DEMO_PASSWORD = 'Relay@123';
const IST = '+05:30'; // seed runs against the default COMPANY_TZ (Asia/Kolkata)

// 1×1 PNG used as the sample capture for seeded records.
const SAMPLE_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

/** Deterministic tiny PRNG so every seed run produces the same demo data. */
let seedState = 20261009;
const rand = () => {
  seedState = (seedState * 1103515245 + 12345) % 2147483648;
  return seedState / 2147483648;
};

const at = (date: string, hh: number, mm: number) =>
  new Date(`${date}T${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00.000${IST}`);

async function wipe() {
  // FK-safe order.
  await prisma.auditLog.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.leaveDocument.deleteMany();
  await prisma.leaveRequest.deleteMany();
  await prisma.leaveBalance.deleteMany();
  await prisma.leaveType.deleteMany();
  await prisma.attendanceRecord.deleteMany();
  await prisma.siteAssignment.deleteMany();
  await prisma.projectSite.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.pushToken.deleteMany();
  await prisma.user.deleteMany();
}

async function main() {
  console.log('[seed] wiping operational tables…');
  await wipe();

  const pw = await hashPassword(DEMO_PASSWORD);

  // ── Users ────────────────────────────────────────────────────────────────
  const admin = await prisma.user.create({
    data: { email: 'admin@relay.local', employeeId: 'EMP-0001', name: 'Vikram Joshi', role: 'ADMIN', passwordHash: pw, phone: '+91 98200 00001' },
  });
  const hr = await prisma.user.create({
    data: { email: 'hr@relay.local', employeeId: 'EMP-0002', name: 'Neha Kulkarni', role: 'HR', passwordHash: pw, phone: '+91 98200 00002' },
  });
  const mgr1 = await prisma.user.create({
    data: { email: 'manager1@relay.local', employeeId: 'EMP-0003', name: 'Arun Mehta', role: 'MANAGER', passwordHash: pw, phone: '+91 98200 00003' },
  });
  const mgr2 = await prisma.user.create({
    data: { email: 'manager2@relay.local', employeeId: 'EMP-0004', name: 'Kavita Rao', role: 'MANAGER', passwordHash: pw, phone: '+91 98200 00004' },
  });

  const engineerSpecs = [
    { name: 'Amit Patil', email: 'engineer1@relay.local' },
    { name: 'Suresh Kumar', email: 'engineer2@relay.local' },
    { name: 'Ravi Deshmukh', email: 'engineer3@relay.local' },
    { name: 'Pooja Shetty', email: 'engineer4@relay.local' },
    { name: 'Sanjay Pawar', email: 'engineer5@relay.local' },
  ];
  const engineers = [];
  for (let i = 0; i < engineerSpecs.length; i++) {
    engineers.push(
      await prisma.user.create({
        data: {
          email: engineerSpecs[i].email,
          employeeId: `EMP-001${i + 1}`,
          name: engineerSpecs[i].name,
          role: 'ENGINEER',
          passwordHash: pw,
          phone: `+91 98200 0001${i + 1}`,
        },
      }),
    );
  }

  // ── Sites ────────────────────────────────────────────────────────────────
  const siteA = await prisma.projectSite.create({
    data: {
      name: 'Skyline Residences – Hinjawadi',
      address: 'Phase 2, Hinjawadi IT Park, Pune 411057',
      lat: 18.5913,
      lng: 73.7389,
      radiusM: 150,
      outOfRangeBehavior: 'REJECT',
      shiftStart: '09:00',
      shiftEnd: '18:00',
      lateGraceMinutes: 15,
      halfDayMinutes: 240,
    },
  });
  const siteB = await prisma.projectSite.create({
    data: {
      name: 'Metro Depot – Balewadi',
      address: 'Balewadi High Street, Pune 411045',
      lat: 18.5793,
      lng: 73.7756,
      radiusM: 200,
      outOfRangeBehavior: 'FLAG',
      shiftStart: '09:30',
      shiftEnd: '18:30',
      lateGraceMinutes: 10,
      halfDayMinutes: 240,
    },
  });
  const siteC = await prisma.projectSite.create({
    data: {
      name: 'Coastal Expressway – Panvel',
      address: 'NH-348A, Panvel, Raigad 410206',
      lat: 18.9894,
      lng: 73.1175,
      radiusM: 150,
      outOfRangeBehavior: 'REJECT',
      shiftStart: '08:30',
      shiftEnd: '17:30',
      lateGraceMinutes: 15,
      halfDayMinutes: 240,
    },
  });

  // ── Assignments (managers hold site scopes too) ──────────────────────────
  const assign = (userId: string, siteId: string, assignedById: string) =>
    prisma.siteAssignment.create({ data: { userId, siteId, assignedById } });

  await assign(engineers[0].id, siteA.id, mgr1.id);
  await assign(engineers[1].id, siteA.id, mgr1.id);
  await assign(engineers[2].id, siteA.id, mgr1.id);
  await assign(engineers[3].id, siteB.id, mgr1.id);
  await assign(engineers[4].id, siteB.id, mgr1.id);
  await assign(mgr1.id, siteA.id, admin.id);
  await assign(mgr1.id, siteB.id, admin.id);
  await assign(mgr2.id, siteC.id, admin.id);

  // ── Leave types ──────────────────────────────────────────────────────────
  const casual = await prisma.leaveType.create({
    data: { code: 'CASUAL', name: 'Casual Leave', annualQuota: 12, paid: true, minNoticeDays: 0, allowHalfDay: true },
  });
  const sick = await prisma.leaveType.create({
    data: { code: 'SICK', name: 'Sick Leave', annualQuota: 8, paid: true, minNoticeDays: 3, allowHalfDay: true },
  });
  const earned = await prisma.leaveType.create({
    data: { code: 'EARNED', name: 'Earned Leave', annualQuota: 15, paid: true, minNoticeDays: 0, maxConsecutiveDays: 10, allowHalfDay: true },
  });
  const compOff = await prisma.leaveType.create({
    data: { code: 'COMP_OFF', name: 'Compensatory Off', annualQuota: 2, paid: true, minNoticeDays: 0, allowHalfDay: false },
  });

  // ── Balances (current year, all users) ───────────────────────────────────
  const year = Number(todayStr().slice(0, 4));
  const quotas: Array<[string, string, number]> = [
    [casual.id, 'CASUAL', 12],
    [sick.id, 'SICK', 8],
    [earned.id, 'EARNED', 15],
    [compOff.id, 'COMP_OFF', 2],
  ];
  for (const u of [admin, hr, mgr1, mgr2, ...engineers]) {
    for (const [typeId, , quota] of quotas) {
      await prisma.leaveBalance.create({
        data: { userId: u.id, leaveTypeId: typeId, year, allocated: quota, used: 0 },
      });
    }
  }

  // ── Attendance: last 14 days (skipping Sundays) ──────────────────────────
  const today = todayStr();
  const saveCapture = async (userId: string, date: string, side: 'in' | 'out') => {
    const rel = buildStoragePath('attendance', userId, `${date}-${side}.png`);
    await storage.save(SAMPLE_PNG, rel);
    return { rel, hash: sha256Hex(SAMPLE_PNG) };
  };

  interface Pattern {
    user: (typeof engineers)[number];
    site: typeof siteA;
    lateOn?: (o: number) => boolean;
    absentOn?: (o: number) => boolean;
    forgotCheckoutOn?: number;
    halfDayOn?: number;
    outOfRangeOn?: number;
    skipOn?: string; // leave date
  }
  const patterns: Pattern[] = [
    { user: engineers[0], site: siteA, lateOn: (o) => o % 3 === 0 },
    { user: engineers[1], site: siteA, halfDayOn: 4, forgotCheckoutOn: 9 },
    { user: engineers[2], site: siteA, lateOn: (o) => o % 5 === 0, absentOn: (o) => o === 4 || o === 11, forgotCheckoutOn: 2 },
    { user: engineers[3], site: siteB, lateOn: (o) => o % 4 === 0 },
    { user: engineers[4], site: siteB, outOfRangeOn: 5 },
  ];

  // eng-4 will take one approved sick day; find the most recent non-Sunday day ≥3 days back.
  let leaveOffset = 3;
  while (isWeeklyOff(addDays(today, -leaveOffset))) leaveOffset++;
  const eng4LeaveDate = addDays(today, -leaveOffset);
  patterns[3].skipOn = eng4LeaveDate;

  let created = 0;
  for (const p of patterns) {
    for (let o = 1; o <= 14; o++) {
      const date = addDays(today, -o);
      if (isWeeklyOff(date)) continue;
      if (p.absentOn?.(o)) continue;
      if (p.skipOn === date) continue;

      const late = p.lateOn?.(o) ?? false;
      const inMin = late ? 34 + Math.floor(rand() * 15) : Math.floor(rand() * 9); // 09:00..09:08 or 09:34..09:48
      const checkInTime = at(date, 9, inMin);
      const inLat = p.site.lat + 0.0002 + rand() * 0.0002;
      const inLng = p.site.lng + 0.0001 + rand() * 0.0002;

      const isOutOfRange = p.outOfRangeOn === o;
      const finalInLat = isOutOfRange ? p.site.lat + 0.0043 : inLat;
      const finalInLng = isOutOfRange ? p.site.lng + 0.0004 : inLng;
      const finalInDist = haversineMeters(finalInLat, finalInLng, p.site.lat, p.site.lng);

      const isForgotten = p.forgotCheckoutOn === o;
      let checkOutTime: Date | null = null;
      let outLat: number | null = null;
      let outLng: number | null = null;
      let outDist: number | null = null;
      let workedMinutes: number | null = null;

      if (!isForgotten) {
        const isHalf = p.halfDayOn === o;
        const outHour = isHalf ? 12 : 18;
        const outMin = isHalf ? 40 : Math.floor(rand() * 30) + 5;
        checkOutTime = at(date, outHour, outMin);
        outLat = p.site.lat + 0.0001 + rand() * 0.0002;
        outLng = p.site.lng + 0.0001 + rand() * 0.0002;
        outDist = haversineMeters(outLat, outLng, p.site.lat, p.site.lng);
        workedMinutes = Math.round((checkOutTime.getTime() - checkInTime.getTime()) / 60000);
      }

      const photoIn = await saveCapture(p.user.id, date, 'in');
      const photoOut = checkOutTime ? await saveCapture(p.user.id, date, 'out') : null;

      const shiftStartMin = parseHHMM(p.site.shiftStart);
      const isLate = minutesOfDayInTZ(checkInTime) > shiftStartMin + p.site.lateGraceMinutes;
      let status = isLate ? 'LATE' : 'PRESENT';
      if (isForgotten) status = 'INCOMPLETE';
      else if (workedMinutes !== null && workedMinutes < p.site.halfDayMinutes) status = 'HALF_DAY';

      const flags: string[] = [];
      if (isOutOfRange) flags.push('OUT_OF_RANGE');

      await prisma.attendanceRecord.create({
        data: {
          userId: p.user.id,
          siteId: p.site.id,
          date,
          checkInTime,
          checkOutTime,
          checkInLat: finalInLat,
          checkInLng: finalInLng,
          checkInAccuracy: 8 + rand() * 12,
          checkInDistanceM: finalInDist,
          checkInPhotoPath: photoIn.rel,
          checkInPhotoHash: photoIn.hash,
          checkOutLat: outLat,
          checkOutLng: outLng,
          checkOutAccuracy: outLat !== null ? 8 + rand() * 12 : null,
          checkOutDistanceM: outDist,
          checkOutPhotoPath: photoOut?.rel ?? null,
          checkOutPhotoHash: photoOut?.hash ?? null,
          status,
          flags: JSON.stringify(flags),
          workedMinutes,
          clientDriftSeconds: Math.floor(rand() * 30) - 15,
          deviceId: `seed-device-${p.user.employeeId}`,
        },
      });
      created++;
    }
  }
  console.log(`[seed] attendance records created: ${created}`);

  // ── Leave requests in every workflow state ───────────────────────────────
  const nextMon = (() => {
    let d = addDays(today, 1);
    while (isWeeklyOff(d)) d = addDays(d, 1);
    return d;
  })();

  const approved = await prisma.leaveRequest.create({
    data: {
      userId: engineers[3].id,
      leaveTypeId: sick.id,
      fromDate: eng4LeaveDate,
      toDate: eng4LeaveDate,
      days: 1,
      reason: 'Viral fever — doctor advised rest.',
      status: 'APPROVED',
      decidedById: mgr1.id,
      decisionComment: 'Approved. Get well soon.',
      decidedAt: new Date(),
    },
  });
  await prisma.leaveBalance.update({
    where: { userId_leaveTypeId_year: { userId: engineers[3].id, leaveTypeId: sick.id, year } },
    data: { used: 1 },
  });

  const pending = await prisma.leaveRequest.create({
    data: {
      userId: engineers[1].id,
      leaveTypeId: casual.id,
      fromDate: nextMon,
      toDate: addDays(nextMon, 1),
      days: 2,
      reason: 'Family function out of town.',
      status: 'PENDING',
    },
  });

  await prisma.leaveRequest.create({
    data: {
      userId: engineers[0].id,
      leaveTypeId: earned.id,
      fromDate: addDays(today, -10),
      toDate: addDays(today, -9),
      days: 2,
      reason: 'Personal travel.',
      status: 'REJECTED',
      decidedById: mgr1.id,
      decisionComment: 'Critical slab pour on those dates — please reschedule.',
      decidedAt: at(addDays(today, -12), 10, 30),
    },
  });

  await prisma.leaveRequest.create({
    data: {
      userId: engineers[4].id,
      leaveTypeId: casual.id,
      fromDate: addDays(nextMon, 7),
      toDate: addDays(nextMon, 7),
      days: 1,
      reason: 'Bank work.',
      status: 'CANCELLED',
    },
  });

  // ── Notifications ────────────────────────────────────────────────────────
  const notif = (userId: string, title: string, body: string, type: string) =>
    prisma.notification.create({ data: { userId, title, body, type } });

  await notif(mgr1.id, 'New leave request', `${engineers[1].name} requested ${pending.days} day(s) casual leave from ${pending.fromDate}.`, 'LEAVE_SUBMITTED');
  await notif(engineers[1].id, 'Leave request submitted', `Your casual leave request for ${pending.fromDate} → ${pending.toDate} is pending approval.`, 'LEAVE_SUBMITTED');
  await notif(engineers[3].id, 'Leave approved', `Your sick leave on ${eng4LeaveDate} was approved by ${mgr1.name}.`, 'LEAVE_APPROVED');
  await notif(engineers[0].id, 'Leave rejected', `Your earned leave request was rejected: "Critical slab pour on those dates — please reschedule."`, 'LEAVE_REJECTED');
  await notif(mgr1.id, 'Attendance flagged', `${engineers[4].name}'s check-in was flagged OUT_OF_RANGE (~478 m from Metro Depot – Balewadi).`, 'ATTENDANCE_FLAGGED');

  // ── A few audit rows for realism ─────────────────────────────────────────
  await prisma.auditLog.createMany({
    data: [
      { actorId: mgr1.id, action: 'LEAVE_APPROVE', entity: 'LeaveRequest', entityId: approved.id, meta: JSON.stringify({ days: 1 }) },
      { actorId: admin.id, action: 'SITE_CREATE', entity: 'ProjectSite', entityId: siteC.id, meta: JSON.stringify({ name: siteC.name }) },
      { actorId: hr.id, action: 'BALANCE_ADJUST', entity: 'LeaveBalance', meta: JSON.stringify({ year }) },
    ],
  });

  // ── Summary ──────────────────────────────────────────────────────────────
  console.log('\n[seed] Demo accounts (password for ALL: ' + DEMO_PASSWORD + ')');
  console.table([
    { role: 'ADMIN', email: admin.email, employeeId: admin.employeeId },
    { role: 'HR', email: hr.email, employeeId: hr.employeeId },
    { role: 'MANAGER', email: mgr1.email, employeeId: mgr1.employeeId },
    { role: 'MANAGER', email: mgr2.email, employeeId: mgr2.employeeId },
    ...engineers.map((e) => ({ role: 'ENGINEER', email: e.email, employeeId: e.employeeId })),
  ]);
  console.log('[seed] done.');
}

main()
  .catch((err) => {
    console.error('[seed] failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

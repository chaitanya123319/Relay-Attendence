/**
 * Shared test utilities: app instance (supertest target), DB reset, fixture
 * seeding and login helpers. Each spec: `await resetDb()` then `seedBasic()`.
 */
import request from 'supertest';
import { ProjectSite, User } from '@prisma/client';
import { createApp } from '../src/app';
import { hashPassword } from '../src/lib/passwords';
import { prisma } from '../src/lib/prisma';

export const app = createApp();

/** Demo password used by all seeded fixture accounts. */
export const PASSWORD = 'Relay@123';

/** Wipe all tables in FK-safe order. */
export async function resetDb(): Promise<void> {
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

export interface SeedResult {
  admin: User;
  hr: User;
  manager: User;
  engineer: User;
  siteIn: ProjectSite;
  siteFlag: ProjectSite;
}

/** Minimal but complete fixture: 4 roles, 2 sites (REJECT + FLAG), assignments. */
export async function seedBasic(): Promise<SeedResult> {
  const pw = await hashPassword(PASSWORD);

  const admin = await prisma.user.create({
    data: { email: 'admin@test.local', employeeId: 'T-0001', name: 'Test Admin', role: 'ADMIN', passwordHash: pw },
  });
  const hr = await prisma.user.create({
    data: { email: 'hr@test.local', employeeId: 'T-0002', name: 'Test HR', role: 'HR', passwordHash: pw },
  });
  const manager = await prisma.user.create({
    data: { email: 'manager@test.local', employeeId: 'T-0003', name: 'Test Manager', role: 'MANAGER', passwordHash: pw },
  });
  const engineer = await prisma.user.create({
    data: { email: 'engineer@test.local', employeeId: 'T-0004', name: 'Test Engineer', role: 'ENGINEER', passwordHash: pw },
  });

  const siteIn = await prisma.projectSite.create({
    data: {
      name: 'Test Site — In Range',
      address: '1 Test Road',
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
  const siteFlag = await prisma.projectSite.create({
    data: {
      name: 'Test Site — Flag Mode',
      address: '2 Test Road',
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

  await prisma.siteAssignment.create({ data: { userId: engineer.id, siteId: siteIn.id } });
  await prisma.siteAssignment.create({ data: { userId: manager.id, siteId: siteIn.id } });
  await prisma.siteAssignment.create({ data: { userId: manager.id, siteId: siteFlag.id } });

  return { admin, hr, manager, engineer, siteIn, siteFlag };
}

export async function loginAs(
  identifier: string,
  password: string = PASSWORD,
): Promise<{ accessToken: string; refreshToken: string; user: { id: string; role: string; name: string; email: string } }> {
  const res = await request(app).post('/api/auth/login').send({ identifier, password });
  if (res.status !== 200) {
    throw new Error(`Fixture login failed (${res.status}): ${JSON.stringify(res.body)}`);
  }
  return res.body;
}

export const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

/** Tiny valid PNG bytes for upload tests (1×1 px). */
export const PNG_1x1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

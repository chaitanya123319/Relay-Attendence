import { AttendanceRecord, ProjectSite } from '@prisma/client';
import { env } from '../config/env';
import { writeAudit } from '../lib/audit';
import { sha256Hex } from '../lib/crypto';
import { badRequest, conflict, forbidden, notFound, unprocessable } from '../lib/errors';
import { formatDistance, haversineMeters } from '../lib/geo';
import { parseJson } from '../lib/json';
import { prisma } from '../lib/prisma';
import { Role } from '../lib/roles';
import { buildStoragePath, storage } from '../lib/storage';
import {
  dateStrInTZ,
  datesInRange,
  isWeeklyOff,
  minutesOfDayInTZ,
  monthDates,
  parseHHMM,
  todayStr,
} from '../lib/time';
import { canViewUserData } from './access.service';
import { notifyManagersForUser } from './notification.service';

// ─────────────────────────────────────────────────────────────────────────────
// Types

export interface AuthUser {
  id: string;
  role: Role;
  name: string;
}

export interface CheckEventInput {
  lat: number;
  lng: number;
  accuracy: number;
  clientTimestamp: string;
  deviceId: string;
  mocked: boolean;
  captureSource?: string;
  siteId?: string;
}

export interface UploadedPhoto {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
}

export interface CheckResult {
  record: ReturnType<typeof toApiRecord>;
  distanceMeters: number;
  flags: string[];
  message: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Anti-fraud pipeline (every rule is server-side)

function assertPhotoSanity(file: UploadedPhoto | undefined, input: CheckEventInput): void {
  if (!file) {
    throw badRequest('PHOTO_REQUIRED', 'A live camera photo is required for every attendance event');
  }
  // The app only ever captures through its in-camera flow; anything else is an upload attempt.
  if (input.captureSource !== 'camera') {
    throw unprocessable(
      'PHOTO_SOURCE_INVALID',
      'Attendance photos must be captured live with the in-app camera (gallery uploads are not accepted)',
    );
  }
  if (input.mocked) {
    throw unprocessable(
      'MOCKED_LOCATION',
      'A mock/spoofed location was detected — attendance cannot be marked with a fake GPS fix',
    );
  }
  if (input.accuracy > env.GPS_ACCURACY_MAX_M) {
    throw unprocessable(
      'LOW_GPS_ACCURACY',
      `GPS accuracy is ±${Math.round(input.accuracy)} m which exceeds the ${env.GPS_ACCURACY_MAX_M} m limit — move to open sky and retry`,
      { accuracy: input.accuracy, maxAllowed: env.GPS_ACCURACY_MAX_M },
    );
  }
}

interface GeofenceOutcome {
  distanceMeters: number;
  outOfRange: boolean;
}

/** Server-side Haversine; REJECT sites throw, FLAG sites annotate. */
function applyGeofence(site: ProjectSite, lat: number, lng: number): GeofenceOutcome {
  const distanceMeters = haversineMeters(lat, lng, site.lat, site.lng);
  const outOfRange = distanceMeters > site.radiusM;
  if (outOfRange && site.outOfRangeBehavior === 'REJECT') {
    throw unprocessable(
      'GEO_OUT_OF_RANGE',
      `You are ${formatDistance(distanceMeters)} from ${site.name} — the allowed radius is ${site.radiusM} m. Attendance was not recorded.`,
      { distanceMeters: Math.round(distanceMeters), allowedRadiusM: site.radiusM },
    );
  }
  return { distanceMeters, outOfRange };
}

function driftFlag(now: Date, clientTimestamp: string): { driftSeconds: number; large: boolean } {
  const driftSeconds = Math.round((Date.parse(clientTimestamp) - now.getTime()) / 1000);
  return { driftSeconds, large: Math.abs(driftSeconds) > env.TIME_DRIFT_MAX_S };
}

async function resolveSiteForEngineer(userId: string, siteId?: string): Promise<ProjectSite> {
  if (siteId) {
    const assignment = await prisma.siteAssignment.findFirst({
      where: { userId, siteId, active: true, site: { isActive: true } },
      include: { site: true },
    });
    if (!assignment) throw forbidden('NOT_ASSIGNED', 'You are not assigned to this project site');
    return assignment.site;
  }
  const assignment = await prisma.siteAssignment.findFirst({
    where: { userId, active: true, site: { isActive: true } },
    include: { site: true },
    orderBy: { createdAt: 'desc' },
  });
  if (!assignment) {
    throw unprocessable('NO_SITE_ASSIGNED', 'No active project site is assigned to you — contact your manager');
  }
  return assignment.site;
}

async function saveCapturePhoto(
  userId: string,
  date: string,
  side: 'in' | 'out',
  file: UploadedPhoto,
): Promise<{ path: string; hash: string }> {
  const hash = sha256Hex(file.buffer);
  const ext = file.mimetype === 'image/png' ? 'png' : 'jpg';
  const rel = buildStoragePath('attendance', userId, `${date}-${side}-${Date.now()}.${ext}`);
  await storage.save(file.buffer, rel);
  return { path: rel, hash };
}

// ─────────────────────────────────────────────────────────────────────────────
// API mapping

const photoEndpoint = (recordId: string, side: 'in' | 'out') =>
  `/api/attendance/${recordId}/photo/${side}`;

export function toApiRecord(record: AttendanceRecord, site?: ProjectSite | null) {
  return {
    id: record.id,
    date: record.date,
    status: record.status,
    flags: parseJson<string[]>(record.flags, []),
    checkIn: {
      time: record.checkInTime.toISOString(),
      lat: record.checkInLat,
      lng: record.checkInLng,
      accuracy: record.checkInAccuracy,
      distanceMeters: Math.round(record.checkInDistanceM),
      photoEndpoint: photoEndpoint(record.id, 'in'),
      photoHash: record.checkInPhotoHash,
    },
    checkOut: record.checkOutTime
      ? {
          time: record.checkOutTime.toISOString(),
          lat: record.checkOutLat,
          lng: record.checkOutLng,
          accuracy: record.checkOutAccuracy,
          distanceMeters: record.checkOutDistanceM === null ? null : Math.round(record.checkOutDistanceM),
          photoEndpoint: photoEndpoint(record.id, 'out'),
          photoHash: record.checkOutPhotoHash,
        }
      : null,
    workedMinutes: record.workedMinutes,
    clientDriftSeconds: record.clientDriftSeconds,
    deviceId: record.deviceId,
    site: site
      ? { id: site.id, name: site.name, lat: site.lat, lng: site.lng, radiusM: site.radiusM }
      : undefined,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Check-in / Check-out

export async function checkIn(
  user: AuthUser,
  input: CheckEventInput,
  file: UploadedPhoto | undefined,
  ip?: string,
): Promise<CheckResult> {
  assertPhotoSanity(file, input);

  const site = await resolveSiteForEngineer(user.id, input.siteId);
  const now = new Date(); // server-authoritative timestamp — client clock is never trusted
  const date = dateStrInTZ(now);

  const existing = await prisma.attendanceRecord.findUnique({
    where: { userId_date: { userId: user.id, date } },
  });
  if (existing) throw conflict('ALREADY_CHECKED_IN', 'You have already checked in today');

  const geo = applyGeofence(site, input.lat, input.lng);
  const flags: string[] = [];
  if (geo.outOfRange) flags.push('OUT_OF_RANGE');

  const drift = driftFlag(now, input.clientTimestamp);
  if (drift.large) flags.push('TIME_DRIFT');

  const photo = await saveCapturePhoto(user.id, date, 'in', file!);

  const isLate =
    minutesOfDayInTZ(now) > parseHHMM(site.shiftStart) + site.lateGraceMinutes;

  const record = await prisma.attendanceRecord.create({
    data: {
      userId: user.id,
      siteId: site.id,
      date,
      checkInTime: now,
      checkInLat: input.lat,
      checkInLng: input.lng,
      checkInAccuracy: input.accuracy,
      checkInDistanceM: geo.distanceMeters,
      checkInPhotoPath: photo.path,
      checkInPhotoHash: photo.hash,
      status: isLate ? 'LATE' : 'PRESENT',
      flags: JSON.stringify(flags),
      clientDriftSeconds: drift.driftSeconds,
      deviceId: input.deviceId,
      checkInIp: ip ?? null,
    },
  });

  await writeAudit({
    actorId: user.id,
    action: 'ATTENDANCE_CHECK_IN',
    entity: 'AttendanceRecord',
    entityId: record.id,
    meta: { siteId: site.id, distanceMeters: Math.round(geo.distanceMeters), flags },
    ip,
  });

  if (geo.outOfRange) {
    await notifyManagersForUser(
      user.id,
      'Attendance flagged',
      `${user.name} checked in ${formatDistance(geo.distanceMeters)} from ${site.name} (flagged OUT_OF_RANGE).`,
      'ATTENDANCE_FLAGGED',
      { recordId: record.id },
    );
  }

  return {
    record: toApiRecord(record, site),
    distanceMeters: Math.round(geo.distanceMeters),
    flags,
    message: isLate ? 'Checked in (late)' : 'Checked in',
  };
}

export async function checkOut(
  user: AuthUser,
  input: CheckEventInput,
  file: UploadedPhoto | undefined,
  ip?: string,
): Promise<CheckResult> {
  assertPhotoSanity(file, input);

  const now = new Date();
  const date = dateStrInTZ(now);

  const record = await prisma.attendanceRecord.findUnique({
    where: { userId_date: { userId: user.id, date } },
    include: { site: true },
  });
  if (!record) throw conflict('CHECK_IN_REQUIRED', 'You have not checked in today — check in before checking out');
  if (record.checkOutTime) throw conflict('ALREADY_CHECKED_OUT', 'You have already checked out today');

  const geo = applyGeofence(record.site, input.lat, input.lng);
  const flags = parseJson<string[]>(record.flags, []);
  if (geo.outOfRange && !flags.includes('OUT_OF_RANGE')) flags.push('OUT_OF_RANGE');

  const drift = driftFlag(now, input.clientTimestamp);
  if (drift.large && !flags.includes('TIME_DRIFT')) flags.push('TIME_DRIFT');

  const photo = await saveCapturePhoto(user.id, date, 'out', file!);
  const workedMinutes = Math.max(0, Math.round((now.getTime() - record.checkInTime.getTime()) / 60000));

  // A short day converts PRESENT/LATE into HALF_DAY; INCOMPLETE is resolved either way.
  let status = record.status === 'INCOMPLETE' ? 'PRESENT' : record.status;
  if (workedMinutes < record.site.halfDayMinutes) status = 'HALF_DAY';

  const updated = await prisma.attendanceRecord.update({
    where: { id: record.id },
    data: {
      checkOutTime: now,
      checkOutLat: input.lat,
      checkOutLng: input.lng,
      checkOutAccuracy: input.accuracy,
      checkOutDistanceM: geo.distanceMeters,
      checkOutPhotoPath: photo.path,
      checkOutPhotoHash: photo.hash,
      workedMinutes,
      status,
      flags: JSON.stringify(flags),
      checkOutIp: ip ?? null,
    },
  });

  await writeAudit({
    actorId: user.id,
    action: 'ATTENDANCE_CHECK_OUT',
    entity: 'AttendanceRecord',
    entityId: record.id,
    meta: { siteId: record.siteId, distanceMeters: Math.round(geo.distanceMeters), workedMinutes, flags },
    ip,
  });

  if (geo.outOfRange) {
    await notifyManagersForUser(
      user.id,
      'Attendance flagged',
      `${user.name} checked out ${formatDistance(geo.distanceMeters)} from ${record.site.name} (flagged OUT_OF_RANGE).`,
      'ATTENDANCE_FLAGGED',
      { recordId: record.id },
    );
  }

  return {
    record: toApiRecord(updated, record.site),
    distanceMeters: Math.round(geo.distanceMeters),
    flags,
    message: status === 'HALF_DAY' ? `Checked out — ${Math.floor(workedMinutes / 60)}h ${workedMinutes % 60}m worked (half-day)` : 'Checked out',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Reads

export async function history(
  userId: string,
  opts: { from?: string; to?: string; page: number; pageSize: number },
) {
  const where = {
    userId,
    ...(opts.from || opts.to
      ? {
          date: {
            ...(opts.from ? { gte: opts.from } : {}),
            ...(opts.to ? { lte: opts.to } : {}),
          },
        }
      : {}),
  };

  const [total, items] = await Promise.all([
    prisma.attendanceRecord.count({ where }),
    prisma.attendanceRecord.findMany({
      where,
      include: { site: true },
      orderBy: { date: 'desc' },
      skip: (opts.page - 1) * opts.pageSize,
      take: opts.pageSize,
    }),
  ]);

  return {
    items: items.map((r) => toApiRecord(r, r.site)),
    total,
    page: opts.page,
    pageSize: opts.pageSize,
  };
}

export async function monthlySummary(userId: string, month?: string) {
  const m = month ?? todayStr().slice(0, 7);
  const dates = monthDates(m);
  const first = dates[0];
  const last = dates[dates.length - 1];
  const today = todayStr();

  const [records, leaves] = await Promise.all([
    prisma.attendanceRecord.findMany({ where: { userId, date: { gte: first, lte: last } } }),
    prisma.leaveRequest.findMany({
      where: { userId, status: 'APPROVED', fromDate: { lte: last }, toDate: { gte: first } },
      include: { leaveType: true },
    }),
  ]);

  const recordByDate = new Map(records.map((r) => [r.date, r]));
  const leaveByDate = new Map<string, string>(); // date → leave type name
  for (const lv of leaves) {
    const from = lv.fromDate > first ? lv.fromDate : first;
    const to = lv.toDate < last ? lv.toDate : last;
    for (const d of datesInRange(from, to)) leaveByDate.set(d, lv.leaveType.name);
  }

  const days: Array<{
    date: string;
    status: string;
    checkInAt: string | null;
    checkOutAt: string | null;
    workedMinutes: number | null;
    leaveType?: string;
  }> = [];

  const summary = {
    present: 0,
    late: 0,
    halfDay: 0,
    incomplete: 0,
    absent: 0,
    onLeave: 0,
    weeklyOff: 0,
    totalWorkedMinutes: 0,
  };

  for (const d of dates) {
    const record = recordByDate.get(d);
    if (record) {
      // Approved half-day leave + worked half-day still shows the worked row.
      if (record.status === 'LATE') summary.late++;
      else if (record.status === 'HALF_DAY') summary.halfDay++;
      else if (record.status === 'INCOMPLETE') summary.incomplete++;
      else summary.present++;
      summary.totalWorkedMinutes += record.workedMinutes ?? 0;
      days.push({
        date: d,
        status: record.status,
        checkInAt: record.checkInTime.toISOString(),
        checkOutAt: record.checkOutTime?.toISOString() ?? null,
        workedMinutes: record.workedMinutes,
      });
      continue;
    }
    const leaveType = leaveByDate.get(d);
    if (leaveType) {
      summary.onLeave++;
      days.push({ date: d, status: 'ON_LEAVE', checkInAt: null, checkOutAt: null, workedMinutes: null, leaveType });
      continue;
    }
    if (isWeeklyOff(d)) {
      summary.weeklyOff++;
      days.push({ date: d, status: 'WEEKLY_OFF', checkInAt: null, checkOutAt: null, workedMinutes: null });
      continue;
    }
    if (d <= today) {
      summary.absent++;
      days.push({ date: d, status: 'ABSENT', checkInAt: null, checkOutAt: null, workedMinutes: null });
      continue;
    }
    days.push({ date: d, status: 'UPCOMING', checkInAt: null, checkOutAt: null, workedMinutes: null });
  }

  return { month: m, summary, days };
}

/** Manager/HR/Admin board: who is on site today with status + photos + leave overlay. */
export async function teamBoard(
  viewer: AuthUser,
  date: string,
  siteId?: string,
): Promise<{ date: string; items: unknown[] }> {
  let scope: string[] | null = null; // null = all sites (ADMIN/HR)
  if (viewer.role === 'MANAGER') {
    const { managedSiteIds } = await import('./access.service');
    scope = await managedSiteIds(viewer.id);
    if (scope.length === 0) return { date, items: [] };
  }

  const siteFilter = siteId ? [siteId] : scope ?? undefined;

  const assignments = await prisma.siteAssignment.findMany({
    where: {
      active: true,
      ...(siteFilter ? { siteId: { in: siteFilter } } : {}),
      user: { role: 'ENGINEER', isActive: true },
    },
    include: { user: true, site: true },
  });

  const byUser = new Map<string, (typeof assignments)[number]>();
  for (const a of assignments) if (!byUser.has(a.userId)) byUser.set(a.userId, a);
  const userIds = [...byUser.keys()];

  const [records, leaves] = await Promise.all([
    userIds.length
      ? prisma.attendanceRecord.findMany({ where: { date, userId: { in: userIds } }, include: { site: true } })
      : Promise.resolve([]),
    userIds.length
      ? prisma.leaveRequest.findMany({
          where: { userId: { in: userIds }, status: 'APPROVED', fromDate: { lte: date }, toDate: { gte: date } },
          include: { leaveType: true },
        })
      : Promise.resolve([]),
  ]);

  const recordByUser = new Map(records.map((r) => [r.userId, r]));
  const leaveByUser = new Map(leaves.map((l) => [l.userId, l]));
  const today = todayStr();

  const items = [...byUser.values()].map((a) => {
    const record = recordByUser.get(a.userId);
    const leave = leaveByUser.get(a.userId);
    const status = record
      ? record.status
      : leave
        ? 'ON_LEAVE'
        : date < today
          ? 'ABSENT'
          : date === today
            ? 'NOT_CHECKED_IN'
            : 'UPCOMING';
    return {
      user: { id: a.user.id, name: a.user.name, employeeId: a.user.employeeId, phone: a.user.phone },
      site: { id: a.site.id, name: a.site.name, lat: a.site.lat, lng: a.site.lng, radiusM: a.site.radiusM },
      record: record ? toApiRecord(record, record.site) : null,
      leaveType: leave?.leaveType.name ?? null,
      status,
    };
  });

  return { date, items };
}

export async function getRecordForViewer(recordId: string, viewer: AuthUser) {
  const record = await prisma.attendanceRecord.findUnique({
    where: { id: recordId },
    include: { site: true, user: true },
  });
  if (!record) throw notFound('RECORD_NOT_FOUND', 'Attendance record not found');

  const allowed = await canViewUserData(viewer, record.userId);
  if (!allowed) throw forbidden('FORBIDDEN', 'You can only view attendance of your own team');

  return {
    ...toApiRecord(record, record.site),
    user: { id: record.user.id, name: record.user.name, employeeId: record.user.employeeId },
  };
}

/** Locate the photo file for streaming; authorization is the caller's job. */
export async function loadPhotoTarget(recordId: string, side: 'in' | 'out') {
  const record = await prisma.attendanceRecord.findUnique({
    where: { id: recordId },
    select: { userId: true, checkInPhotoPath: true, checkOutPhotoPath: true, date: true },
  });
  if (!record) throw notFound('RECORD_NOT_FOUND', 'Attendance record not found');

  const path = side === 'in' ? record.checkInPhotoPath : record.checkOutPhotoPath;
  if (!path) throw notFound('PHOTO_NOT_FOUND', `No ${side === 'in' ? 'check-in' : 'check-out'} photo on this record`);
  if (!(await storage.exists(path))) throw notFound('PHOTO_MISSING', 'Photo file is missing from storage');

  return { path, userId: record.userId };
}

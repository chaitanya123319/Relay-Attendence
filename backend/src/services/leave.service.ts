import { LeaveRequest, LeaveType } from '@prisma/client';
import { writeAudit } from '../lib/audit';
import { conflict, forbidden, notFound, unprocessable } from '../lib/errors';
import { prisma } from '../lib/prisma';
import { LeaveStatus } from '../lib/roles';
import { buildStoragePath, storage } from '../lib/storage';
import { addDays, diffDays, todayStr } from '../lib/time';
import { canViewUserData, managedSiteIds, Viewer } from './access.service';
import { notifyManagersForUser, notifyUser } from './notification.service';

// ─────────────────────────────────────────────────────────────────────────────
// Types

export interface LeaveActor {
  id: string;
  role: Viewer['role'];
  name: string;
}

export interface ApplyLeaveInput {
  leaveTypeId: string;
  fromDate: string;
  toDate: string;
  isHalfDay: boolean;
  halfDayPeriod?: 'AM' | 'PM';
  reason: string;
}

export interface UploadedDocument {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers

export function countLeaveDays(fromDate: string, toDate: string, isHalfDay: boolean): number {
  if (isHalfDay) return 0.5;
  return diffDays(fromDate, toDate) + 1;
}

async function getLeaveTypeOr404(id: string): Promise<LeaveType> {
  const type = await prisma.leaveType.findUnique({ where: { id } });
  if (!type || !type.isActive) throw notFound('LEAVE_TYPE_NOT_FOUND', 'Leave type not found');
  return type;
}

/** available = allocated − used(approved) − pending(reserved). See DECISIONS.md #7.
 *  `excludePendingRequestId` lets an approval exclude the request being decided
 *  (its own reservation must not count against itself). */
export async function availableBalance(
  userId: string,
  leaveTypeId: string,
  year: number,
  opts: { excludePendingRequestId?: string } = {},
) {
  const [balance, pendingAgg] = await Promise.all([
    prisma.leaveBalance.findUnique({
      where: { userId_leaveTypeId_year: { userId, leaveTypeId, year } },
    }),
    prisma.leaveRequest.aggregate({
      where: {
        userId,
        leaveTypeId,
        status: 'PENDING',
        ...(opts.excludePendingRequestId ? { NOT: { id: opts.excludePendingRequestId } } : {}),
        fromDate: { gte: `${year}-01-01` },
        toDate: { lte: `${year}-12-31` },
      },
      _sum: { days: true },
    }),
  ]);
  const allocated = balance?.allocated ?? 0;
  const used = balance?.used ?? 0;
  const pending = pendingAgg._sum.days ?? 0;
  return { allocated, used, pending, available: round2(allocated - used - pending) };
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Ensures a balance row exists for the type/year (auto-allocates the annual quota). */
async function ensureBalance(userId: string, type: LeaveType, year: number) {
  const existing = await prisma.leaveBalance.findUnique({
    where: { userId_leaveTypeId_year: { userId, leaveTypeId: type.id, year } },
  });
  if (existing) return existing;
  return prisma.leaveBalance.create({
    data: { userId, leaveTypeId: type.id, year, allocated: type.annualQuota, used: 0 },
  });
}

/** Engineers whose sites the manager manages (approval-queue scope). */
async function engineerIdsForManager(managerId: string): Promise<string[]> {
  const siteIds = await managedSiteIds(managerId);
  if (siteIds.length === 0) return [];
  const rows = await prisma.siteAssignment.findMany({
    where: { active: true, siteId: { in: siteIds }, user: { role: 'ENGINEER', isActive: true } },
    select: { userId: true },
  });
  return [...new Set(rows.map((r) => r.userId))];
}

// ─────────────────────────────────────────────────────────────────────────────
// API mapping

type FullRequest = LeaveRequest & {
  leaveType: LeaveType;
  documents: { id: string; originalName: string; mime: string; size: number }[];
  user?: { id: string; name: string; employeeId: string } | null;
  decidedBy?: { id: string; name: string } | null;
};

export function toApiLeave(r: FullRequest) {
  return {
    id: r.id,
    fromDate: r.fromDate,
    toDate: r.toDate,
    days: r.days,
    isHalfDay: r.isHalfDay,
    halfDayPeriod: r.halfDayPeriod,
    reason: r.reason,
    status: r.status,
    decisionComment: r.decisionComment,
    decidedAt: r.decidedAt?.toISOString() ?? null,
    decidedBy: r.decidedBy ? { id: r.decidedBy.id, name: r.decidedBy.name } : null,
    createdAt: r.createdAt.toISOString(),
    leaveType: { id: r.leaveType.id, code: r.leaveType.code, name: r.leaveType.name, paid: r.leaveType.paid },
    documents: r.documents.map((d) => ({
      id: d.id,
      originalName: d.originalName,
      mime: d.mime,
      size: d.size,
      endpoint: `/api/leave/documents/${d.id}`,
    })),
    ...(r.user ? { user: r.user } : {}),
  };
}

const fullInclude = {
  leaveType: true,
  documents: { select: { id: true, originalName: true, mime: true, size: true } },
  user: { select: { id: true, name: true, employeeId: true } },
  decidedBy: { select: { id: true, name: true } },
} as const;

async function loadFull(id: string): Promise<FullRequest> {
  const request = await prisma.leaveRequest.findUnique({ where: { id }, include: fullInclude });
  if (!request) throw notFound('LEAVE_NOT_FOUND', 'Leave request not found');
  return request;
}

// ─────────────────────────────────────────────────────────────────────────────
// Commands

export async function applyLeave(
  actor: LeaveActor,
  input: ApplyLeaveInput,
  file: UploadedDocument | undefined,
  ip?: string,
) {
  const type = await getLeaveTypeOr404(input.leaveTypeId);

  // ── Validation rules
  if (diffDays(input.fromDate, input.toDate) < 0) {
    throw unprocessable('BAD_RANGE', 'fromDate must be on or before toDate');
  }
  if (input.isHalfDay && input.fromDate !== input.toDate) {
    throw unprocessable('HALF_DAY_RANGE', 'A half-day request must be for a single date');
  }
  if (input.isHalfDay && !type.allowHalfDay) {
    throw unprocessable('HALF_DAY_NOT_ALLOWED', `${type.name} does not allow half-day requests`);
  }
  const days = countLeaveDays(input.fromDate, input.toDate, input.isHalfDay);

  const today = todayStr();
  const earliest = addDays(today, -type.minNoticeDays);
  if (input.fromDate < earliest) {
    throw unprocessable(
      'PAST_DATE',
      `${type.name} can only be applied for dates from ${earliest} onwards (applied for ${input.fromDate})`,
    );
  }
  if (type.maxConsecutiveDays !== null && days > type.maxConsecutiveDays) {
    throw unprocessable(
      'TOO_LONG',
      `${type.name} is limited to ${type.maxConsecutiveDays} consecutive day(s) per request`,
    );
  }
  if (type.requiresDocument && !file) {
    throw unprocessable('DOCUMENT_REQUIRED', `${type.name} requires a supporting document`);
  }

  // ── Overlap with own pending/approved requests
  const overlap = await prisma.leaveRequest.findFirst({
    where: {
      userId: actor.id,
      status: { in: ['PENDING', 'APPROVED'] },
      fromDate: { lte: input.toDate },
      toDate: { gte: input.fromDate },
    },
    include: { leaveType: true },
  });
  if (overlap) {
    throw conflict(
      'LEAVE_OVERLAP',
      `These dates overlap your ${overlap.status.toLowerCase()} ${overlap.leaveType.name} request (${overlap.fromDate} → ${overlap.toDate})`,
    );
  }

  // ── Balance (reservation model)
  const year = Number(input.fromDate.slice(0, 4));
  await ensureBalance(actor.id, type, year);
  const balance = await availableBalance(actor.id, type.id, year);
  if (balance.available < days) {
    throw unprocessable(
      'INSUFFICIENT_BALANCE',
      `Insufficient ${type.name}: ${balance.available} day(s) available, ${days} requested`,
      { available: balance.available, requested: days },
    );
  }

  const request = await prisma.leaveRequest.create({
    data: {
      userId: actor.id,
      leaveTypeId: type.id,
      fromDate: input.fromDate,
      toDate: input.toDate,
      days,
      isHalfDay: input.isHalfDay,
      halfDayPeriod: input.isHalfDay ? (input.halfDayPeriod ?? 'AM') : null,
      reason: input.reason,
      status: 'PENDING',
    },
  });

  if (file) {
    const safeName = file.originalname.replace(/[^\w.-]+/g, '_').slice(-80);
    const rel = await storage.save(file.buffer, buildStoragePath('leave', actor.id, `${request.id}-${safeName}`));
    await prisma.leaveDocument.create({
      data: { requestId: request.id, path: rel, originalName: file.originalname, mime: file.mimetype, size: file.size },
    });
  }

  await writeAudit({
    actorId: actor.id,
    action: 'LEAVE_APPLY',
    entity: 'LeaveRequest',
    entityId: request.id,
    meta: { code: type.code, fromDate: input.fromDate, toDate: input.toDate, days },
    ip,
  });

  const span =
    input.fromDate === input.toDate ? input.fromDate : `${input.fromDate} → ${input.toDate}`;
  await notifyManagersForUser(
    actor.id,
    'New leave request',
    `${actor.name} requested ${days} day(s) ${type.name} (${span}).`,
    'LEAVE_SUBMITTED',
    { requestId: request.id },
  );
  await notifyUser({
    userId: actor.id,
    title: 'Leave request submitted',
    body: `Your ${type.name} request for ${span} is pending approval.`,
    type: 'LEAVE_SUBMITTED',
    data: { requestId: request.id },
  });

  return toApiLeave(await loadFull(request.id));
}

export async function decideLeave(
  actor: LeaveActor,
  requestId: string,
  decision: 'APPROVE' | 'REJECT',
  comment: string | undefined,
  ip?: string,
) {
  const request = await prisma.leaveRequest.findUnique({
    where: { id: requestId },
    include: { leaveType: true },
  });
  if (!request) throw notFound('LEAVE_NOT_FOUND', 'Leave request not found');
  if (request.status !== 'PENDING') {
    throw conflict('NOT_PENDING', `This request is already ${request.status.toLowerCase()}`);
  }
  if (actor.id === request.userId) {
    throw forbidden('SELF_DECISION', 'You cannot decide your own leave request');
  }
  // Manager scope: shared site required; HR/Admin company-wide; enforced centrally.
  if (!(await canViewUserData(actor, request.userId))) {
    throw forbidden('FORBIDDEN', 'This leave request is outside your team');
  }

  if (decision === 'REJECT' && !comment?.trim()) {
    throw unprocessable('COMMENT_REQUIRED', 'A comment is required when rejecting a leave request');
  }

  if (decision === 'APPROVE') {
    // Re-check availability at decision time (other requests may have consumed it).
    // The request being approved is excluded — its own reservation is what we're consuming.
    const year = Number(request.fromDate.slice(0, 4));
    await ensureBalance(request.userId, request.leaveType, year);
    const balance = await availableBalance(request.userId, request.leaveTypeId, year, {
      excludePendingRequestId: request.id,
    });
    if (balance.available < request.days) {
      throw unprocessable(
        'INSUFFICIENT_BALANCE',
        `Cannot approve: ${balance.available} day(s) available, ${request.days} requested`,
        { available: balance.available, requested: request.days },
      );
    }
    // Approval consumes the reservation → moves into `used` (deducts balance).
    await prisma.$transaction([
      prisma.leaveBalance.update({
        where: {
          userId_leaveTypeId_year: { userId: request.userId, leaveTypeId: request.leaveTypeId, year },
        },
        data: { used: { increment: request.days } },
      }),
      prisma.leaveRequest.update({
        where: { id: requestId },
        data: {
          status: 'APPROVED',
          decidedById: actor.id,
          decisionComment: comment?.trim() || null,
          decidedAt: new Date(),
        },
      }),
    ]);
  } else {
    // Rejection releases the reservation (availability restored without touching `used`).
    await prisma.leaveRequest.update({
      where: { id: requestId },
      data: {
        status: 'REJECTED',
        decidedById: actor.id,
        decisionComment: comment!.trim(),
        decidedAt: new Date(),
      },
    });
  }

  await writeAudit({
    actorId: actor.id,
    action: decision === 'APPROVE' ? 'LEAVE_APPROVE' : 'LEAVE_REJECT',
    entity: 'LeaveRequest',
    entityId: requestId,
    meta: { days: request.days, code: request.leaveType.code, comment: comment ?? null },
    ip,
  });

  await notifyUser({
    userId: request.userId,
    title: decision === 'APPROVE' ? 'Leave approved' : 'Leave rejected',
    body:
      decision === 'APPROVE'
        ? `Your ${request.leaveType.name} (${request.fromDate} → ${request.toDate}) was approved by ${actor.name}.`
        : `Your ${request.leaveType.name} (${request.fromDate} → ${request.toDate}) was rejected: "${comment!.trim()}"`,
    type: decision === 'APPROVE' ? 'LEAVE_APPROVED' : 'LEAVE_REJECTED',
    data: { requestId },
  });

  return toApiLeave(await loadFull(requestId));
}

export async function cancelLeave(actor: LeaveActor, requestId: string, ip?: string) {
  const request = await prisma.leaveRequest.findUnique({
    where: { id: requestId },
    include: { leaveType: true },
  });
  if (!request) throw notFound('LEAVE_NOT_FOUND', 'Leave request not found');
  if (request.userId !== actor.id) throw forbidden('FORBIDDEN', 'You can only cancel your own requests');
  if (request.status !== 'PENDING') {
    throw conflict('NOT_PENDING', `Only pending requests can be cancelled (this one is ${request.status.toLowerCase()})`);
  }

  await prisma.leaveRequest.update({
    where: { id: requestId },
    data: { status: 'CANCELLED' },
  });

  await writeAudit({
    actorId: actor.id,
    action: 'LEAVE_CANCEL',
    entity: 'LeaveRequest',
    entityId: requestId,
    meta: { days: request.days },
    ip,
  });

  await notifyManagersForUser(
    actor.id,
    'Leave request cancelled',
    `${actor.name} cancelled their ${request.leaveType.name} request (${request.fromDate} → ${request.toDate}).`,
    'LEAVE_CANCELLED',
    { requestId },
  );

  return toApiLeave(await loadFull(requestId));
}

// ─────────────────────────────────────────────────────────────────────────────
// Queries

export async function listMine(userId: string, status?: LeaveStatus) {
  const rows = await prisma.leaveRequest.findMany({
    where: { userId, ...(status ? { status } : {}) },
    include: fullInclude,
    orderBy: { createdAt: 'desc' },
  });
  return rows.map(toApiLeave);
}

export async function approvalQueue(
  viewer: LeaveActor,
  opts: { status?: LeaveStatus; userId?: string },
) {
  let scopeIds: string[] | null = null;
  if (viewer.role === 'MANAGER') {
    scopeIds = await engineerIdsForManager(viewer.id);
    if (scopeIds.length === 0) return [];
  }

  const rows = await prisma.leaveRequest.findMany({
    where: {
      ...(opts.status ? { status: opts.status } : { status: { in: ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'] } }),
      ...(opts.userId ? { userId: opts.userId } : {}),
      ...(scopeIds ? { userId: { in: scopeIds } } : {}),
    },
    include: fullInclude,
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
  });
  return rows.map(toApiLeave);
}

export async function myBalances(userId: string, year?: number) {
  const y = year ?? Number(todayStr().slice(0, 4));
  const types = await prisma.leaveType.findMany({ where: { isActive: true }, orderBy: { code: 'asc' } });
  const rows = await Promise.all(
    types.map(async (t) => {
      const bal = await availableBalance(userId, t.id, y);
      return {
        year: y,
        leaveType: { id: t.id, code: t.code, name: t.name, paid: t.paid },
        allocated: bal.allocated,
        used: bal.used,
        pending: bal.pending,
        available: bal.available,
      };
    }),
  );
  return rows;
}

export async function setAllocation(
  actor: LeaveActor,
  input: { userId: string; leaveTypeId: string; year: number; allocated: number },
  ip?: string,
) {
  await getLeaveTypeOr404(input.leaveTypeId);
  const user = await prisma.user.findUnique({ where: { id: input.userId } });
  if (!user) throw notFound('USER_NOT_FOUND', 'User not found');

  const balance = await prisma.leaveBalance.upsert({
    where: {
      userId_leaveTypeId_year: { userId: input.userId, leaveTypeId: input.leaveTypeId, year: input.year },
    },
    create: { userId: input.userId, leaveTypeId: input.leaveTypeId, year: input.year, allocated: input.allocated, used: 0 },
    update: { allocated: input.allocated },
  });

  await writeAudit({
    actorId: actor.id,
    action: 'BALANCE_ADJUST',
    entity: 'LeaveBalance',
    entityId: balance.id,
    meta: { ...input },
    ip,
  });
  return balance;
}

// ─────────────────────────────────────────────────────────────────────────────
// Documents

export async function assertDocumentAccessByViewer(viewer: Viewer, documentId: string) {
  const doc = await prisma.leaveDocument.findUnique({
    where: { id: documentId },
    include: { request: { select: { userId: true } } },
  });
  if (!doc) throw notFound('DOCUMENT_NOT_FOUND', 'Document not found');
  if (viewer.id !== doc.request.userId && !(await canViewUserData(viewer, doc.request.userId))) {
    throw forbidden('FORBIDDEN', 'You cannot access this document');
  }
  return doc;
}

export async function loadDocumentTarget(documentId: string) {
  const doc = await prisma.leaveDocument.findUnique({ where: { id: documentId } });
  if (!doc) throw notFound('DOCUMENT_NOT_FOUND', 'Document not found');
  if (!(await storage.exists(doc.path))) throw notFound('DOCUMENT_MISSING', 'Document file is missing from storage');
  return { path: doc.path, mime: doc.mime, originalName: doc.originalName, requestId: doc.requestId };
}

import { Router } from 'express';
import { asyncHandler } from '../lib/errors';
import { prisma } from '../lib/prisma';
import { storage } from '../lib/storage';
import { authenticate, requireRole } from '../middleware/auth';
import { documentUpload } from '../middleware/upload';
import { parseOrThrow, validate } from '../middleware/validate';
import {
  allocationSchema,
  applyLeaveSchema,
  balancesQuerySchema,
  decisionSchema,
  idParamsSchema,
  leaveTypeCreateSchema,
  leaveTypeUpdateSchema,
  mineQuerySchema,
  queueQuerySchema,
  rejectSchema,
} from '../schemas/leave.schema';
import * as leaveService from '../services/leave.service';

export const leaveRouter = Router();
leaveRouter.use(authenticate);

// ── Leave types ──────────────────────────────────────────────────────────────
leaveRouter.get(
  '/types',
  asyncHandler(async (req, res) => {
    const all = req.user!.role === 'ADMIN';
    res.json(
      await prisma.leaveType.findMany({
        where: all ? {} : { isActive: true },
        orderBy: { code: 'asc' },
      }),
    );
  }),
);

leaveRouter.post(
  '/types',
  requireRole('ADMIN'),
  validate(leaveTypeCreateSchema),
  asyncHandler(async (req, res) => {
    const created = await prisma.leaveType.create({ data: req.body as never });
    res.status(201).json(created);
  }),
);

leaveRouter.patch(
  '/types/:id',
  requireRole('ADMIN'),
  validate(leaveTypeUpdateSchema),
  asyncHandler(async (req, res) => {
    const updated = await prisma.leaveType.update({
      where: { id: req.params.id },
      data: req.body as never,
    });
    res.json(updated);
  }),
);

// ── Engineer: apply / list / cancel ──────────────────────────────────────────
leaveRouter.post(
  '/requests',
  requireRole('ENGINEER'),
  documentUpload,
  validate(applyLeaveSchema),
  asyncHandler(async (req, res) => {
    const result = await leaveService.applyLeave(req.user!, req.body as never, req.file, req.ip);
    res.status(201).json(result);
  }),
);

leaveRouter.get(
  '/requests/me',
  requireRole('ENGINEER'),
  asyncHandler(async (req, res) => {
    const q = parseOrThrow(mineQuerySchema, req.query);
    res.json(await leaveService.listMine(req.user!.id, q.status));
  }),
);

leaveRouter.post(
  '/requests/:id/cancel',
  requireRole('ENGINEER'),
  asyncHandler(async (req, res) => {
    res.json(await leaveService.cancelLeave(req.user!, req.params.id, req.ip));
  }),
);

// ── Manager / HR / Admin: queue + decisions ─────────────────────────────────
leaveRouter.get(
  '/requests',
  requireRole('MANAGER', 'HR', 'ADMIN'),
  asyncHandler(async (req, res) => {
    const q = parseOrThrow(queueQuerySchema, req.query);
    res.json(await leaveService.approvalQueue(req.user!, q));
  }),
);

leaveRouter.post(
  '/requests/:id/approve',
  requireRole('MANAGER', 'HR', 'ADMIN'),
  validate(decisionSchema),
  asyncHandler(async (req, res) => {
    const { comment } = req.body as { comment?: string };
    res.json(await leaveService.decideLeave(req.user!, req.params.id, 'APPROVE', comment, req.ip));
  }),
);

leaveRouter.post(
  '/requests/:id/reject',
  requireRole('MANAGER', 'HR', 'ADMIN'),
  validate(rejectSchema),
  asyncHandler(async (req, res) => {
    const { comment } = req.body as { comment: string };
    res.json(await leaveService.decideLeave(req.user!, req.params.id, 'REJECT', comment, req.ip));
  }),
);

// ── Balances ─────────────────────────────────────────────────────────────────
leaveRouter.get(
  '/balances/me',
  requireRole('ENGINEER'),
  asyncHandler(async (req, res) => {
    const year = req.query.year ? Number(req.query.year) : undefined;
    res.json(await leaveService.myBalances(req.user!.id, year));
  }),
);

leaveRouter.get(
  '/balances',
  requireRole('HR', 'ADMIN'),
  asyncHandler(async (req, res) => {
    const q = parseOrThrow(balancesQuerySchema, req.query);
    res.json(await leaveService.myBalances(q.userId, q.year));
  }),
);

leaveRouter.post(
  '/balances/adjust',
  requireRole('HR', 'ADMIN'),
  validate(allocationSchema),
  asyncHandler(async (req, res) => {
    res.json(await leaveService.setAllocation(req.user!, req.body as never, req.ip));
  }),
);

// ── Supporting documents ─────────────────────────────────────────────────────
leaveRouter.get(
  '/documents/:id',
  asyncHandler(async (req, res) => {
    const { id } = parseOrThrow(idParamsSchema, req.params);
    await leaveService.assertDocumentAccessByViewer(req.user!, id);
    const doc = await leaveService.loadDocumentTarget(id);
    res.setHeader('Content-Type', doc.mime);
    res.setHeader('Content-Disposition', `inline; filename="${doc.originalName.replace(/["\r\n]/g, '')}"`);
    res.setHeader('Cache-Control', 'private, max-age=300');
    storage.read(doc.path).pipe(res);
  }),
);

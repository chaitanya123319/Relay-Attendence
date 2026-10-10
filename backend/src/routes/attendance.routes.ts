import { Router } from 'express';
import { asyncHandler, forbidden } from '../lib/errors';
import { storage, mimeFromPath } from '../lib/storage';
import { todayStr } from '../lib/time';
import { authenticate, requireRole } from '../middleware/auth';
import { photoUpload } from '../middleware/upload';
import { parseOrThrow, validate } from '../middleware/validate';
import {
  checkEventSchema,
  historyQuerySchema,
  photoParamsSchema,
  summaryQuerySchema,
  teamQuerySchema,
  type CheckEventInput,
} from '../schemas/attendance.schema';
import { canViewUserData } from '../services/access.service';
import * as attendanceService from '../services/attendance.service';

export const attendanceRouter = Router();
attendanceRouter.use(authenticate);

// ── Engineer: mark attendance ────────────────────────────────────────────────
attendanceRouter.post(
  '/check-in',
  requireRole('ENGINEER'),
  photoUpload,
  validate(checkEventSchema),
  asyncHandler(async (req, res) => {
    const result = await attendanceService.checkIn(
      req.user!,
      req.body as unknown as CheckEventInput,
      req.file,
      req.ip,
    );
    res.status(201).json(result);
  }),
);

attendanceRouter.post(
  '/check-out',
  requireRole('ENGINEER'),
  photoUpload,
  validate(checkEventSchema),
  asyncHandler(async (req, res) => {
    const result = await attendanceService.checkOut(
      req.user!,
      req.body as unknown as CheckEventInput,
      req.file,
      req.ip,
    );
    res.json(result);
  }),
);

// ── Engineer: own history & summary ─────────────────────────────────────────
attendanceRouter.get(
  '/me',
  requireRole('ENGINEER'),
  asyncHandler(async (req, res) => {
    const q = parseOrThrow(historyQuerySchema, req.query);
    res.json(await attendanceService.history(req.user!.id, q));
  }),
);

attendanceRouter.get(
  '/me/summary',
  requireRole('ENGINEER'),
  asyncHandler(async (req, res) => {
    const q = parseOrThrow(summaryQuerySchema, req.query);
    res.json(await attendanceService.monthlySummary(req.user!.id, q.month));
  }),
);

// ── Manager / HR / Admin: team board ────────────────────────────────────────
attendanceRouter.get(
  '/team',
  requireRole('MANAGER', 'HR', 'ADMIN'),
  asyncHandler(async (req, res) => {
    const q = parseOrThrow(teamQuerySchema, req.query);
    res.json(await attendanceService.teamBoard(req.user!, q.date ?? todayStr(), q.siteId));
  }),
);

// ── Record detail + photo streaming ─────────────────────────────────────────
attendanceRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    res.json(await attendanceService.getRecordForViewer(req.params.id, req.user!));
  }),
);

attendanceRouter.get(
  '/:id/photo/:side',
  asyncHandler(async (req, res) => {
    const { id, side } = parseOrThrow(photoParamsSchema, req.params);
    const target = await attendanceService.loadPhotoTarget(id, side);
    if (!(await canViewUserData(req.user!, target.userId))) {
      throw forbidden('FORBIDDEN', 'You can only view photos of your own team');
    }
    res.setHeader('Content-Type', mimeFromPath(target.path));
    res.setHeader('Cache-Control', 'private, max-age=300');
    storage.read(target.path).pipe(res);
  }),
);

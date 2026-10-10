import { Request, Router } from 'express';
import { asyncHandler, badRequest, forbidden, notFound } from '../lib/errors';
import { createSignedUrl, verifySignedUrl } from '../lib/signed-url';
import { mimeFromPath, storage } from '../lib/storage';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { signedUrlSchema } from '../schemas/attendance.schema';
import { canViewUserData } from '../services/access.service';
import * as attendanceService from '../services/attendance.service';

export const uploadsRouter = Router();

const baseUrl = (req: Request) => `${req.protocol}://${req.get('host')}`;

const ATTENDANCE_PHOTO_RE = /^\/api\/attendance\/([^/?]+)\/photo\/(in|out)$/;
const LEAVE_DOC_RE = /^\/api\/leave\/documents\/([^/?]+)$/;

/**
 * POST /api/uploads/signed-url — exchange an authenticated session for an
 * expiring signed URL (used by dashboard <img> tags and PDF exports).
 * Only paths the caller may already read can be signed.
 */
uploadsRouter.post(
  '/signed-url',
  authenticate,
  validate(signedUrlSchema),
  asyncHandler(async (req, res) => {
    const { path: p } = req.body as { path: string };

    const att = p.match(ATTENDANCE_PHOTO_RE);
    if (att) {
      const target = await attendanceService.loadPhotoTarget(att[1], att[2] as 'in' | 'out');
      if (!(await canViewUserData(req.user!, target.userId))) {
        throw forbidden('FORBIDDEN', 'You cannot sign a URL for this photo');
      }
    } else if (LEAVE_DOC_RE.test(p)) {
      const leaveService = await import('../services/leave.service');
      await leaveService.assertDocumentAccessByViewer(req.user!, p.match(LEAVE_DOC_RE)![1]);
    } else {
      throw badRequest('UNSIGNED_PATH', 'This path cannot be signed');
    }

    res.json(createSignedUrl(p, baseUrl(req)));
  }),
);

/**
 * GET /api/uploads/signed?p=…&e=…&s=… — streams the target without an auth
 * header; the HMAC signature (constant-time verified) is the credential.
 */
uploadsRouter.get(
  '/signed',
  asyncHandler(async (req, res) => {
    const p = String(req.query.p ?? '');
    const e = String(req.query.e ?? '');
    const s = String(req.query.s ?? '');

    const verification = verifySignedUrl(p, e, s);
    if (!verification.ok) {
      throw forbidden('SIGNATURE_INVALID', `Signed URL rejected (${verification.reason})`);
    }

    const att = p.match(ATTENDANCE_PHOTO_RE);
    if (att) {
      const target = await attendanceService.loadPhotoTarget(att[1], att[2] as 'in' | 'out');
      res.setHeader('Content-Type', mimeFromPath(target.path));
      res.setHeader('Cache-Control', 'private, max-age=300');
      storage.read(target.path).pipe(res);
      return;
    }

    const lv = p.match(LEAVE_DOC_RE);
    if (lv) {
      const leaveService = await import('../services/leave.service');
      const doc = await leaveService.loadDocumentTarget(lv[1]);
      res.setHeader('Content-Type', doc.mime);
      res.setHeader('Cache-Control', 'private, max-age=300');
      storage.read(doc.path).pipe(res);
      return;
    }

    throw notFound('NOT_FOUND', 'Unknown signed path');
  }),
);

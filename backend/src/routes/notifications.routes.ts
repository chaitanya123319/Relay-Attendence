import { Router } from 'express';
import { asyncHandler } from '../lib/errors';
import { authenticate } from '../middleware/auth';
import { parseOrThrow, validate } from '../middleware/validate';
import { pushTokenSchema } from '../schemas/user.schema';
import * as notificationService from '../services/notification.service';
import { z } from 'zod';
import { prisma } from '../lib/prisma';

export const notificationsRouter = Router();
notificationsRouter.use(authenticate);

const unreadQuery = z.object({
  unreadOnly: z
    .union([z.boolean(), z.enum(['true', 'false'])])
    .transform((v) => v === true || v === 'true')
    .default(false),
});

notificationsRouter.get(
  '/me',
  asyncHandler(async (req, res) => {
    const q = parseOrThrow(unreadQuery, req.query);
    res.json(await notificationService.listNotifications(req.user!.id, q.unreadOnly));
  }),
);

notificationsRouter.post(
  '/:id/read',
  asyncHandler(async (req, res) => {
    const result = await notificationService.markRead(req.user!.id, req.params.id);
    res.json({ ok: true, updated: result.count });
  }),
);

notificationsRouter.post(
  '/read-all',
  asyncHandler(async (req, res) => {
    const result = await notificationService.markAllRead(req.user!.id);
    res.json({ ok: true, updated: result.count });
  }),
);

notificationsRouter.post(
  '/push-token',
  validate(pushTokenSchema),
  asyncHandler(async (req, res) => {
    const { token, platform } = req.body as { token: string; platform: string };
    await prisma.pushToken.upsert({
      where: { token },
      create: { token, platform, userId: req.user!.id },
      update: { userId: req.user!.id, platform },
    });
    res.json({ ok: true });
  }),
);

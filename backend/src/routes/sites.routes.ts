import { Router } from 'express';
import { writeAudit } from '../lib/audit';
import { asyncHandler, forbidden, notFound } from '../lib/errors';
import { prisma } from '../lib/prisma';
import { authenticate, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';
import {
  assignmentCreateSchema,
  siteCreateSchema,
  siteUpdateSchema,
} from '../schemas/site.schema';
import { managedSiteIds } from '../services/access.service';

export const sitesRouter = Router();
sitesRouter.use(authenticate);

/** Site list with active assignments (needed by the dashboard map/admin pages). */
sitesRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const sites = await prisma.projectSite.findMany({
      include: {
        assignments: {
          where: { active: true },
          select: {
            id: true,
            userId: true,
            user: { select: { id: true, name: true, employeeId: true, role: true } },
          },
        },
      },
      orderBy: { name: 'asc' },
    });
    res.json(sites);
  }),
);

sitesRouter.post(
  '/',
  requireRole('ADMIN'),
  validate(siteCreateSchema),
  asyncHandler(async (req, res) => {
    const created = await prisma.projectSite.create({ data: req.body as never });
    await writeAudit({
      actorId: req.user!.id,
      action: 'SITE_CREATE',
      entity: 'ProjectSite',
      entityId: created.id,
      meta: { name: created.name },
      ip: req.ip,
    });
    res.status(201).json(created);
  }),
);

sitesRouter.patch(
  '/:id',
  requireRole('ADMIN'),
  validate(siteUpdateSchema),
  asyncHandler(async (req, res) => {
    const site = await prisma.projectSite.findUnique({ where: { id: req.params.id } });
    if (!site) throw notFound('SITE_NOT_FOUND', 'Project site not found');
    const updated = await prisma.projectSite.update({
      where: { id: site.id },
      data: req.body as never,
    });
    await writeAudit({
      actorId: req.user!.id,
      action: 'SITE_UPDATE',
      entity: 'ProjectSite',
      entityId: site.id,
      meta: { changed: Object.keys(req.body as object) },
      ip: req.ip,
    });
    res.json(updated);
  }),
);

/** Assignment list for a site (admins, HR, and the managers of that site). */
sitesRouter.get(
  '/:id/assignments',
  requireRole('ADMIN', 'HR', 'MANAGER'),
  asyncHandler(async (req, res) => {
    if (req.user!.role === 'MANAGER') {
      const mine = await managedSiteIds(req.user!.id);
      if (!mine.includes(req.params.id)) {
        throw forbidden('FORBIDDEN', 'This site is outside your scope');
      }
    }
    const assignments = await prisma.siteAssignment.findMany({
      where: { siteId: req.params.id, active: true },
      include: {
        user: { select: { id: true, name: true, employeeId: true, role: true, email: true, phone: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
    res.json(assignments);
  }),
);

sitesRouter.post(
  '/:id/assignments',
  requireRole('ADMIN'),
  validate(assignmentCreateSchema),
  asyncHandler(async (req, res) => {
    const { userId } = req.body as { userId: string };
    const [site, user] = await Promise.all([
      prisma.projectSite.findUnique({ where: { id: req.params.id } }),
      prisma.user.findUnique({ where: { id: userId } }),
    ]);
    if (!site) throw notFound('SITE_NOT_FOUND', 'Project site not found');
    if (!user || !user.isActive) throw notFound('USER_NOT_FOUND', 'User not found or inactive');

    const existing = await prisma.siteAssignment.findFirst({
      where: { userId, siteId: site.id, active: true },
    });
    if (existing) return res.status(200).json(existing);

    const created = await prisma.siteAssignment.create({
      data: { userId, siteId: site.id, assignedById: req.user!.id },
    });
    await writeAudit({
      actorId: req.user!.id,
      action: 'SITE_ASSIGN',
      entity: 'SiteAssignment',
      entityId: created.id,
      meta: { userId, siteId: site.id, role: user.role },
      ip: req.ip,
    });
    res.status(201).json(created);
  }),
);

sitesRouter.delete(
  '/:id/assignments/:assignmentId',
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    const assignment = await prisma.siteAssignment.findFirst({
      where: { id: req.params.assignmentId, siteId: req.params.id, active: true },
    });
    if (!assignment) throw notFound('ASSIGNMENT_NOT_FOUND', 'Active assignment not found');

    await prisma.siteAssignment.update({
      where: { id: assignment.id },
      data: { active: false, endedAt: new Date() },
    });
    await writeAudit({
      actorId: req.user!.id,
      action: 'SITE_UNASSIGN',
      entity: 'SiteAssignment',
      entityId: assignment.id,
      meta: { userId: assignment.userId, siteId: assignment.siteId },
      ip: req.ip,
    });
    res.json({ ok: true });
  }),
);

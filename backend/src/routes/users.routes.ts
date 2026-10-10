import { Router } from 'express';
import { writeAudit } from '../lib/audit';
import { conflict, forbidden, notFound } from '../lib/errors';
import { asyncHandler } from '../lib/errors';
import { hashPassword } from '../lib/passwords';
import { prisma } from '../lib/prisma';
import { authenticate, requireRole } from '../middleware/auth';
import { parseOrThrow, validate } from '../middleware/validate';
import { userCreateSchema, userUpdateSchema, usersQuerySchema } from '../schemas/user.schema';
import { managedSiteIds } from '../services/access.service';
import { publicUser } from '../services/auth.service';

export const usersRouter = Router();
usersRouter.use(authenticate);

const publicFields = {
  id: true,
  name: true,
  email: true,
  employeeId: true,
  role: true,
  phone: true,
  isActive: true,
  createdAt: true,
} as const;

/** Users list. HR/Admin: everyone (filterable). Manager: engineers on managed sites. */
usersRouter.get(
  '/',
  requireRole('ADMIN', 'HR', 'MANAGER'),
  asyncHandler(async (req, res) => {
    const q = parseOrThrow(usersQuerySchema, req.query);

    const where: Record<string, unknown> = {
      ...(q.role ? { role: q.role } : {}),
      ...(q.q
        ? {
            OR: [
              { name: { contains: q.q } },
              { email: { contains: q.q } },
              { employeeId: { contains: q.q } },
            ],
          }
        : {}),
    };

    if (req.user!.role === 'MANAGER') {
      const siteIds = await managedSiteIds(req.user!.id);
      where.role = 'ENGINEER';
      where.assignments = siteIds.length
        ? { some: { active: true, siteId: { in: siteIds } } }
        : { some: { active: true, siteId: '__none__' } };
    }

    const users = await prisma.user.findMany({
      where,
      select: {
        ...publicFields,
        assignments: {
          where: { active: true },
          select: { id: true, site: { select: { id: true, name: true } } },
        },
      },
      orderBy: [{ role: 'asc' }, { name: 'asc' }],
    });

    res.json(
      users.map(({ assignments, ...u }) => ({
        ...u,
        sites: assignments.map((a) => a.site),
      })),
    );
  }),
);

usersRouter.post(
  '/',
  requireRole('ADMIN', 'HR'),
  validate(userCreateSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as {
      name: string;
      email: string;
      employeeId: string;
      password: string;
      role: string;
      phone?: string;
    };
    if (body.role === 'ADMIN' && req.user!.role !== 'ADMIN') {
      throw forbidden('FORBIDDEN', 'Only an administrator can create administrator accounts');
    }

    const existing = await prisma.user.findFirst({
      where: { OR: [{ email: body.email }, { employeeId: body.employeeId }] },
    });
    if (existing) throw conflict('USER_EXISTS', 'A user with this email or employee ID already exists');

    const created = await prisma.user.create({
      data: {
        name: body.name,
        email: body.email,
        employeeId: body.employeeId,
        passwordHash: await hashPassword(body.password),
        role: body.role,
        phone: body.phone ?? null,
      },
    });

    await writeAudit({
      actorId: req.user!.id,
      action: 'USER_CREATE',
      entity: 'User',
      entityId: created.id,
      meta: { role: body.role, employeeId: body.employeeId },
      ip: req.ip,
    });

    res.status(201).json(publicUser(created));
  }),
);

usersRouter.patch(
  '/:id',
  requireRole('ADMIN', 'HR'),
  validate(userUpdateSchema),
  asyncHandler(async (req, res) => {
    const target = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!target) throw notFound('USER_NOT_FOUND', 'User not found');

    const body = req.body as {
      name?: string;
      phone?: string;
      role?: string;
      isActive?: boolean;
      password?: string;
    };

    if (req.user!.role === 'HR' && (target.role === 'ADMIN' || body.role === 'ADMIN')) {
      throw forbidden('FORBIDDEN', 'HR cannot manage administrator accounts');
    }

    const updated = await prisma.user.update({
      where: { id: target.id },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.phone !== undefined ? { phone: body.phone } : {}),
        ...(body.role !== undefined ? { role: body.role } : {}),
        ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
        ...(body.password ? { passwordHash: await hashPassword(body.password) } : {}),
      },
    });

    await writeAudit({
      actorId: req.user!.id,
      action: 'USER_UPDATE',
      entity: 'User',
      entityId: target.id,
      meta: { changed: Object.keys(body) },
      ip: req.ip,
    });

    res.json(publicUser(updated));
  }),
);

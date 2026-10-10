import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { forbidden, unauthorized } from '../lib/errors';
import { prisma } from '../lib/prisma';
import { Role } from '../lib/roles';

interface AccessPayload {
  sub: string;
  role: Role;
  type: 'access';
}

/**
 * Verifies the Bearer access token and attaches req.user (must be active).
 */
export async function authenticate(req: Request, _res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      throw unauthorized('AUTH_REQUIRED', 'Authentication required');
    }
    const token = header.slice('Bearer '.length).trim();

    let payload: AccessPayload;
    try {
      payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessPayload;
    } catch {
      throw unauthorized('TOKEN_INVALID', 'Access token is invalid or expired');
    }
    if (payload.type !== 'access') {
      throw unauthorized('TOKEN_INVALID', 'Access token is invalid or expired');
    }

    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || !user.isActive) {
      throw unauthorized('USER_INACTIVE', 'Account not found or deactivated');
    }

    req.user = {
      id: user.id,
      role: user.role as Role,
      name: user.name,
      email: user.email,
      employeeId: user.employeeId,
    };
    next();
  } catch (err) {
    next(err);
  }
}

/** Route-level RBAC. Must run after `authenticate`. */
export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(unauthorized('AUTH_REQUIRED', 'Authentication required'));
    if (!roles.includes(req.user.role)) {
      return next(forbidden('FORBIDDEN', `This action requires role: ${roles.join(' or ')}`));
    }
    next();
  };
}

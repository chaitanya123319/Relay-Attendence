import jwt from 'jsonwebtoken';
import { User } from '@prisma/client';
import { env } from '../config/env';
import { writeAudit } from '../lib/audit';
import { randomHex, sha256Hex } from '../lib/crypto';
import { unauthorized } from '../lib/errors';
import { prisma } from '../lib/prisma';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

/** Public shape of a user — never exposes passwordHash. */
export const publicUser = (u: User) => ({
  id: u.id,
  email: u.email,
  employeeId: u.employeeId,
  name: u.name,
  phone: u.phone,
  role: u.role,
  isActive: u.isActive,
});

function signAccessToken(user: { id: string; role: string }): string {
  return jwt.sign({ sub: user.id, role: user.role, type: 'access' }, env.JWT_ACCESS_SECRET, {
    expiresIn: `${env.ACCESS_TOKEN_TTL_MIN}m`,
  });
}

/** Issues an access token + a rotating refresh token (stored hashed, never in clear). */
async function issueTokenPair(user: { id: string; role: string }): Promise<TokenPair> {
  const refreshToken = randomHex(48);
  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: sha256Hex(refreshToken),
      expiresAt: new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 86_400_000),
    },
  });
  return { accessToken: signAccessToken(user), refreshToken };
}

export async function login(identifier: string, password: string, ip?: string) {
  const { verifyPassword } = await import('../lib/passwords'); // keep bcrypt out of module init cost
  const user = await prisma.user.findFirst({
    where: {
      OR: [{ email: identifier.trim().toLowerCase() }, { employeeId: identifier.trim() }],
    },
  });

  // Same error for unknown user & wrong password — no account enumeration.
  if (!user || !user.isActive) throw unauthorized('INVALID_CREDENTIALS', 'Invalid email/ID or password');
  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) {
    await writeAudit({
      actorId: user.id,
      action: 'AUTH_LOGIN_FAILED',
      entity: 'User',
      entityId: user.id,
      ip,
    });
    throw unauthorized('INVALID_CREDENTIALS', 'Invalid email/ID or password');
  }

  const tokens = await issueTokenPair(user);
  await writeAudit({ actorId: user.id, action: 'AUTH_LOGIN', entity: 'User', entityId: user.id, ip });
  return { ...tokens, user: publicUser(user) };
}

export async function refresh(refreshToken: string, ip?: string) {
  const row = await prisma.refreshToken.findUnique({
    where: { tokenHash: sha256Hex(refreshToken) },
    include: { user: true },
  });
  if (!row) throw unauthorized('REFRESH_INVALID', 'Refresh token is invalid');

  if (row.revokedAt) {
    // Reuse of a rotated token = possible theft. Revoke every session for this user.
    await prisma.refreshToken.updateMany({
      where: { userId: row.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await writeAudit({
      actorId: row.userId,
      action: 'AUTH_REFRESH_REUSE',
      entity: 'RefreshToken',
      entityId: row.id,
      ip,
    });
    throw unauthorized('REFRESH_REUSE', 'Session expired — please log in again');
  }
  if (row.expiresAt < new Date()) {
    throw unauthorized('REFRESH_EXPIRED', 'Session expired — please log in again');
  }
  if (!row.user.isActive) throw unauthorized('USER_INACTIVE', 'Account not found or deactivated');

  const tokens = await issueTokenPair(row.user);
  await prisma.refreshToken.update({ where: { id: row.id }, data: { revokedAt: new Date() } });
  return { ...tokens, user: publicUser(row.user) };
}

export async function logout(refreshToken: string | undefined) {
  if (!refreshToken) return { ok: true };
  await prisma.refreshToken.updateMany({
    where: { tokenHash: sha256Hex(refreshToken), revokedAt: null },
    data: { revokedAt: new Date() },
  });
  return { ok: true };
}

export async function me(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw unauthorized('USER_NOT_FOUND', 'Account not found');
  return publicUser(user);
}

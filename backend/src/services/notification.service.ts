import { prisma } from '../lib/prisma';
import { NotificationType } from '../lib/roles';
import { sendExpoPush } from './push.service';

interface NotificationInput {
  userId: string;
  title: string;
  body: string;
  type: NotificationType;
  data?: Record<string, unknown>;
}

/** Writes the in-app notification row, then attempts push delivery (non-blocking). */
export async function notifyUser(input: NotificationInput) {
  const row = await prisma.notification.create({
    data: {
      userId: input.userId,
      title: input.title,
      body: input.body,
      type: input.type,
      data: input.data ? JSON.stringify(input.data) : null,
    },
  });
  void sendExpoPush(input.userId, input.title, input.body, input.data);
  return row;
}

/** Managers responsible for any site the given user is actively assigned to. */
export async function managerIdsForUser(userId: string): Promise<string[]> {
  const assignments = await prisma.siteAssignment.findMany({
    where: { userId, active: true },
    select: { siteId: true },
  });
  const siteIds = assignments.map((a) => a.siteId);
  if (siteIds.length === 0) return [];

  const managers = await prisma.siteAssignment.findMany({
    where: {
      active: true,
      siteId: { in: siteIds },
      user: { role: 'MANAGER', isActive: true },
    },
    select: { userId: true },
  });
  return [...new Set(managers.map((m) => m.userId))];
}

export async function notifyManagersForUser(
  userId: string,
  title: string,
  body: string,
  type: NotificationType,
  data?: Record<string, unknown>,
): Promise<void> {
  const ids = await managerIdsForUser(userId);
  await Promise.all(ids.map((id) => notifyUser({ userId: id, title, body, type, data })));
}

export function listNotifications(userId: string, unreadOnly: boolean) {
  return prisma.notification.findMany({
    where: { userId, ...(unreadOnly ? { readAt: null } : {}) },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
}

export function markRead(userId: string, id: string) {
  return prisma.notification.updateMany({ where: { id, userId }, data: { readAt: new Date() } });
}

export function markAllRead(userId: string) {
  return prisma.notification.updateMany({ where: { userId, readAt: null }, data: { readAt: new Date() } });
}

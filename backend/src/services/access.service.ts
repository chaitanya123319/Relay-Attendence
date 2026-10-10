import { prisma } from '../lib/prisma';
import { Role } from '../lib/roles';

export interface Viewer {
  id: string;
  role: Role;
}

/** Site IDs a manager actively manages (managers hold SiteAssignment rows too). */
export async function managedSiteIds(managerId: string): Promise<string[]> {
  const rows = await prisma.siteAssignment.findMany({
    where: { userId: managerId, active: true },
    select: { siteId: true },
  });
  return rows.map((r) => r.siteId);
}

/** Site IDs a user (typically an engineer) is actively assigned to. */
export async function activeSiteIds(userId: string): Promise<string[]> {
  const rows = await prisma.siteAssignment.findMany({
    where: { userId, active: true },
    select: { siteId: true },
  });
  return rows.map((r) => r.siteId);
}

/**
 * Central data-access rule: may `viewer` see `subjectUserId`'s
 * attendance / leave data? Admin & HR: company-wide. Manager: shared sites.
 * Everyone: themselves.
 */
export async function canViewUserData(viewer: Viewer, subjectUserId: string): Promise<boolean> {
  if (viewer.id === subjectUserId) return true;
  if (viewer.role === 'ADMIN' || viewer.role === 'HR') return true;
  if (viewer.role === 'MANAGER') {
    const [mine, theirs] = await Promise.all([managedSiteIds(viewer.id), activeSiteIds(subjectUserId)]);
    return theirs.some((s) => mine.includes(s));
  }
  return false;
}

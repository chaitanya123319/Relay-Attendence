import { prisma } from './prisma';

export interface AuditInput {
  actorId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  meta?: unknown;
  ip?: string | null;
}

/**
 * Append-only audit trail. Never throws into request handling — a failed
 * audit write is logged, not fatal (attendance must not fail on audit issues).
 */
export async function writeAudit(input: AuditInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: input.actorId ?? null,
        action: input.action,
        entity: input.entity,
        entityId: input.entityId ?? null,
        meta: input.meta === undefined ? null : JSON.stringify(input.meta),
        ip: input.ip ?? null,
      },
    });
  } catch (err) {
    console.error('[audit] failed to write audit log', err);
  }
}

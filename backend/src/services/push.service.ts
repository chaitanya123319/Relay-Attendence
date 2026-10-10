import { prisma } from '../lib/prisma';

/**
 * Best-effort Expo push delivery. Fire-and-forget by design: in-app
 * notification rows are the source of truth (written first by
 * notification.service), push is only a transport. Never throws, never
 * blocks an API response.
 */
export async function sendExpoPush(
  userId: string,
  title: string,
  body: string,
  data?: Record<string, unknown>,
): Promise<void> {
  try {
    const tokens = await prisma.pushToken.findMany({ where: { userId } });
    if (tokens.length === 0) return;

    const messages = tokens.map((t) => ({
      to: t.token,
      sound: 'default',
      title,
      body,
      data: data ?? {},
    }));

    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(messages),
    });
    if (!res.ok) console.warn(`[push] Expo push API responded ${res.status}`);
  } catch (err) {
    // Offline/dev environments must never break on push failures.
    console.warn('[push] delivery skipped:', err instanceof Error ? err.message : err);
  }
}

import { createApp } from './app';
import { env } from './config/env';
import { prisma } from './lib/prisma';

async function main() {
  const app = createApp();

  // Fail fast with a clear message if the database is unreachable.
  await prisma.$queryRaw`SELECT 1`;

  const server = app.listen(env.PORT, () => {
    console.log(`[relay] RELAY Attendance API listening on http://localhost:${env.PORT} (${env.NODE_ENV})`);
  });

  const shutdown = async (signal: string) => {
    console.log(`[relay] ${signal} received — shutting down`);
    server.close(async () => {
      await prisma.$disconnect();
      process.exit(0);
    });
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((err) => {
  console.error('[relay] failed to start:', err);
  process.exit(1);
});

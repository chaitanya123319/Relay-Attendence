/**
 * Container entrypoint.
 *   1. Apply the Prisma schema to Postgres (`db push` — migrations in this repo
 *      are SQLite-dialect; see DECISIONS.md #1).
 *   2. Seed demo data ONLY when the database is empty (restarts keep data).
 *   3. Start the compiled API as the main process with signal forwarding.
 */
const { execSync, spawn } = require('child_process');
const path = require('path');

const root = path.resolve(__dirname, '..');

function run(cmd) {
  console.log(`[docker-start] $ ${cmd}`);
  execSync(cmd, { stdio: 'inherit', cwd: root });
}

async function main() {
  run('npx prisma db push --skip-generate --accept-data-loss');

  const { PrismaClient } = require(path.join(root, 'node_modules', '@prisma', 'client'));
  const prisma = new PrismaClient();
  const userCount = await prisma.user.count();
  await prisma.$disconnect();

  if (userCount === 0) {
    run('npx tsx prisma/seed.ts');
  } else {
    console.log(`[docker-start] database already has ${userCount} users — skipping seed`);
  }

  const child = spawn(process.execPath, ['dist/index.js'], { stdio: 'inherit', cwd: root });
  child.on('exit', (code) => process.exit(code ?? 0));
  for (const sig of ['SIGINT', 'SIGTERM']) {
    process.on(sig, () => child.kill(sig));
  }
}

main().catch((err) => {
  console.error('[docker-start] initialization failed:', err);
  process.exit(1);
});

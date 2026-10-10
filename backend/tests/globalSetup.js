/**
 * Jest global setup: re-creates prisma/test.db from the committed migrations
 * (so migrations themselves are exercised by the suite) and cleans test storage.
 * Runs once per `jest` invocation, before workers start.
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

module.exports = async () => {
  const root = path.resolve(__dirname, '..');
  const dbFile = path.join(root, 'prisma', 'test.db');

  for (const f of [dbFile, `${dbFile}-journal`]) {
    try {
      fs.rmSync(f, { force: true });
    } catch {}
  }
  fs.rmSync(path.join(root, '.test-storage'), { recursive: true, force: true });

  const prismaCli = path.join(root, 'node_modules', 'prisma', 'build', 'index.js');
  execSync(`"${process.execPath}" "${prismaCli}" migrate deploy`, {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: 'file:./test.db', NODE_ENV: 'test' },
  });
};

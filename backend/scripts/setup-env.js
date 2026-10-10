/**
 * Creates backend/.env from .env.example with cryptographically random JWT secrets.
 * Idempotent: leaves an existing .env untouched. Run: npm run setup
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = path.resolve(__dirname, '..');
const envPath = path.join(root, '.env');
const examplePath = path.join(root, '.env.example');

if (fs.existsSync(envPath)) {
  console.log('[setup] backend/.env already exists — leaving it untouched.');
  process.exit(0);
}

const example = fs.readFileSync(examplePath, 'utf8');
const filled = example
  .replace(/^JWT_ACCESS_SECRET=.*$/m, `JWT_ACCESS_SECRET=${crypto.randomBytes(32).toString('hex')}`)
  .replace(
    /^JWT_REFRESH_SECRET=.*$/m,
    `JWT_REFRESH_SECRET=${crypto.randomBytes(32).toString('hex')}`,
  );

fs.writeFileSync(envPath, filled);
console.log('[setup] Created backend/.env with fresh random JWT secrets.');

/**
 * Switches the Prisma datasource provider in prisma/schema.prisma.
 * The repo default is sqlite (zero-install local dev). The Docker image runs
 * `node scripts/use-provider.js postgresql` before `prisma generate` so the
 * same schema serves PostgreSQL in `docker compose up`.
 */
const fs = require('fs');
const path = require('path');

const provider = process.argv[2];
if (!['sqlite', 'postgresql'].includes(provider)) {
  console.error('usage: node scripts/use-provider.js sqlite|postgresql');
  process.exit(1);
}

const schemaPath = path.join(__dirname, '..', 'prisma', 'schema.prisma');
const src = fs.readFileSync(schemaPath, 'utf8');
const updated = src.replace(
  /provider\s*=\s*"(sqlite|postgresql)"\s*\/\/\s*datasource-provider/,
  `provider = "${provider}" // datasource-provider`,
);

if (updated === src && !src.includes(`provider = "${provider}"`)) {
  console.error('Could not find the datasource provider line in schema.prisma');
  process.exit(1);
}

fs.writeFileSync(schemaPath, updated);
console.log(`[use-provider] Prisma datasource provider set to "${provider}".`);

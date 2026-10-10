# RELAY Attendance API — production-style image.
# Datasource provider is flipped to 'postgresql' at build time (see DECISIONS.md #1);
# `docker compose up` supplies DATABASE_URL pointing at the Postgres service.
FROM node:22-alpine

WORKDIR /app

# Install dependencies first (layer caching)
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# Prisma: flip provider BEFORE generating the client so it talks Postgres
COPY prisma ./prisma
COPY scripts ./scripts
RUN node scripts/use-provider.js postgresql && npx prisma generate

# Compile TypeScript
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npm run build

ENV NODE_ENV=production
EXPOSE 4000

# Applies schema (prisma db push), seeds only when the database is empty,
# then starts the API — see scripts/docker-start.js.
CMD ["node", "scripts/docker-start.js"]

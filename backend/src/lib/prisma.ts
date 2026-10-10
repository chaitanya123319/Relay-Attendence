import { PrismaClient } from '@prisma/client';

// Single shared client. Jest hooks reuse it; the API imports the same instance.
export const prisma = new PrismaClient();

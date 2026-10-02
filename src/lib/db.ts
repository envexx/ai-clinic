import { PrismaPg } from "@prisma/adapter-pg";

import { env } from "./env";
import { PrismaClient } from "../generated/prisma/client";

/**
 * Prisma Client singleton.
 *
 * Prisma 7 requires an explicit driver adapter. In development we cache the
 * instance on `globalThis` so Next.js hot reloads do not open a new pool.
 */
const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

function createPrismaClient(): PrismaClient {
  const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export { PrismaClient };

import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@/generated/prisma/client";
import { DATABASE_URL } from "./env";

const globalForPrisma = global as unknown as { prisma?: PrismaClient };

const adapter = new PrismaBetterSqlite3({
  url: DATABASE_URL,
});

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    adapter,
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

import { PrismaClient as MysqlPrismaClient } from "@prisma/client"
import { PrismaClient as NeonPrismaClient } from "@/generated/prisma-neon"

// Database switch — flip USE_NEON in .env(.local) to run against Neon
// (Postgres, prisma/schema.neon.prisma) instead of local MySQL
// (prisma/schema.prisma). Both schemas must be kept in lockstep by hand;
// nothing enforces that automatically.
const useNeon = process.env.USE_NEON === "true"

// Cached as `unknown` — TS chokes with "excessive stack depth" trying to
// structurally compare the two independently-generated (but identical)
// client types if the cache is typed as their union.
const globalForPrisma = globalThis as unknown as { prisma: unknown }

// The two generated clients are structurally identical (mirrored schemas),
// so it's safe to treat the active one as the canonical MysqlPrismaClient
// type everywhere else in the app. The explicit return type + inner cast
// keep TS from ever forming the union of the two full client types, which
// blows its recursion limit ("excessive stack depth") when compared.
function createClient(): MysqlPrismaClient {
  if (useNeon) return new NeonPrismaClient() as unknown as MysqlPrismaClient
  return new MysqlPrismaClient()
}

export const prisma = (globalForPrisma.prisma as MysqlPrismaClient | undefined) ?? createClient()

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma

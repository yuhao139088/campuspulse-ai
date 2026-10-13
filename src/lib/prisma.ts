import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
const connectionString = process.env.DATABASE_URL || "postgresql://campuspulse:campuspulse@localhost:5432/campuspulse";
const adapter = new PrismaPg({ connectionString, max: 5, connectionTimeoutMillis: 10000 });

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

globalForPrisma.prisma = prisma;

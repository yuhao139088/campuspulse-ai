import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { hash } from "bcryptjs";
const client = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
try {
  if (!process.env.SEED_ADMIN_EMAIL || !process.env.SEED_ADMIN_PASSWORD) throw new Error("Seed account env missing");
  const user = await client.user.upsert({ where: { email: process.env.SEED_ADMIN_EMAIL.toLowerCase() }, update: {}, create: { email: process.env.SEED_ADMIN_EMAIL.toLowerCase(), name: process.env.SEED_ADMIN_NAME, globalRole: "ADMIN", passwordHash: await hash(process.env.SEED_ADMIN_PASSWORD, 12) } });
  const space = await client.space.upsert({ where: { slug: "campuspulse-team" }, update: {}, create: { name: "CampusPulse 团队空间", slug: "campuspulse-team", type: "CLUB", settings: { defaultRole: "VIEWER", requireEvidence: true, auditEnabled: true } } });
  await client.membership.upsert({ where: { userId_spaceId: { userId: user.id, spaceId: space.id } }, update: {}, create: { userId: user.id, spaceId: space.id, role: "OWNER" } });
  console.log("Production account and workspace initialized; no demo data added");
} finally { await client.$disconnect(); }

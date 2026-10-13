import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { readFile, writeFile, chmod } from "node:fs/promises";
const client = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
try {
  const path = "/etc/campuspulse/initial-account.txt";
  const lines = (await readFile(path, "utf8")).split("\n");
  const oldEmail = lines[0].split(": ")[1];
  const finalEmail = process.env.SMTP_USER;
  if (!finalEmail) throw new Error("A verified SMTP sender is required");
  const user = await client.user.findUnique({ where: { email: oldEmail } });
  if (!user || user.globalRole !== "ADMIN") throw new Error("Initial administrator not found");
  if (oldEmail !== finalEmail) {
    await client.user.update({ where: { id: user.id }, data: { email: finalEmail, authVersion: { increment: 1 } } });
    lines[0] = "Email: " + finalEmail;
    await writeFile(path, lines.join("\n")); await chmod(path, 0o600);
    const envPath = "/etc/campuspulse/app.env";
    const environment = (await readFile(envPath, "utf8")).split("\n").map((line) => line.startsWith("SEED_ADMIN_EMAIL=") ? "SEED_ADMIN_EMAIL=" + finalEmail : line).join("\n");
    await writeFile(envPath, environment); await chmod(envPath, 0o640);
    await client.auditLog.create({ data: { userId: user.id, spaceId: (await client.space.findUnique({ where: { slug: "campuspulse-team" } })).id, action: "platform.initial-account.email", detail: { provisioned: true } } });
  }
  console.log("System administrator contact aligned with the provided mailbox; password remains private");
} finally { await client.$disconnect(); }

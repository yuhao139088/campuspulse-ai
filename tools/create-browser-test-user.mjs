import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { hash } from "bcryptjs";
import { randomBytes } from "node:crypto";
import { writeFile, readFile, chmod } from "node:fs/promises";
const client = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
const file = "/etc/campuspulse/browser-test-user.json";
try {
  if (process.argv[2] === "cleanup") {
    const fixture = JSON.parse(await readFile(file, "utf8"));
    await client.user.update({ where: { id: fixture.id }, data: { disabled: true, authVersion: { increment: 1 } } });
    console.log("Synthetic browser test account disabled; original administrator unchanged");
  } else {
    const email = "browser-security-" + randomBytes(6).toString("hex") + "@campuspulse.local";
    const password = randomBytes(24).toString("base64url");
    const user = await client.user.create({ data: { email, passwordHash: await hash(password, 12), name: "二次认证验收用户" } });
    await writeFile(file, JSON.stringify({ id: user.id, email, password })); await chmod(file, 0o600);
    console.log("Synthetic private account created for real browser 2FA verification");
  }
} finally { await client.$disconnect(); }

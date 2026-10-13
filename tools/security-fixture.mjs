import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { createHash, randomBytes } from "node:crypto";
import { readFile, writeFile, chmod } from "node:fs/promises";
const client = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
const file = "/etc/campuspulse/security-fixture.json";
const digest = (value) => createHash("sha256").update(process.env.NEXTAUTH_SECRET + ":" + value).digest("hex");
try {
  let fixture;
  if (process.argv[2] === "init") {
    fixture = { email: "security-test-" + randomBytes(6).toString("hex") + "@campuspulse.local", password: randomBytes(24).toString("base64url"), newPassword: randomBytes(24).toString("base64url"), code: "482731" };
    await writeFile(file, JSON.stringify(fixture)); await chmod(file, 0o600);
  } else fixture = JSON.parse(await readFile(file, "utf8"));
  if (process.argv[2] === "init" || process.argv[2] === "reset") {
    const purpose = process.argv[2] === "init" ? "register" : "reset_password";
    await client.verificationCode.create({ data: { channel: "email", purpose, target: fixture.email, hash: digest("email:" + fixture.email + ":" + purpose + ":" + fixture.code), expiresAt: new Date(Date.now() + 600000) } });
  }
  if (process.argv[2] === "check") {
    const used = await client.verificationCode.count({ where: { target: fixture.email, purpose: "register", usedAt: { not: null } } });
    if (used !== 1) throw new Error("Expected one consumed registration challenge");
  }
  console.log("Isolated security fixture prepared; credentials remain private");
} finally { await client.$disconnect(); }

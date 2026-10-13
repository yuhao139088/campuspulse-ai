import { createRequire } from "node:module";
import { createHash, randomBytes } from "node:crypto";
import { readFile, writeFile, chmod } from "node:fs/promises";

const release = (await readFile("/etc/campuspulse/current-release.txt", "utf8")).trim();
const require = createRequire(`/opt/campuspulse/releases/${release}/package.json`);
const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const { hash } = require("bcryptjs");
const client = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
const review = process.argv[2]?.endsWith("review");
const file = review ? "/etc/campuspulse/layout-fixture.json" : "/etc/campuspulse/action-fixture.json";
const digest = (value) => createHash("sha256").update(process.env.NEXTAUTH_SECRET + ":" + value).digest("hex");
try {
  let fixture;
  if (process.argv[2] === "init" || process.argv[2] === "init-review") {
    const suffix = randomBytes(6).toString("hex");
    fixture = { email: "action-test-" + suffix + "@example.com", newEmail: "action-new-" + suffix + "@example.com", password: randomBytes(24).toString("base64url"), newPassword: randomBytes(24).toString("base64url"), setupCode: "643812", contactCode: "339172" };
    fixture.name = review ? "独立排版验收" : "独立安全弹窗验收";
    const user = await client.user.create({ data: { email: fixture.email, emailVerified: new Date(), name: fixture.name, passwordHash: await hash(fixture.password, 12), globalRole: review ? "ADMIN" : "USER" } });
    fixture.id = user.id;
    await writeFile(file, JSON.stringify(fixture)); await chmod(file, 0o600);
    const purpose = "security:" + digest(JSON.stringify(["setup", "", ""]));
    await client.verificationCode.create({ data: { channel: "email", purpose, target: fixture.email, userId: user.id, hash: digest("email:" + fixture.email + ":" + purpose + ":" + fixture.setupCode), expiresAt: new Date(Date.now() + 600000) } });
    if (review) {
      const space = await client.space.findUnique({ where: { slug: "campuspulse-team" } });
      const dataset = await client.dataset.findFirst({ where: { spaceId: space.id, name: "上线验收数据.csv" } });
      const chart = { id: "layout-fixture-chart", title: "验收：签到人数", type: "line", category: "month", metric: "checkedIn", aggregation: "sum" };
      await client.canvas.create({ data: { userId: user.id, spaceId: space.id, config: { datasetId: dataset.id, components: [chart.id], chartType: chart.id, charts: [chart] } } });
    }
  } else {
    fixture = JSON.parse(await readFile(file, "utf8"));
    if (process.argv[2] === "contact") {
      await client.verificationCode.create({ data: { channel: "email", purpose: "bind_email", target: fixture.newEmail, userId: fixture.id, hash: digest("email:" + fixture.newEmail + ":bind_email:" + fixture.contactCode), expiresAt: new Date(Date.now() + 600000) } });
    } else if (process.argv[2] === "disable" || process.argv[2] === "disable-review") {
      await client.user.update({ where: { id: fixture.id }, data: { disabled: true, authVersion: { increment: 1 } } });
      await client.verificationCode.deleteMany({ where: { userId: fixture.id } });
    }
  }
  console.log("Isolated action fixture prepared or disabled; no credentials or verification codes printed");
} finally { await client.$disconnect(); }

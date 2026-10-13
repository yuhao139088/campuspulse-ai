import fs from "node:fs";
import nextEnv from "@next/env";
nextEnv.loadEnvConfig(process.cwd());
const variables = ["CARBON_AI_API_KEY", "CARBON_AI_BASE_URL", "CARBON_AI_MODEL"];
if (variables.some((name) => !process.env[name])) throw new Error("Carbon configuration is incomplete");
fs.mkdirSync(".deployment-private", { recursive: true });
fs.writeFileSync(".deployment-private/carbon.env", variables.map((name) => name + "=" + JSON.stringify(process.env[name])).join("\n") + "\n", { mode: 0o600 });
console.log("Carbon variables prepared for secure SSH transfer (values withheld)");

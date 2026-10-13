import { captcha } from "tencentcloud-sdk-nodejs-captcha";
import { readFile } from "node:fs/promises";
const file = process.argv[2];
const values = Object.fromEntries((await readFile(file, "utf8")).split(/\r?\n/).filter((line) => line.includes("=")).map((line) => { const position = line.indexOf("="); return [line.slice(0, position), line.slice(position + 1)]; }));
const client = new captcha.v20190722.Client({ credential: { secretId: values.TENCENT_CAPTCHA_SECRET_ID, secretKey: values.TENCENT_CAPTCHA_SECRET_KEY }, region: "", profile: { httpProfile: { endpoint: "captcha.tencentcloudapi.com", reqTimeout: 15 } } });
for (const scope of ["NORMAL", "INVISIBLE"]) {
  try {
    const response = await client.DescribeCaptchaResult({ CaptchaType: 9, Ticket: "invalid-diagnostic-ticket", Randstr: "invalid", UserIp: "101.35.250.178", CaptchaAppId: Number(values["CAPTCHA_" + scope + "_APP_ID"]), AppSecretKey: values["CAPTCHA_" + scope + "_SECRET"] });
    if (response.CaptchaCode === 1) throw new Error("Invalid diagnostic ticket must not pass");
    console.log(scope + ": Tencent API authenticated and invalid ticket rejected; CaptchaCode=" + response.CaptchaCode);
  } catch (problem) { console.log(scope + ": provider error code=" + (problem.code ?? "unknown")); process.exitCode = 1; }
}

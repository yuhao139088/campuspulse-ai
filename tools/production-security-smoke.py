import base64
import hashlib
import hmac
import json
import struct
import subprocess
import time
from pathlib import Path
import requests

base = "https://cam.yuhaocloud.cn"
fixture = json.loads(Path("/etc/campuspulse/security-fixture.json").read_text())
account = Path("/etc/campuspulse/initial-account.txt").read_text().splitlines()
admin_email = account[0].split(": ", 1)[1]
admin_password = account[1].split(": ", 1)[1]
results = []
def check(name, condition):
    if not condition:
        raise RuntimeError("Check failed: " + name)
    results.append(name)
    print("PASS " + name, flush=True)
def login(email, password, factor="", should_work=True):
    client = requests.Session()
    csrf = client.get(base + "/api/auth/csrf", timeout=20).json()["csrfToken"]
    client.post(base + "/api/auth/callback/credentials", data={"csrfToken": csrf, "email": email, "password": password, "totp": factor, "callbackUrl": base + "/dashboard", "json": "true"}, timeout=30)
    value = client.get(base + "/api/auth/session", timeout=20).json()
    present = bool(value.get("user", {}).get("id"))
    if should_work != present:
        raise RuntimeError("Unexpected authentication result")
    return client, value.get("user", {}).get("id")
def totp(secret):
    counter = struct.pack(">Q", int(time.time()) // 30)
    digest = hmac.new(base64.b32decode(secret), counter, hashlib.sha1).digest()
    offset = digest[-1] & 15
    return str((struct.unpack(">I", digest[offset:offset+4])[0] & 0x7fffffff) % 1000000).zfill(6)

admin, admin_id = login(admin_email, admin_password)
check("System administrator sign-in", bool(admin_id))
features = requests.get(base + "/api/auth/features", timeout=20).json()
check("Email verification required, SMS honestly unavailable", features["emailVerification"] and features["emailConfigured"] and not features["smsEnabled"])
check("Anonymous configuration access denied", requests.get(base + "/api/platform/config", timeout=20).status_code == 401)
unverified = requests.post(base + "/api/auth/register", json={"name":"独立安全验收用户", "email":fixture["email"], "password":fixture["password"]}, timeout=30)
check("Email registration without verification rejected", unverified.status_code == 400)
wrong = requests.post(base + "/api/auth/register", json={"name":"独立安全验收用户", "email":fixture["email"], "password":fixture["password"], "code":"000000"}, timeout=30)
check("Incorrect verification code rejected", wrong.status_code == 400)
registered = requests.post(base + "/api/auth/register", json={"name":"独立安全验收用户", "email":fixture["email"], "password":fixture["password"], "code":fixture["code"]}, timeout=30)
check("Verified email registration succeeds", registered.status_code == 201)
subprocess.run(["node", "tools/security-fixture.mjs", "check"], check=True)
user, user_id = login(fixture["email"], fixture["password"])
check("Ordinary personal-space owner cannot read configuration", user.get(base + "/api/platform/config", timeout=20).status_code == 403)
check("Ordinary owner cannot change login configuration", user.put(base + "/api/platform/config", json={"section":"site","value":{}}, timeout=20).status_code == 403)
check("Wrong password cannot configure 2FA", user.post(base + "/api/security", json={"action":"setup","password":"invalid"}, timeout=20).status_code == 400)
setup = user.post(base + "/api/security", json={"action":"setup","password":fixture["password"]}, timeout=20)
check("Authenticator setup returns private QR and base32 secret", setup.status_code == 200 and setup.json()["qr"].startswith("data:image/png") and len(setup.json()["secret"]) == 32)
secret = setup.json()["secret"]
check("Incorrect Authenticator confirmation rejected", user.post(base + "/api/security", json={"action":"enable","code":"000000"}, timeout=20).status_code == 400)
enabled = user.post(base + "/api/security", json={"action":"enable","code":totp(secret)}, timeout=20)
check("Authenticator enabled with ten recovery codes", enabled.status_code == 200 and len(enabled.json()["recoveryCodes"]) == 10)
recovery = enabled.json()["recoveryCodes"]
check("2FA activation revokes previous session", user.get(base + "/api/security", timeout=20).status_code == 401)
login(fixture["email"], fixture["password"], should_work=False)
check("Password alone cannot bypass 2FA", True)
user, _ = login(fixture["email"], fixture["password"], recovery[0])
check("One recovery code can authenticate", True)
login(fixture["email"], fixture["password"], recovery[0], should_work=False)
check("Used recovery code cannot be replayed", True)
check("TOTP secret not exposed by account status", "totpSecret" not in user.get(base + "/api/security", timeout=20).json())
disabled = user.post(base + "/api/security", json={"action":"disable","password":fixture["password"],"totp":recovery[1]}, timeout=20)
check("2FA removal requires password plus second factor", disabled.status_code == 200)
check("2FA removal also revokes sessions", user.get(base + "/api/security", timeout=20).status_code == 401)
user, _ = login(fixture["email"], fixture["password"])
check("Disabled SMS provider does not claim delivery", user.post(base + "/api/auth/code", json={"channel":"sms","target":"+8613800138000","purpose":"bind_phone"}, timeout=20).status_code == 503)
configuration = admin.get(base + "/api/platform/config", timeout=20).json()
check("Configuration masks all service secrets", "smtpPassword" not in configuration["authentication"] and "smsToken" not in configuration["authentication"] and "apiKey" not in configuration["ai"])
site = configuration["site"]
edited = {**site, "announcement":"生产配置验收 · 配置已生效"}
check("Administrator can save website settings", admin.put(base + "/api/platform/config", json={"section":"site","value":edited}, timeout=20).status_code == 200)
check("Website settings applied to public page", requests.get(base + "/api/auth/features", timeout=20).json()["site"]["announcement"] == edited["announcement"])
admin.put(base + "/api/platform/config", json={"section":"site","value":site}, timeout=20).raise_for_status()
check("Account session revocation available to system admin", admin.patch(base + "/api/platform", json={"userId":user_id,"resetSessions":True}, timeout=20).status_code == 200)
check("Revoked account session cannot read resources", user.get(base + "/api/security", timeout=20).status_code == 401)
check("System admin can grant system admin role", admin.patch(base + "/api/platform", json={"userId":user_id,"globalRole":"ADMIN"}, timeout=20).status_code == 200)
promoted, _ = login(fixture["email"], fixture["password"])
check("Granted system role can read full configuration", promoted.get(base + "/api/platform/config", timeout=20).status_code == 200)
admin.patch(base + "/api/platform", json={"userId":user_id,"globalRole":"USER"}, timeout=20).raise_for_status()
check("Role demotion invalidates old administrator session", promoted.get(base + "/api/platform/config", timeout=20).status_code == 401)
check("Cannot disable current system admin", admin.patch(base + "/api/platform", json={"userId":admin_id,"disabled":True}, timeout=20).status_code == 403)
subprocess.run(["node", "tools/security-fixture.mjs", "reset"], check=True)
reset = requests.post(base + "/api/auth/reset-password", json={"channel":"email","target":fixture["email"],"code":fixture["code"],"password":fixture["newPassword"]}, timeout=30)
check("Verified password reset changes credentials", reset.status_code == 200)
login(fixture["email"], fixture["password"], should_work=False)
login(fixture["email"], fixture["newPassword"])
check("Reset password rejects old and accepts new credentials", True)
smtp = admin.post(base + "/api/platform/config", json={"action":"smtp_test","email":"yuhao139088@163.com"}, timeout=60)
check("Real 163 SMTP accepts test verification email", smtp.status_code == 200 and smtp.json().get("sent"))
admin.patch(base + "/api/platform", json={"userId":user_id,"disabled":True}, timeout=20).raise_for_status()
Path("/etc/campuspulse/security-smoke-results.json").write_text(json.dumps(results, ensure_ascii=False, indent=2))
print("Security smoke checks passed: " + str(len(results)), flush=True)

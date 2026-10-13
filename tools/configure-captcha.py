from pathlib import Path
import os
configuration = Path("/etc/campuspulse")
values = dict(line.split("=", 1) for line in (configuration / "tencent-captcha.env").read_text().splitlines() if "=" in line)
environment = configuration / "app.env"
lines = [line for line in environment.read_text().splitlines() if line.split("=", 1)[0] not in values]
environment.write_text("\n".join(lines + [key + "=" + value for key, value in values.items()]) + "\n")
os.chmod(environment, 0o640)
os.chmod(configuration / "tencent-captcha.env", 0o600)
print("Tencent verification configuration written privately; no credentials printed")

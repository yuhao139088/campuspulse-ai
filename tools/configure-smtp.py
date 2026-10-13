from pathlib import Path
import os
import smtplib
import ssl

private = Path("/etc/campuspulse")
values = dict(line.split("=", 1) for line in (private / "smtp.env").read_text().splitlines() if "=" in line)
environment = private / "app.env"
lines = [line for line in environment.read_text().splitlines() if line.split("=", 1)[0] not in values]
environment.write_text("\n".join(lines + [name + "=" + value for name, value in values.items()]) + "\n")
os.chmod(environment, 0o640)
os.chmod(private / "smtp.env", 0o600)
with smtplib.SMTP_SSL(values["SMTP_HOST"], int(values["SMTP_PORT"]), context=ssl.create_default_context(), timeout=20) as server:
    server.login(values["SMTP_USER"], values["SMTP_PASSWORD"])
print("SMTP TLS connection and account authentication verified; no credentials printed")

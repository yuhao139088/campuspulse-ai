from pathlib import Path
import re
import tarfile
import sys
archive = Path(sys.argv[1])
private = Path(".deployment-private")
secrets = []
for file in private.glob("*.env"):
    for line in file.read_text(encoding="utf-8").splitlines():
        if "=" not in line:
            continue
        key, value = line.split("=", 1)
        value = value.strip().strip('"')
        if re.search("SECRET|PASSWORD|API_KEY", key) and len(value) >= 12:
            secrets.append(value.encode())
account = private / "initial-account.txt"
if account.exists():
    secrets.append(account.read_text(encoding="utf-8").splitlines()[1].split(": ", 1)[1].encode())
with tarfile.open(archive, "r:gz") as source:
    for member in source.getmembers():
        name = member.name
        if ".deployment-private" in name or "test-results" in name or name.endswith("/.env"):
            raise RuntimeError("Private file must not be in release: " + name)
        if member.isfile():
            value = source.extractfile(member).read()
            if any(secret in value for secret in secrets):
                raise RuntimeError("Private credential detected in release; no secret printed")
print("Release archive contains no private credentials or browser authentication traces")

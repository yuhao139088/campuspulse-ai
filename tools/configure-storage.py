import subprocess
import re
import json
from pathlib import Path

binary = ["/usr/local/bin/campuspulse-garage", "-c", "/etc/campuspulse/garage.toml"]
output = subprocess.check_output(binary + ["key", "create", "campuspulse-app"], text=True)
key = re.search(r"Key ID:\s*(\S+)", output)
secret = re.search(r"Secret key:\s*(\S+)", output, re.IGNORECASE)
if not key or not secret:
    raise RuntimeError("Unable to parse Garage key output (secret output withheld)")
subprocess.run(binary + ["bucket", "allow", "--read", "--write", "--owner", "campuspulse", "--key", key.group(1)], check=True, stdout=subprocess.DEVNULL)
env = Path("/etc/campuspulse/app.env")
with env.open("a") as target:
    target.write("S3_ACCESS_KEY=" + json.dumps(key.group(1)) + "\nS3_SECRET_KEY=" + json.dumps(secret.group(1)) + "\n")
print("Private storage access key configured")

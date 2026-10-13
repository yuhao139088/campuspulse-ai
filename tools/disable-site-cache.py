from pathlib import Path
from datetime import datetime
import subprocess
configuration = Path("/www/server/panel/vhost/nginx/cam.yuhaocloud.cn.conf")
text = configuration.read_text()
backup = Path("/etc/campuspulse/nginx-before-cache-fix-" + datetime.now().strftime("%Y%m%d%H%M%S") + ".conf")
backup.write_text(text)
if "proxy_cache off;" not in text:
    text = text.replace("  proxy_pass http://127.0.0.1:3100;", "  proxy_cache off;\n  proxy_no_cache 1;\n  proxy_cache_bypass 1;\n  proxy_pass http://127.0.0.1:3100;")
configuration.write_text(text)
validation = subprocess.run(["nginx", "-t"], capture_output=True, text=True)
if validation.returncode:
    configuration.write_text(backup.read_text())
    raise RuntimeError("Nginx validation failed; site configuration restored")
subprocess.run(["nginx", "-s", "reload"], check=True)
print("Site proxy cache disabled; shared caches and other sites preserved")

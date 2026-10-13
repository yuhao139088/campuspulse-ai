from pathlib import Path
import subprocess
import shutil

def run(args):
    return subprocess.check_output(args, text=True, stderr=subprocess.STDOUT)

source = Path("/opt/campuspulse/app")
standalone = source / ".next/standalone"
shutil.copytree(source / "public", standalone / "public", dirs_exist_ok=True)
shutil.copytree(source / ".next/static", standalone / ".next/static", dirs_exist_ok=True)
(standalone / ".next/cache").mkdir(parents=True, exist_ok=True)
run(["chown", "-R", "campuspulse:campuspulse", "/opt/campuspulse/app"])
Path("/etc/systemd/system/campuspulse-app.service").write_text("[Unit]\nDescription=CampusPulse AI production app\nAfter=network.target postgresql.service campuspulse-storage.service\nRequires=postgresql.service campuspulse-storage.service\n[Service]\nType=simple\nUser=campuspulse\nGroup=campuspulse\nWorkingDirectory=/opt/campuspulse/app/.next/standalone\nEnvironmentFile=/etc/campuspulse/app.env\nEnvironment=NODE_OPTIONS=--max-old-space-size=512\nExecStart=/usr/bin/node server.js\nRestart=on-failure\nRestartSec=5\nMemoryMax=768M\nNoNewPrivileges=true\nPrivateTmp=true\nProtectHome=true\nProtectSystem=strict\nReadWritePaths=/opt/campuspulse/app/.next/standalone/.next/cache\n[Install]\nWantedBy=multi-user.target\n")
nginx = Path("/www/server/panel/vhost/nginx/cam.yuhaocloud.cn.conf")
shutil.copy2(nginx, "/etc/campuspulse/nginx-before-https.conf")
nginx.write_text("""server {
 listen 80;
 server_name cam.yuhaocloud.cn;
 root /www/wwwroot/cam.yuhaocloud.cn;
 location /.well-known/acme-challenge/ { try_files $uri =404; }
 location / { return 301 https://$host$request_uri; }
}
server {
 listen 443 ssl;
 http2 on;
 server_name cam.yuhaocloud.cn;
 ssl_certificate /etc/letsencrypt/live/cam.yuhaocloud.cn/fullchain.pem;
 ssl_certificate_key /etc/letsencrypt/live/cam.yuhaocloud.cn/privkey.pem;
 ssl_protocols TLSv1.2 TLSv1.3;
 client_max_body_size 21m;
 add_header X-Content-Type-Options nosniff always;
 add_header X-Frame-Options SAMEORIGIN always;
 add_header Referrer-Policy strict-origin-when-cross-origin always;
 access_log /www/wwwlogs/cam.yuhaocloud.cn.log;
 error_log /www/wwwlogs/cam.yuhaocloud.cn.error.log;
 location / {
  proxy_cache off;
  proxy_no_cache 1;
  proxy_cache_bypass 1;
  proxy_pass http://127.0.0.1:3100;
  proxy_http_version 1.1;
  proxy_set_header Host $host;
  proxy_set_header X-Forwarded-Proto $scheme;
  proxy_set_header X-Forwarded-For $remote_addr;
  proxy_set_header X-Real-IP $remote_addr;
  proxy_read_timeout 600s;
  proxy_send_timeout 600s;
 }
}
""")
Path("/etc/letsencrypt/renewal-hooks/deploy/campuspulse-nginx").write_text("#!/bin/sh\n/usr/bin/nginx -t && /usr/bin/nginx -s reload\n")
run(["chmod", "755", "/etc/letsencrypt/renewal-hooks/deploy/campuspulse-nginx"])
run(["systemctl", "daemon-reload"])
run(["systemctl", "enable", "--now", "campuspulse-app", "certbot-renew.timer"])
run(["nginx", "-t"])
run(["nginx", "-s", "reload"])
print("Application and HTTPS activated")

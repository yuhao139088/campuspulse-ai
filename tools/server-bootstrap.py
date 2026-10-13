import json
import os
import secrets
import subprocess
from pathlib import Path

def run(args):
    return subprocess.check_output(args, text=True, stderr=subprocess.STDOUT)

config = Path("/etc/campuspulse")
config.mkdir(mode=0o700, exist_ok=True)
database_password = secrets.token_hex(24)
app_secret = secrets.token_hex(48)
admin_password = secrets.token_urlsafe(22)
run(["runuser", "-u", "postgres", "--", "psql", "-v", "ON_ERROR_STOP=1", "-c", "CREATE ROLE campuspulse LOGIN PASSWORD '" + database_password + "';"])
run(["runuser", "-u", "postgres", "--", "createdb", "-O", "campuspulse", "campuspulse"])
pg_hba = Path("/var/lib/pgsql/data/pg_hba.conf")
pg_hba.write_text("host campuspulse campuspulse 127.0.0.1/32 scram-sha-256\n" + pg_hba.read_text())
run(["systemctl", "reload", "postgresql"])
run(["id", "campuspulse"]) if subprocess.run(["id", "campuspulse"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL).returncode == 0 else run(["useradd", "--system", "--home-dir", "/opt/campuspulse", "--shell", "/sbin/nologin", "campuspulse"])
for directory in ["/var/lib/campuspulse/garage/meta", "/var/lib/campuspulse/garage/data", "/www/wwwroot/cam.yuhaocloud.cn", "/opt/campuspulse"]:
    Path(directory).mkdir(parents=True, exist_ok=True)
rpc_secret = secrets.token_hex(32)
Path("/etc/campuspulse/garage.toml").write_text('metadata_dir = "/var/lib/campuspulse/garage/meta"\ndata_dir = "/var/lib/campuspulse/garage/data"\ndb_engine = "lmdb"\nreplication_factor = 1\nrpc_bind_addr = "127.0.0.1:3901"\nrpc_public_addr = "127.0.0.1:3901"\nrpc_secret = "' + rpc_secret + '"\n[s3_api]\ns3_region = "garage"\napi_bind_addr = "127.0.0.1:3900"\n[admin]\napi_bind_addr = "127.0.0.1:3903"\nadmin_token = "' + secrets.token_hex(32) + '"\n')
Path("/etc/systemd/system/campuspulse-storage.service").write_text("[Unit]\nDescription=CampusPulse private S3 storage\nAfter=network.target\n[Service]\nUser=campuspulse\nGroup=campuspulse\nExecStart=/usr/local/bin/campuspulse-garage -c /etc/campuspulse/garage.toml server\nRestart=on-failure\nMemoryMax=384M\n[Install]\nWantedBy=multi-user.target\n")
run(["chown", "-R", "campuspulse:campuspulse", "/var/lib/campuspulse", "/opt/campuspulse"])
run(["chown", "root:campuspulse", "/etc/campuspulse", "/etc/campuspulse/garage.toml"])
os.chmod(config, 0o750)
os.chmod(config / "garage.toml", 0o640)
os.chmod("/usr/local/bin/campuspulse-garage", 0o755)
run(["systemctl", "daemon-reload"])
run(["systemctl", "enable", "--now", "campuspulse-storage"])
values = {
    "NODE_ENV": "production", "DEMO_AUTH_ENABLED": "false", "PORT": "3100", "HOSTNAME": "127.0.0.1",
    "DATABASE_URL": "postgresql://campuspulse:" + database_password + "@127.0.0.1:5432/campuspulse",
    "NEXTAUTH_URL": "https://cam.yuhaocloud.cn", "NEXTAUTH_SECRET": app_secret,
    "NEXT_PUBLIC_APP_URL": "https://cam.yuhaocloud.cn", "S3_ENDPOINT": "http://127.0.0.1:3900", "S3_REGION": "garage", "S3_BUCKET": "campuspulse",
    "SEED_ADMIN_EMAIL": "yuhao@campuspulse.local", "SEED_ADMIN_NAME": "郑宇豪", "SEED_ADMIN_PASSWORD": admin_password,
}
env = config / "app.env"
env.write_text("".join(key + "=" + json.dumps(value, ensure_ascii=False) + "\n" for key, value in values.items()))
os.chmod(env, 0o640)
run(["chown", "root:campuspulse", str(env)])
Path("/etc/campuspulse/initial-account.txt").write_text("Email: " + values["SEED_ADMIN_EMAIL"] + "\nPassword: " + admin_password + "\n")
os.chmod("/etc/campuspulse/initial-account.txt", 0o600)
nginx = Path("/www/server/panel/vhost/nginx/cam.yuhaocloud.cn.conf")
if nginx.exists():
    raise RuntimeError("An existing cam site configuration exists; inspect before replacing")
nginx.write_text("server {\n listen 80;\n server_name cam.yuhaocloud.cn;\n root /www/wwwroot/cam.yuhaocloud.cn;\n location /.well-known/acme-challenge/ { try_files $uri =404; }\n location / { return 503; }\n}\n")
run(["nginx", "-t"])
run(["nginx", "-s", "reload"])
print("Bootstrap complete: PostgreSQL, S3 service, private runtime environment, ACME webroot")

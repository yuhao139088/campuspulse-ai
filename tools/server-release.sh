#!/bin/sh
set -eu
set -a
. /etc/campuspulse/app.env
set +a
release_id=$(date +%Y%m%d-%H%M%S)
build_dir=/opt/campuspulse/releases/$release_id
runtime_dir=/opt/campuspulse/runtime/$release_id
mkdir -p "$build_dir" "$runtime_dir"
cd /opt/campuspulse/app
tar --exclude=node_modules --exclude=.next --exclude=.deployment-private --exclude='.env*' --exclude=.git --exclude=test-results --exclude=test-results-production --exclude=playwright-report -cf - . | tar -xf - -C "$build_dir"
cd "$build_dir"
npm ci --include=dev
npx prisma generate
npx prisma migrate deploy
NODE_OPTIONS=--max-old-space-size=1024 npm run build
cp -a .next/standalone/. "$runtime_dir/"
cp -a public "$runtime_dir/"
mkdir -p "$runtime_dir/.next/cache"
cp -a .next/static "$runtime_dir/.next/"
chown -R campuspulse:campuspulse "$runtime_dir"
previous=$(readlink -f /opt/campuspulse/current 2>/dev/null || true)
if [ -z "$previous" ]; then previous=/opt/campuspulse/app/.next/standalone; fi
ln -sfn "$runtime_dir" /opt/campuspulse/current
python3 - <<'PY'
from pathlib import Path
unit = Path('/etc/systemd/system/campuspulse-app.service')
value = unit.read_text().replace('/opt/campuspulse/app/.next/standalone', '/opt/campuspulse/current')
unit.write_text(value)
PY
systemctl daemon-reload
systemctl restart campuspulse-app
ready=false
for attempt in 1 2 3 4 5 6 7 8 9 10; do
  if curl --fail -s http://127.0.0.1:3100/api/health > /etc/campuspulse/release-health.json; then ready=true; break; fi
  sleep 2
done
if [ "$ready" != true ]; then
  ln -sfn "$previous" /opt/campuspulse/current
  systemctl restart campuspulse-app
  echo 'Release health failed; previous runtime restored'
  exit 1
fi
printf '%s\n' "$release_id" > /etc/campuspulse/current-release.txt
echo 'Release activated with database, private storage and AI readiness verified'

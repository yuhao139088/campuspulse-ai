#!/bin/sh
set -eu
umask 077
backup="/var/backups/campuspulse/$(date +%Y%m%d-%H%M%S)"
mkdir -p "$backup"
trap 'systemctl start campuspulse-storage campuspulse-app' EXIT
systemctl stop campuspulse-app campuspulse-storage
runuser -u postgres -- pg_dump -Fc campuspulse > "$backup/database.dump"
tar -czf "$backup/storage.tar.gz" -C /var/lib/campuspulse garage
cp /etc/campuspulse/app.env "$backup/app.env"
cp /etc/campuspulse/garage.toml "$backup/garage.toml"
systemctl start campuspulse-storage campuspulse-app
curl --retry 10 --retry-delay 1 --retry-all-errors --fail --silent http://127.0.0.1:3100/api/health > "$backup/health.json"
trap - EXIT
find /var/backups/campuspulse -mindepth 1 -maxdepth 1 -type d -mtime +7 -exec rm -rf -- {} +

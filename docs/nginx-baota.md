# Nginx / 宝塔

此站点使用独立配置，不覆盖宝塔其他网站。HTTP 仅保留 ACME 验证目录，其余请求重定向到 HTTPS。

```nginx
server {
    listen 80;
    server_name cam.yuhaocloud.cn;
    root /www/wwwroot/cam.yuhaocloud.cn;
    location /.well-known/acme-challenge/ { try_files $uri =404; }
    location / { return 301 https://$host$request_uri; }
}
server {
    listen 443 ssl;
    server_name cam.yuhaocloud.cn;
    ssl_certificate /etc/letsencrypt/live/cam.yuhaocloud.cn/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/cam.yuhaocloud.cn/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    client_max_body_size 21m;
    location / {
        proxy_cache off;
        proxy_no_cache 1;
        proxy_cache_bypass 1;
        proxy_pass http://127.0.0.1:3100;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-For $remote_addr;
        proxy_read_timeout 600s;
        proxy_send_timeout 600s;
    }
}
```

先执行 `nginx -t`，通过后 `nginx -s reload`。证书由 Certbot 自动续期，续期成功后 deploy hook reload Nginx。用户提供的 ZIP 仅含根证书，不能直接当作 HTTPS 站点证书。

本站必须关闭继承的代理缓存：部分宝塔全局配置开启 `proxy_cache cache_one`，会返回旧登录页，甚至缓存认证接口结果。不要仅对当前页面加随机查询参数；必须在站点location中显式关闭缓存，并验证敏感API匿名访问始终401。

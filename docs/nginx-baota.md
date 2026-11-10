# Nginx 反向代理配置

下面是 HTTPS 站点的参考配置。证书路径、域名、应用端口和 ACME 目录需按自己的服务器调整；不要覆盖同机其他网站配置。

    server {
        listen 80;
        server_name example.com;
        location /.well-known/acme-challenge/ { try_files $uri =404; }
        location / { return 301 https://$host$request_uri; }
    }

    server {
        listen 443 ssl;
        server_name example.com;
        ssl_certificate     /path/to/fullchain.pem;
        ssl_certificate_key /path/to/privkey.pem;
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

将配置写入当前站点配置后，先运行 nginx -t；通过后再 reload。确认认证接口、用户设置和业务 API 不会命中继承的全局代理缓存。应用仅监听可信的本地地址，数据库及对象存储控制端口不要暴露给公网。

证书私钥绝不可放入仓库。实际代理超时时间应与上传和 AI 请求预算一致，并通过负载测试校验。

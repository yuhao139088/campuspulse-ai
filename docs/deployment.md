# 生产部署与维护

## 当前架构

CentOS Stream 9、Nginx/宝塔、systemd、PostgreSQL 16、Garage 2.4.1私有S3存储、Tesseract中英文OCR。域名 `cam.yuhaocloud.cn`，正式环境 `DEMO_AUTH_ENABLED=false`。

| 项目 | 位置 |
| --- | --- |
| 当前源码 | /opt/campuspulse/app |
| 独立构建 | /opt/campuspulse/releases/<release-id> |
| 运行版本 | /opt/campuspulse/runtime/<release-id> |
| 当前版本链接 | /opt/campuspulse/current |
| 应用/对象服务 | campuspulse-app / campuspulse-storage |
| 应用环境 | /etc/campuspulse/app.env，root:campuspulse 0640 |
| 数据库 | 127.0.0.1:5432 |
| 私有S3 | 127.0.0.1:3900 |
| 应用端口 | 127.0.0.1:3100 |
| Nginx站点 | /www/server/panel/vhost/nginx/cam.yuhaocloud.cn.conf |
| 站点证书 | /etc/letsencrypt/live/cam.yuhaocloud.cn/ |
| 文件对象 | /var/lib/campuspulse/garage |

应用由独立低权限账号运行，systemd限制写入路径及内存。其他已有服务和网站配置保持独立。数据库和存储监听本机，不对外开放。

## 版本发布

上传源码时排除 `.env`及其他私密配置、`.git`、`node_modules`、`.next`、`.deployment-private`、所有测试结果/浏览器追踪。先备份数据库和对象，再执行：

```bash
sh /opt/campuspulse/app/tools/server-release.sh
```

脚本在新目录安装构建依赖（`npm ci --include=dev`）、生成Prisma客户端、应用迁移并构建。运行版本包含standalone、public、静态资源及可写cache目录；构建成功才切换current并重启。健康失败回滚运行版本链接。回滚代码不会撤销数据库迁移，因此迁移必须保持向后兼容。

2GB服务器使用两个构建CPU和1024MB构建堆，运行堆512MB，应用MemoryMax768MB。不得在运行目录直接构建/删除`.next`；这会导致静态资源丢失及systemd NAMESPACE错误。

生产Nginx站点显式 `proxy_cache off`、`proxy_no_cache 1`、`proxy_cache_bypass 1`，防止继承全局缓存造成旧登录页或身份数据泄漏。HTTP重定向HTTPS，保留ACME验证路径。

## 系统配置与AI

系统管理员在全站配置中心维护网站、注册、登录、邮件、短信、AI模型和导入限制。SMTP/AI/SMS配置保存数据库即时生效。初始AI从 `CARBON_AI_API_KEY` / `CARBON_AI_BASE_URL` / `CARBON_AI_MODEL` 加载。支持单独设置视觉模型。

基础设施连接和 `NEXTAUTH_SECRET` 仍由服务环境管理。该会话密钥同时派生配置/TOTP加密密钥，必须备份；不要直接更换使现有密钥无法解密。GitHubOAuth按后续集成任务启用。

详见 [认证配置](authentication.md) 和 [Nginx配置](nginx-baota.md)。生产不得使用固定验证码、静态报告、公开演示密码或伪造短信发送成功。

## 健康与维护

```bash
systemctl status campuspulse-app campuspulse-storage postgresql
curl --fail https://cam.yuhaocloud.cn/api/health
journalctl -u campuspulse-app -n 80 --no-pager
nginx -t
certbot renew --dry-run
```

健康检查真实访问数据库和对象桶；AI是否配置并不代表上游永远可用，后台提供真实连接测试。Nginx代理等待600秒；Agent设置总时间预算，导入最大20MB/20000行/150列，可在后台降低。

## 备份与恢复

`/usr/local/sbin/campuspulse-backup` 创建root私有备份，包含PostgreSQL dump、Garage对象数据及环境配置。定时任务在 `/etc/cron.d/campuspulse-backup`，每日03:23执行，保留7天。一致备份期间暂时停应用/存储，避免与验收测试并行；恢复启动由trap保障。

恢复需先停应用与存储，在单独维护环境验证数据库dump与对象数据一致性，再恢复生产环境。必须保留相同的会话/加密密钥和对象桶。备份不是公开项目内容，不得加入Git或源码发布包。旧runtime目录用于代码回滚，验证新版本稳定后再按明确目录清理历史构建。

## 容器部署

Dockerfile提供Node22、Tesseract及standalone服务。Docker Compose提供应用和PostgreSQL，私有S3需另行配置持久化服务；生产数据库与对象存储不能使用临时容器文件系统。所有凭据由环境注入。

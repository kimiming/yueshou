# 粤首多肽官网与管理后台

这是粤首官网的当前生产版本：Next.js 16 App Router、React 19、PostgreSQL、MinIO、Nginx、Auth.js、Ant Design 与 Apache ECharts。项目提供五种语言、产品与新闻管理、媒体库、工厂图片、社交媒体、客户留言、匿名流量统计、Cookie 同意管理、自动迁移、定时清理和加密备份。

## 当前保留的功能

官网主菜单固定为：

1. Home / 首页
2. About / 关于我们
3. Services / 服务
4. Products / 产品
5. News / 新闻
6. Contact / 联系我们

搜索、询价入口、产品/新闻/服务详情、语言切换、页脚法律链接、WhatsApp 和 Cookie 设置虽然不属于主菜单，但都是当前官网可见功能，因此保留。

后台菜单固定为：

1. 仪表盘
2. 媒体库
3. Our Factory
4. 社交媒体管理
5. 客户信息管理
6. 新闻管理
7. 产品管理
8. 用户管理

旧的通用内容、导航编辑、服务编辑、设置、审计和旧询盘管理页面已从路由中移除。数据库迁移历史仍完整保留，以便升级旧环境或在新服务器重建数据库。

## 生产架构

Docker Compose 会启动：

- `web`：Next.js 生产应用，仅在内部网络监听 3000。
- `postgres`：PostgreSQL 17，数据保存在 Docker volume。
- `minio`：私有对象存储，保存官网媒体和询盘附件，不公开 9000 端口。
- `nginx`：唯一对外入口，监听 80/443，代理官网和私有 S3 域名。
- `certbot`：自动续期 Let's Encrypt 证书。
- `migrate`：启动前执行 Prisma 前向迁移。
- `cron`：发布计划内容、清理过期上传和处理安全删除任务。
- `backup`：每天生成 PostgreSQL + MinIO 的 AES-256 加密备份。

建议服务器至少 4 GB 内存、2 核 CPU、40 GB SSD。只需对公网开放 TCP 80 和 443。

## 新 Linux 服务器一键部署

### 1. 准备域名

假设官网域名是 `example.com`，对象存储域名是 `s3.example.com`，请先添加 DNS A/AAAA 记录：

| 域名 | 指向 |
|---|---|
| `example.com` | 新服务器公网 IP |
| `www.example.com` | 新服务器公网 IP |
| `s3.example.com` | 新服务器公网 IP |

等待 DNS 生效。服务器安全组和防火墙必须允许 80/443。首次申请证书时 80 端口不能被其他程序占用。

### 2. 下载项目

```bash
sudo apt-get update
sudo apt-get install -y git
sudo mkdir -p /opt/yueshou
sudo chown "$USER":"$USER" /opt/yueshou
git clone <你的仓库地址> /opt/yueshou
cd /opt/yueshou
```

建议部署固定的 Git tag 或审核过的 commit，不要在生产机直接开发。

### 3. 执行一键脚本

```bash
sudo bash deploy/one-click-deploy.sh \
  --domain example.com \
  --storage-domain s3.example.com \
  --email ops@example.com \
  --admin-email admin@example.com
```

脚本会自动：

1. 安装 `curl`、`openssl` 和 Docker Engine（尚未安装时）。
2. 启动并设置 Docker 开机自启。
3. 创建权限为 `600` 的 `.env.docker`。
4. 生成彼此独立的数据库、Auth、询盘、Cron、MinIO 和备份强密钥。
5. 通过 Certbot 为官网、`www` 和 S3 域名申请同一张证书。
6. 校验 Docker Compose 和生产环境变量。
7. 构建所有生产镜像。
8. 启动 PostgreSQL 与 MinIO。
9. 执行全部 Prisma 迁移。
10. 空数据库时写入基础官网内容并创建首个管理员。
11. 启动 Web、Nginx、Cron、证书续期和加密备份。
12. 等待 `/api/ready` 通过并打印容器状态。

如果没有传 `--admin-password`，脚本会在终端显示一次随机管理员密码。立即存入密码管理器；该密码不会写入磁盘。也可以自行提供符合以下条件的密码：至少 12 位，同时包含大小写字母、数字和符号。

```bash
sudo bash deploy/one-click-deploy.sh \
  --domain example.com \
  --email ops@example.com \
  --admin-email admin@example.com \
  --admin-password '请替换为强密码'
```

部署完成后访问：

- 官网：`https://example.com`
- 后台：`https://example.com/admin/login`
- 就绪检查：`https://example.com/api/ready`

脚本可以重复执行：已有 `.env.docker`、TLS 证书、数据库和管理员不会被覆盖。

## 重要：迁移当前线上内容到新服务器

Git 只包含代码和数据库结构，不包含运行时上传的图片、客户数据和当前数据库内容。要让新服务器呈现与旧服务器完全一致的官网，必须同时迁移 PostgreSQL 与 MinIO。

在旧服务器创建便携加密备份：

```bash
cd /opt/yueshou
mkdir -p deployment-backups
deploy/backup/export-portable.sh deployment-backups
```

将生成的时间戳目录安全传到新服务器，并通过独立渠道传递 `BACKUP_ENCRYPTION_PASSPHRASE`。恢复前先启动基础服务：

```bash
docker compose --env-file .env.docker up -d postgres minio minio-init ops-init
```

把备份目录复制到 `backup_data` volume 的 `/backups/<时间戳>`，然后按照 [Docker 部署与恢复说明](docs/deployment/docker.md) 执行恢复。恢复会改写目标数据库，必须先验证备份并确认目标服务器。不要只复制图片文件；数据库中的媒体 ID、存储 key 和实际对象必须保持一致。

## 环境变量说明

一键脚本会生成 `.env.docker`。手动部署时可复制模板：

```bash
cp .env.docker.example .env.docker
chmod 600 .env.docker
```

核心变量：

| 变量 | 说明 |
|---|---|
| `POSTGRES_DB/USER/PASSWORD` | PostgreSQL 数据库与凭据 |
| `MINIO_ROOT_USER/PASSWORD` | MinIO 管理凭据，只提供给初始化服务 |
| `STORAGE_ACCESS_KEY_ID/SECRET_ACCESS_KEY` | 应用使用的 bucket 级凭据 |
| `STORAGE_BUCKET` | 私有媒体 bucket |
| `AUTH_SECRET` | 登录会话签名密钥，64 位十六进制 |
| `INQUIRY_HASH_SECRET` | 询盘安全摘要密钥，不能与 Auth 相同 |
| `CRON_SECRET` | 内部定时任务签名密钥 |
| `NEXT_PUBLIC_SITE_URL` | 完整 HTTPS 官网地址 |
| `SERVER_NAME` | 官网主机名，不带协议 |
| `STORAGE_HOST` | 独立的 S3 HTTPS 主机名 |
| `TLS_CERTS_DIR` | 主机证书目录，通常 `/etc/letsencrypt` |
| `BACKUP_ENCRYPTION_PASSPHRASE` | 加密备份口令，丢失后无法恢复 |
| `BACKUP_INTERVAL_SECONDS` | 备份周期，默认 86400 秒 |
| `CRON_INTERVAL_SECONDS` | 后台维护周期，默认 300 秒 |

不要提交 `.env.docker`。应把它和备份口令复制到加密的离线密码库。

## 手动 Docker 部署

不使用一键脚本时：

```bash
docker compose --env-file .env.docker config
docker compose --env-file .env.docker build --pull
docker compose --env-file .env.docker run --rm --no-deps validate
docker compose --env-file .env.docker up -d postgres minio
docker compose --env-file .env.docker run --rm migrate
docker compose --env-file .env.docker up -d --remove-orphans
docker compose --env-file .env.docker ps
```

新空数据库还需执行种子数据和管理员初始化，推荐直接使用一键脚本，避免遗漏安全确认变量。

## 日常更新

更新前先备份：

```bash
docker compose --env-file .env.docker run --rm --no-deps --entrypoint /backup/backup.sh backup
```

然后更新代码并部署：

```bash
git fetch --tags
git checkout <审核后的版本>
docker compose --env-file .env.docker build --pull
docker compose --env-file .env.docker run --rm migrate
docker compose --env-file .env.docker up -d --remove-orphans
docker compose --env-file .env.docker ps
```

Prisma 迁移是前向迁移。数据库结构发生变化后，不要仅回退代码镜像；需要使用经过验证的数据库备份恢复方案。

## 运维命令

```bash
# 状态
docker compose --env-file .env.docker ps

# 最近日志
docker compose --env-file .env.docker logs --tail=200 web nginx migrate cron backup

# 持续查看日志
docker compose --env-file .env.docker logs -f web nginx

# 重启 Web
docker compose --env-file .env.docker restart web nginx

# 手动执行备份
docker compose --env-file .env.docker run --rm --no-deps --entrypoint /backup/backup.sh backup

# 检查生产配置
docker compose --env-file .env.docker run --rm --no-deps validate
```

绝对不要在生产环境执行 `docker compose down -v`，它会删除 PostgreSQL、MinIO 和备份 volumes。

## Cookie 与流量统计

首次访问会显示 Cookie 选择。只有访客明确接受分析 Cookie 后才记录匿名页面浏览。系统不保存原始 IP 或完整 User-Agent；仪表盘展示时间、国家代码（需要 CDN 国家请求头）、设备类型和浏览器。没有同意的访问不会进入统计。

## 本地开发

要求 Node.js 22 和 pnpm 10.30.3：

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm prisma:generate
pnpm dev
```

常用检查：

```bash
pnpm lint
pnpm test
pnpm prisma validate
pnpm build
```

项目使用 Next.js 16，修改 App Router 代码前必须阅读 `node_modules/next/dist/docs/` 中当前版本文档，不能按旧版 Next.js 经验直接修改。

## 故障排查

### TLS 证书申请失败

- 确认三个 DNS 记录都指向本机。
- 确认 80/443 已在安全组和防火墙放行。
- 确认 Apache/Nginx 等其他进程没有占用 80。
- 查看：`docker ps -a` 和 Certbot 命令输出。

### 页面返回 502

```bash
docker compose --env-file .env.docker ps
docker compose --env-file .env.docker logs --tail=200 web postgres minio nginx
curl -k https://127.0.0.1/api/ready -H 'Host: example.com'
```

通常原因是数据库未健康、迁移失败、环境变量无效或 Web 仍在启动。

### 图片上传失败

- 确认 `STORAGE_HOST` DNS 与证书正确。
- 确认浏览器可以访问 `https://STORAGE_HOST`。
- 查看 `web`、`nginx`、`minio`、`minio-init` 日志。
- 不要公开 MinIO 9000/9001 端口。

### 后台无法登录

- 确认访问 `/admin/login`。
- 检查 `AUTH_SECRET` 没有在部署后被更换。
- 空数据库只会在首次部署时创建管理员；已有数据库不会覆盖现有用户。

### 国家或地区显示未知

设备和浏览器来自匿名 User-Agent 分类；国家需要 Cloudflare 等可信 CDN 注入 `CF-IPCountry`，或者后续配置本地 IP 地理数据库。项目不会把访客 IP 发送给第三方定位服务。

更多备份、恢复、网络和安全边界参见 [Docker 详细文档](docs/deployment/docker.md)。

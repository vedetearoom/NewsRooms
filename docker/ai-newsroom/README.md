# AI Newsroom Deployment

这个目录存放 `ai-newsroom` 的应用层部署文件。

当前文件：

- `docker-compose.yml`
  应用层 compose，负责 `frontend / backend / celery / nginx`
- `.env.example`
  应用层 compose 示例环境变量
- `nginx/default.conf`
  Nginx 反向代理配置

基础设施仍然由上一级 [docker-compose.yml](/Users/jay/Desktop/claude/docker/docker-compose.yml:1) 负责：

- PostgreSQL
- Redis
- MinIO
- RSSHub

推荐统一使用仓库根目录的 [docker-local.sh](/Users/jay/Desktop/claude/ai-newsroom/docker-local.sh:1) 来打镜像。

## 目录关系

- 基础设施目录：`/Users/jay/Desktop/claude/docker`
- 应用代码目录：`/Users/jay/Desktop/claude/ai-newsroom`
- 应用层部署目录：`/Users/jay/Desktop/claude/docker/ai-newsroom`

## 第一次使用

### 1. 启动基础设施

在 `/Users/jay/Desktop/claude/docker` 目录执行：

```bash
cd /Users/jay/Desktop/claude/docker
docker compose up -d
```

这一步会启动：

- PostgreSQL
- Redis
- MinIO
- RSSHub

### 2. 准备应用层环境变量

```bash
cp /Users/jay/Desktop/claude/docker/ai-newsroom/.env.example /Users/jay/Desktop/claude/docker/ai-newsroom/.env
cp /Users/jay/Desktop/claude/docker/ai-newsroom/config/backend.env.example /Users/jay/Desktop/claude/docker/ai-newsroom/config/backend.env
```

如果你需要改端口、镜像名、网络名，就改这份：

```bash
/Users/jay/Desktop/claude/docker/ai-newsroom/.env
```

后端和 Celery 真正读取的业务配置改这里：

```bash
/Users/jay/Desktop/claude/docker/ai-newsroom/config/backend.env
```

这两个文件不重复：

- `.env` 负责 compose 层、构建层和前端运行时配置，比如端口、镜像名、基础镜像源、npm/pip/apt 镜像源、前端 Clerk 公开 key
- `config/backend.env` 负责后端运行时业务配置，比如数据库、Redis、MinIO、模型 key、Clerk 认证密钥

## 最常用命令

下面这些命令都在项目根目录执行：

```bash
cd /Users/jay/Desktop/claude/ai-newsroom
```

### 1. 构建当前机器架构的前后端镜像

```bash
./docker-local.sh local
```

适合本地直接运行。这个命令会一起构建 `backend + frontend`，并自动识别当前机器是 `arm64` 还是 `amd64`。

### 2. 生成多架构离线包，不推远端

```bash
./docker-local.sh archive
```

生成的文件默认在：

```bash
/Users/jay/Desktop/claude/ai-newsroom/dist/docker
```

默认会同时导出：

- `linux/amd64`
- `linux/arm64`
- `backend + frontend`

### 3. 启动应用层服务

`docker-local.sh` 现在只负责打镜像。应用层启动、停止、日志查看，统一直接用 `docker compose`。

先确保你已经准备好环境变量：

```bash
cp /Users/jay/Desktop/claude/docker/ai-newsroom/.env.example /Users/jay/Desktop/claude/docker/ai-newsroom/.env
cp /Users/jay/Desktop/claude/docker/ai-newsroom/config/backend.env.example /Users/jay/Desktop/claude/docker/ai-newsroom/config/backend.env
```

启动：

```bash
docker compose --env-file /Users/jay/Desktop/claude/docker/ai-newsroom/.env -f /Users/jay/Desktop/claude/docker/ai-newsroom/docker-compose.yml up -d
```

这一步会启动：

- `backend`
- `celery`
- `frontend`
- `nginx`

默认访问地址：

- Nginx 聚合入口：`http://localhost:8080`
- 前端直连：`http://localhost:3000`
- 后端直连：`http://localhost:8000`

### 4. 停止应用层服务

```bash
docker compose --env-file /Users/jay/Desktop/claude/docker/ai-newsroom/.env -f /Users/jay/Desktop/claude/docker/ai-newsroom/docker-compose.yml down
```

### 5. 查看日志

```bash
docker compose --env-file /Users/jay/Desktop/claude/docker/ai-newsroom/.env -f /Users/jay/Desktop/claude/docker/ai-newsroom/docker-compose.yml logs -f
```

只看后端：

```bash
docker compose --env-file /Users/jay/Desktop/claude/docker/ai-newsroom/.env -f /Users/jay/Desktop/claude/docker/ai-newsroom/docker-compose.yml logs -f backend
```

只看 Celery：

```bash
docker compose --env-file /Users/jay/Desktop/claude/docker/ai-newsroom/.env -f /Users/jay/Desktop/claude/docker/ai-newsroom/docker-compose.yml logs -f celery
```

### 6. 查看 compose 展开配置

```bash
docker compose --env-file /Users/jay/Desktop/claude/docker/ai-newsroom/.env -f /Users/jay/Desktop/claude/docker/ai-newsroom/docker-compose.yml config
```

## 按场景直接照抄

### 场景 1：本地正常启动整套服务

```bash
cd /Users/jay/Desktop/claude/docker
docker compose up -d

cp /Users/jay/Desktop/claude/docker/ai-newsroom/.env.example /Users/jay/Desktop/claude/docker/ai-newsroom/.env
cp /Users/jay/Desktop/claude/docker/ai-newsroom/config/backend.env.example /Users/jay/Desktop/claude/docker/ai-newsroom/config/backend.env

cd /Users/jay/Desktop/claude/ai-newsroom
./docker-local.sh local

docker compose --env-file /Users/jay/Desktop/claude/docker/ai-newsroom/.env -f /Users/jay/Desktop/claude/docker/ai-newsroom/docker-compose.yml up -d
```

### 场景 2：只想导出 `amd64 + arm64` 离线镜像包

```bash
cd /Users/jay/Desktop/claude/ai-newsroom
./docker-local.sh archive
```

## 可改项

如果你需要调整部署行为，优先改这份文件：

```bash
/Users/jay/Desktop/claude/docker/ai-newsroom/.env
```

常见项包括：

- `AI_NEWSROOM_HTTP_PORT`
- `AI_NEWSROOM_BACKEND_PORT`
- `AI_NEWSROOM_FRONTEND_PORT`
- `AI_NEWSROOM_CELERY_CONCURRENCY`
- `AI_NEWSROOM_INTERNAL_API_URL`
- `AI_NEWSROOM_INFRA_NETWORK`
- `AI_NEWSROOM_NODE_BASE_IMAGE`
- `AI_NEWSROOM_PYTHON_BASE_IMAGE`
- `AI_NEWSROOM_NPM_REGISTRY`
- `AI_NEWSROOM_APT_MIRROR_HOST`
- `AI_NEWSROOM_PIP_INDEX_URL`
- `AI_NEWSROOM_PLAYWRIGHT_DOWNLOAD_HOST`

后端业务配置、数据库、Redis、MinIO、模型 key、认证密钥这些改这里：

```bash
/Users/jay/Desktop/claude/docker/ai-newsroom/config/backend.env
```

常见项包括：

- `DATABASE_URL`
- `DATABASE_URL_SYNC`
- `REDIS_URL`
- `MINIO_ENDPOINT`
- `RSSHUB_BASE_URL`
- `GEMINI_API_KEY`
- `QWEN_API_KEY`
- `JINA_API_KEY`
- `AUTH_SECRET_KEY`

补充说明：

- `GEMINI_API_KEY`、`QWEN_API_KEY` 通常不是必填
  这个项目更常见的做法是进入前端 Agents 页面，给各个 agent 单独配置 `api_key`
- `JINA_API_KEY` 是可选增强
  不填时网页提取会退回基础 HTML 抓取
- `AUTH_SECRET_KEY` 建议一定改掉默认值
- `CREDENTIAL_ENCRYPTION_SECRET` 建议填写并长期保持不变
  否则之前保存到数据库里的平台 Cookie 可能无法解密

## 备注

- 这套应用层 compose 不负责启动数据库、Redis、MinIO、RSSHub，它们仍然由上一级 `docker-compose.yml` 管理。
- `docker-local.sh` 默认会自动读取 `/Users/jay/Desktop/claude/docker/ai-newsroom/.env`；如果没有这个文件，会回退到 `.env.example`。
- `docker-local.sh` 现在只保留两个入口：`local` 和 `archive`。
- `backend` 和 `celery` 会挂载 `./config` 目录，并在容器里读取 `/run/config/backend.env`。
- 前端不是纯静态部署，而是 `Next.js server + Nginx` 反向代理。

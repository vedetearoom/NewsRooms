# AI Newsroom

AI Newsroom 是一个带有前后端与后台任务系统的内容生产工作台，覆盖以下能力：

- 新闻源抓取与原始文章处理
- intelligence cards 生成与归档
- 写作任务、审稿、改写
- 视频监控与视频分析
- inspirations / vault 管理
- 智能体配置与流式生成

## 仓库结构

- [frontend](/Users/jay/Desktop/claude/ai-newsroom/frontend)
  Next.js 前端应用
- [backend](/Users/jay/Desktop/claude/ai-newsroom/backend)
  FastAPI + Celery + SQLAlchemy 后端
- [start-backend.sh](/Users/jay/Desktop/claude/ai-newsroom/start-backend.sh:1)
  本地启动后端 API 的主入口
- [start-celery.sh](/Users/jay/Desktop/claude/ai-newsroom/start-celery.sh:1)
  本地启动 Celery worker
- [start-frontend.sh](/Users/jay/Desktop/claude/ai-newsroom/start-frontend.sh:1)
  本地启动前端

后端详细说明见 [backend/README.md](/Users/jay/Desktop/claude/ai-newsroom/backend/README.md:1)。

## 当前状态

这套仓库当前的结构状态大致是：

- 前端：
  - 页面层已经统一了一轮壳层、加载态、空态、错误态
  - `shared` 热点组件已经做过减重，主要共享壳层已经沉淀
  - 任务状态、异步反馈、视频/图文列表展示口径已经统一
- 后端：
  - `main.py` 保持应用入口职责
  - `tasks / jobs / monitors / sources / raw_articles / cards` 已改成薄路由 + service
  - `models.py / schemas.py` 已按领域拆分并保留聚合导出
  - worker 主链路已经收口到 `workers/tasks.py + services/worker_jobs.py`

更具体的分层说明见：

- [frontend/README.md](/Users/jay/Desktop/claude/ai-newsroom/frontend/README.md:1)
- [backend/README.md](/Users/jay/Desktop/claude/ai-newsroom/backend/README.md:1)

## 本地启动

### 1. 启动后端

```bash
bash start-backend.sh
```

如果你在 [backend](/Users/jay/Desktop/claude/ai-newsroom/backend) 目录中，也可以运行：

```bash
bash start_backend.sh
```

它会委托到根目录主入口，保持相同的启动方式和端口。

### 2. 启动 Celery

```bash
bash start-celery.sh
```

### 3. 启动前端

```bash
bash start-frontend.sh
```

## 项目文档

- [frontend/README.md](/Users/jay/Desktop/claude/ai-newsroom/frontend/README.md:1)
  前端模块、共享组件、页面状态与异步反馈约定
- [backend/README.md](/Users/jay/Desktop/claude/ai-newsroom/backend/README.md:1)
  后端分层、主链路与 service 边界约定

## Docker 部署

仓库根目录现在提供了这些容器化文件：

- [docker-local.sh](/Users/jay/Desktop/claude/ai-newsroom/docker-local.sh:1)
  本地统一打包脚本，只负责两件事：构建当前机器架构镜像、导出多架构离线包
- [../docker/ai-newsroom/docker-compose.yml](</Users/jay/Desktop/claude/docker/ai-newsroom/docker-compose.yml>)
  启动前端、后端、Celery 和 Nginx 反向代理
- [../docker/ai-newsroom/.env.example](</Users/jay/Desktop/claude/docker/ai-newsroom/.env.example>)
  Compose 推荐环境变量模板

当前这套 compose 默认假设：

- 同级的 [../docker/docker-compose.yml](</Users/jay/Desktop/claude/docker/docker-compose.yml>) 已经负责 PostgreSQL、Redis、MinIO、RSSHub 这些基础设施
- [../docker/ai-newsroom](</Users/jay/Desktop/claude/docker/ai-newsroom>) 负责应用层服务：`frontend + backend + celery + nginx`
- 前端对外既可以直接跑 Next.js，也可以放在 Nginx 反向代理后面

推荐启动顺序：

### 1. 启动同级基础设施

```bash
cd /Users/jay/Desktop/claude/docker
docker compose up -d
```

### 2. 构建当前机器架构镜像

```bash
cd /Users/jay/Desktop/claude/ai-newsroom
./docker-local.sh local
```

### 3. 启动应用层服务

```bash
cp ../docker/ai-newsroom/.env.example ../docker/ai-newsroom/.env
cp ../docker/ai-newsroom/config/backend.env.example ../docker/ai-newsroom/config/backend.env
docker compose --env-file ../docker/ai-newsroom/.env -f ../docker/ai-newsroom/docker-compose.yml up -d
```

默认访问入口：

- Nginx 聚合入口：`http://localhost:8080`
- 前端直连：`http://localhost:3000`
- 后端直连：`http://localhost:8000`

### 多架构镜像构建

如果你只是想本地生成可运行镜像，推荐直接用统一脚本：

```bash
cd /Users/jay/Desktop/claude/ai-newsroom
./docker-local.sh local
```

如果你不想推远端，但又想一次生成多架构产物，推荐导出本地 OCI 归档包：

```bash
./docker-local.sh archive
```

默认会输出到：

```bash
dist/docker/
```

这套设计里需要注意两点：

- 前端不是导出纯静态站点，而是保留 Next.js server，并通过 [../docker/ai-newsroom/nginx/default.conf](</Users/jay/Desktop/claude/docker/ai-newsroom/nginx/default.conf>) 兼容 Nginx 反向代理
- Celery 作为独立服务启动，不和 FastAPI API 进程混在一个容器里
- 后端和 Celery 的业务配置优先从 [../docker/ai-newsroom/config/backend.env.example](</Users/jay/Desktop/claude/docker/ai-newsroom/config/backend.env.example>) 复制出的挂载配置文件读取，而不是继续把所有变量都堆在 compose 里
- `docker-local.sh local` 默认同时构建 `backend + frontend`
- `docker-local.sh archive` 默认同时导出 `linux/amd64 + linux/arm64` 的 `backend + frontend`

## 本地遗留文件盘点

### 数据库文件

当前仓库源码目录中，已经没有保留根目录或 `backend/` 下的本地 sqlite 占位文件。

盘点结论：

- 当前运行配置见 [backend/app/config.py](/Users/jay/Desktop/claude/ai-newsroom/backend/app/config.py:1)，实际使用的是 PostgreSQL：
  - `database_url`
  - `database_url_sync`
- 同级的 [docker/docker-compose.yml](</Users/jay/Desktop/claude/docker/docker-compose.yml>) 和 `volumes/pg/` 才是当前数据库运行目录
- `backend/` 下原先那 3 个 `0B` sqlite 占位文件已经清理
- 根目录原先的 `newsroom.db` 也已经清理，避免误导为“项目仍依赖本地 sqlite”

处理建议：

- 后续本地若再生成调试用 `.db` 文件，建议只放在运行目录或临时目录，不再放回仓库根目录

### 测试与排障脚本

目前仓库里保留的测试 / 排障入口主要有两类：

- 后端正式回归测试统一收敛到 [backend/tests](/Users/jay/Desktop/claude/ai-newsroom/backend/tests)
- 后端手工执行脚本统一保留在 [backend/scripts](/Users/jay/Desktop/claude/ai-newsroom/backend/scripts)

盘点结论：

- 根目录原先那批 `test_api.py`、`test_api_3.py`、`test_db.py`、`test_db_2.py`、`test_dedup.py`、`test_get_inspirations.py` 都属于手工验证脚本
- 它们没有接入正式测试体系，部分脚本只是临时查库、直接调用路由函数，或者依赖旧上下文
- 前端当前并没有真正接入 Jest / Vitest / Playwright 之类的自动化测试体系
- `backend/tests/` 里原先那类手工探测脚本也已经挪出，只保留正式回归测试
- 这批临时脚本已经清理或迁出，避免和正式测试目录混在一起

处理建议：

- 后端正式回归测试继续以 [backend/tests](/Users/jay/Desktop/claude/ai-newsroom/backend/tests) 为准
- 后续若还需要手工排障脚本，建议统一放到 `backend/scripts/` 或单独的 `tools/manual-tests/`

### 迁移与修复脚本

根目录原先存在一批一次性数据库修补脚本：`migrate.py`、`add_col.py`、`fix_db.py`。

盘点结论：

- `migrate.py`、`add_col.py` 明显属于一次性手动加列脚本
- `fix_db.py` 直接写死旧的 sqlite 路径，已经和当前 PostgreSQL 配置不匹配
- 这批根目录旧脚本已经清理，避免后续误执行到旧修复逻辑
- `backend/scripts/` 里仍保留脚本目录，但历史一次性迁移脚本已归到 `backend/scripts/legacy/`

处理建议：

- 后续如果还需要一次性迁移脚本，优先放到 [backend/scripts](/Users/jay/Desktop/claude/ai-newsroom/backend/scripts) 或独立迁移目录，并写明适用版本

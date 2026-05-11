# AI Newsroom Backend

后端基于 `FastAPI + SQLAlchemy + Celery + Redis`，负责以下几类能力：

- 新闻源抓取与原始文章入库
- 文章处理与 intelligence cards 生成
- 写作任务、草稿、审稿结果管理
- 视频监控、视频分析与监控任务状态跟踪
- 智能体配置、文本改写、灵感聊天
- 定时任务调度与后台 worker 执行

## 目录

- `app/main.py`
  FastAPI 应用入口，只负责应用初始化、middleware 和 router 注册。
- `app/api/`
  HTTP 路由层。当前原则是“薄路由”，只保留入参、出参与路由装配。
- `app/services/`
  业务服务层。
  例如：
  - `monitor_service.py`
  - `job_dispatcher.py`
  - `job_service.py`
  - `task_service.py`
  - `source_service.py`
  - `raw_article_service.py`
  - `card_service.py`
  - `worker_jobs.py`
  - `processor.py`
  - `processor_support.py`
- `app/workers/tasks.py`
  Celery task 入口层。当前只保留 task 壳、日志和 retry 策略。
- `app/model_defs/`
  按领域拆分后的 SQLAlchemy model 定义。
- `app/schema_defs/`
  按领域拆分后的 Pydantic schema 定义。
- `app/models.py` / `app/schemas.py`
  聚合导出层，方便现有代码继续统一导入。
- `scripts/`
  手工执行脚本目录。当前保留可操作脚本，并将历史一次性迁移脚本收在 `scripts/legacy/`。
- `tests/`
  后端统一正式测试目录。包含功能测试、监控测试、视频链路测试，以及本轮并发/异步回归测试。

## 依赖

核心依赖见 [requirements.txt](/Users/jay/Desktop/claude/ai-newsroom/backend/requirements.txt:1)。

主要包括：

- `fastapi`
- `uvicorn`
- `sqlalchemy`
- `asyncpg`
- `psycopg`
- `redis`
- `celery`
- `apscheduler`
- `google-genai`
- `openai`
- `boto3`
- `yt-dlp`

## 环境变量

配置来自 [app/config.py](/Users/jay/Desktop/claude/ai-newsroom/backend/app/config.py:1)，默认从仓库根目录的 `.env` 读取。

常用变量：

- `DATABASE_URL`
  默认映射到 `database_url`
- `DATABASE_URL_SYNC`
  默认映射到 `database_url_sync`
- `REDIS_URL`
  Celery 和 job manager 使用
- `ENABLE_SCHEDULER`
  是否在 API 进程内启动 APScheduler；默认 `true`
- `GEMINI_API_KEY`
  Gemini 模型调用
- `QWEN_API_KEY`
  Qwen / DashScope 模型调用
- `JINA_API_KEY`
  可选，网页抽取增强
- `CORS_ORIGINS`
  默认 `http://localhost:3000`
- `SCRAPE_CRON`
  定时抓取表达式，默认每 4 小时执行一次
- `MINIO_ENDPOINT`
- `MINIO_ACCESS_KEY`
- `MINIO_SECRET_KEY`
- `MINIO_BUCKET`
- `RSSHUB_BASE_URL`
- `DOCKER_COMPOSE_DIR`

默认本地开发端口配置里，后端通常跑在：

- FastAPI: `8000`
- PostgreSQL: `23012`
- Redis: `23013`
- MinIO: `23016`
- RSSHub: `23017`

## 本地启动

### 1. 创建虚拟环境并安装依赖

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 2. 启动 API 服务

仓库根目录推荐方式：

```bash
bash start-backend.sh
```

它会进入 `backend/`，优先使用 `.venv/bin/python` 启动：

```bash
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

如果你已经在 `backend/` 目录里，也可以继续使用兼容入口：

```bash
bash start_backend.sh
```

注意：

- [start-backend.sh](/Users/jay/Desktop/claude/ai-newsroom/start-backend.sh:1) 是主入口
- [backend/start_backend.sh](/Users/jay/Desktop/claude/ai-newsroom/backend/start_backend.sh:1) 是兼容包装层，最终也会委托到根目录脚本
- 当前默认开发端口统一为 `8000`

### 3. 启动 Celery Worker

```bash
bash start-celery.sh
```

对应脚本见 [start-celery.sh](/Users/jay/Desktop/claude/ai-newsroom/start-celery.sh:1)。

### 4. 可选：检查健康状态

```bash
curl http://127.0.0.1:8000/api/health
```

## Docker 运行

后端容器化入口见：

- [Dockerfile](/Users/jay/Desktop/claude/ai-newsroom/backend/Dockerfile:1)
- [../../docker/ai-newsroom/docker-compose.yml](</Users/jay/Desktop/claude/docker/ai-newsroom/docker-compose.yml>)

这套设计里：

- `backend` 服务负责 FastAPI API
- `celery` 服务复用同一份后端镜像，但用不同命令启动 worker
- `ENABLE_SCHEDULER=true` 只放在 API 容器里，避免把定时调度和 Celery worker 混在一起
- 业务配置优先从挂载的 `backend.env` 读取，不再把所有变量都堆在 compose 里
- 镜像内已经补齐 `ffmpeg` 和 Playwright Chromium，方便视频链路与监控发现逻辑直接运行

如果你要在 compose 里跑后端，推荐从仓库根目录执行：

```bash
cd /Users/jay/Desktop/claude/ai-newsroom
cp ../docker/ai-newsroom/.env.example ../docker/ai-newsroom/.env
cp ../docker/ai-newsroom/config/backend.env.example ../docker/ai-newsroom/config/backend.env
./docker-local.sh local
docker compose --env-file ../docker/ai-newsroom/.env -f ../docker/ai-newsroom/docker-compose.yml up -d backend celery
```

## 关键运行链路

### 新闻抓取链路

1. `sources` 路由触发抓取任务
2. `job_dispatcher` 提交 Celery 任务
3. `workers/tasks.py` 进入 worker
4. `worker_jobs.py` 调用 `scraper.py`
5. 原始文章写入 `raw_articles`

### 文章处理链路

1. `raw_articles` 或 `jobs` 路由触发处理
2. Celery task 进入 `worker_jobs.py`
3. `processor.py` 负责主流程
4. `processor_support.py` 负责 prompt、模型调用、JSON 解析
5. 结果写入 `intelligence_cards`

### 审稿链路

1. `stream` 路由发起 review
2. `job_dispatcher` 提交 review worker
3. `worker_jobs.py` 调用 `AssassinAgent`
4. 结果写入 `drafts` / `critiques`
5. SSE 端轮询 DB 返回结果

### 视频监控链路

1. `monitors` 路由处理监控 CRUD / check / dispatch
2. `monitor_service.py` 负责 RSS 检查、cookie 配置、任务分发、状态同步
3. 视频分析由 Celery worker 进入 `VideoAnalyzer`
4. 结果写入 video 类型的 `intelligence_cards`

## 当前结构状态

这一轮重构后，后端主链路已经基本形成稳定分层：

- 应用入口：
  - `main.py` 只负责应用初始化、middleware、router 注册
- API 层：
  - `tasks / jobs / monitors / sources / raw_articles / cards` 已经统一走“薄路由”
  - 路由层不再直接承载主业务查询、复杂聚合、job 查询与状态拼装
- Service 层：
  - `task_service.py`：任务读写、重生成、翻译、状态更新
  - `job_service.py`：后台任务触发与 job 查询
  - `monitor_service.py`：监控 CRUD、RSS 检查、Cookie 配置、视频任务状态同步
  - `source_service.py`：数据源 CRUD、启停、手动抓取
  - `raw_article_service.py`：原始文章列表、统计、批量处理、删除
  - `card_service.py`：情报卡片查询、归档、已读、删除
- Worker 层：
  - `workers/tasks.py` 保持 task 壳层
  - `worker_jobs.py` 承担实际 worker 业务编排

## 分层约定

新增后端功能时，尽量遵守这几个边界：

- `api/`：
  - 只做参数接收、依赖注入、response model 绑定和 service 调用
- `services/`：
  - 放业务流程、聚合查询、跨 repository 的协调逻辑、job 触发封装
- `repositories/`：
  - 放单领域、偏数据访问的操作
- `workers/`：
  - 放 Celery task 壳和重试策略
- `services/worker_jobs.py`：
  - 放 worker 实际执行逻辑和任务结果协议

## 当前建议

## 测试

推荐从 [tests/README.md](/Users/jay/Desktop/claude/ai-newsroom/backend/tests/README.md:1) 作为入口查看当前测试分组与跑法。

最常用命令：

```bash
cd backend
./.venv/bin/python -m unittest discover -s tests -p 'test*.py'
```

只跑本轮回归重点：

```bash
cd backend
./.venv/bin/python -m unittest -v tests.test_external_integrations
```

后续如果还要继续整理，优先级建议是：

- 把仍然一次性的旧脚本继续往 `scripts/legacy/` 收口
- 在 `services/` 里继续补领域级文档或类型说明
- 如果后面引入正式测试体系，再把现有手工验证脚本收口到统一目录

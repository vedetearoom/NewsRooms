# AI Newsroom

AI Newsroom is an AI-assisted content production workbench for editors and content teams. It connects source ingestion, material processing, intelligence cards, draft generation, review/rewrite workflows, video monitoring, image generation, and access control into a configurable private content pipeline.

中文文档: [README.md](README.md)

## Features

- **Source ingestion**: Pull content from RSS / RSSHub, with scheduled and manual ingestion.
- **Intelligence cards**: Convert raw articles into structured AI summaries for editorial triage and reuse.
- **Writing and review workflow**: Generate drafts, run AssassinAgent reviews, compare diffs, and rewrite content.
- **Video monitoring**: Monitor YouTube, Bilibili, and other video platforms, then route new content into analysis pipelines.
- **Vault and inspiration library**: Store references, reusable materials, and inspiration snippets.
- **Agent configuration**: Configure models and API keys per agent, with SSE streaming output.
- **Plugin system**: Install third-party plugins from GitHub and bind them to agents. Each user configures their own GitHub Token to avoid API rate limits.
- **Image generation**: Generate cover images or illustrations for cards and tasks.
- **Access control and system management**: Manage users, roles, permissions, quotas, and optional Clerk user sync.

## Repository layout

```text
NewsRoom/
├── ai-newsroom/                # Application source
│   ├── backend/                # FastAPI + Celery + SQLAlchemy backend
│   ├── frontend/               # Next.js 16 + React 19 frontend
│   ├── start-backend.sh        # Local backend launcher
│   ├── start-celery.sh         # Local Celery worker launcher
│   ├── start-frontend.sh       # Local frontend launcher
│   └── docker-local.sh         # Local image build helper
└── docker/
    ├── docker-compose.yml      # Infrastructure: PostgreSQL, Redis, MinIO, RSSHub
    ├── rsshub.env.example      # RSSHub cookie configuration template
    └── ai-newsroom/
        ├── docker-compose.yml  # App services: backend, Celery workers, frontend, nginx
        ├── .env.example        # Compose / image / port configuration template
        ├── config/             # Runtime backend.env configuration
        └── nginx/default.conf  # Nginx reverse proxy configuration
```

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS 4, Zustand, SWR |
| Backend | FastAPI, SQLAlchemy async, Pydantic v2 |
| Queue | Celery + Redis |
| Scheduler | APScheduler, running in the API process |
| Database | PostgreSQL 15 |
| Object storage | MinIO, S3-compatible |
| RSS | RSSHub |
| AI models | Google Gemini, Qwen / DashScope, DeepSeek, OpenAI-compatible APIs |
| Web/video extraction | Playwright, yt-dlp, optional Jina Reader |
| Authentication | Local accounts + optional Clerk JWT / webhook sync |

## Local development

### Requirements

- Python 3.11+
- Node.js 20+
- `uv`, used by local scripts to create the backend virtualenv and install Python dependencies
- Docker and Docker Compose, used for PostgreSQL, Redis, MinIO, and RSSHub

### 1. Start infrastructure

```bash
cd docker
cp rsshub.env.example rsshub.env
docker network create metalm-base-net 2>/dev/null || true
docker compose up -d
```

This starts PostgreSQL, Redis, MinIO, and RSSHub:

| Service | Local port |
|---|---|
| PostgreSQL | `23012` |
| Redis | `23013` |
| MinIO | `23016` |
| RSSHub | `23017` |

> `docker/rsshub.env` is local/deployment runtime configuration and is ignored by Git. Never commit real cookies.

### 2. Configure backend environment variables

For local development, start from the backend template:

```bash
cp ai-newsroom/backend/.env.example ai-newsroom/backend/.env
```

Fill in Clerk, model keys, or other local settings as needed. `start-backend.sh` reads `ai-newsroom/backend/.env`.

### 3. Start the backend API

```bash
cd ai-newsroom
bash start-backend.sh
```

The script creates `.venv` and installs dependencies via `uv` when the virtualenv is missing. The backend runs on `http://localhost:8000` by default. Health check:

```bash
curl http://localhost:8000/api/health
```

### 4. Start the Celery worker

```bash
bash start-celery.sh
```

Many ingestion, processing, video analysis, and generation flows depend on Celery. If only the backend API is running, endpoints can respond but async jobs may remain queued.

### 5. Start the frontend

```bash
bash start-frontend.sh
```

The script runs `npm ci` when `node_modules` is missing. The frontend runs on `http://localhost:3000` by default.

## Backend environment variables

The backend reads configuration files in this precedence order:

1. File pointed to by `AI_NEWSROOM_SETTINGS_FILE`
2. `/run/config/backend.env`, the Docker-mounted runtime config
3. `ai-newsroom/.env`
4. `ai-newsroom/backend/.env`

Common variables:

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | `postgresql+asyncpg://...@localhost:23012/metalm` | Async database connection |
| `DATABASE_URL_SYNC` | `postgresql+psycopg://...@localhost:23012/metalm` | Sync database connection |
| `REDIS_URL` | `redis://:metalm2024@localhost:23013/0` | Redis for Celery and job management |
| `GEMINI_API_KEY` | empty | Google Gemini API key |
| `QWEN_API_KEY` | empty | Qwen / DashScope API key |
| `JINA_API_KEY` | empty | Optional enhanced web extraction via Jina Reader |
| `MINIO_ENDPOINT` | `http://127.0.0.1:23016` | MinIO endpoint |
| `MINIO_ACCESS_KEY` | `minioadmin` | MinIO access key; local default only |
| `MINIO_SECRET_KEY` | `minioadmin` | MinIO secret key; local default only |
| `MINIO_BUCKET` | `newsroom-images` | MinIO bucket |
| `RSSHUB_BASE_URL` | `http://localhost:23017` | RSSHub endpoint |
| `AUTH_SECRET_KEY` | `ai-newsroom-dev-secret` | JWT signing key; must be changed in production |
| `CREDENTIAL_ENCRYPTION_SECRET` | empty | Encryption key for platform cookies; keep stable after deployment |
| `CORS_ORIGINS` | `http://localhost:3000` | Allowed frontend origins |
| `ENABLE_SCHEDULER` | `true` | Whether APScheduler runs in the API process |
| `SCRAPE_CRON` | `0 */4 * * *` | Source ingestion cron, every 4 hours by default |
| `CLERK_ISSUER` | empty | Optional Clerk JWT issuer |
| `CLERK_JWKS_URL` | empty | Optional explicit Clerk JWKS URL; derived from `CLERK_ISSUER` when empty |
| `CLERK_SECRET_KEY` | empty | Optional Clerk Backend API secret key |
| `CLERK_WEBHOOK_SECRET` | empty | Optional Clerk/Svix webhook signing secret |
| `CLERK_ADMIN_EMAILS` | empty | Comma-separated admin email allowlist; matching users receive `super_admin` |
| `NEWSROOM_TENANT_ROOT` | `/var/lib/newsroom` | Root directory for user data (plugins, workspace, run records, etc.) |
| `GITHUB_TOKEN` | empty | Optional global GitHub PAT fallback; per-user tokens take precedence |

`GEMINI_API_KEY` and `QWEN_API_KEY` are not required at startup. Prefer configuring model credentials per agent in the frontend Agent page.

## Clerk webhook and admin bootstrap

The backend exposes a Clerk webhook endpoint:

```text
POST /api/webhooks/clerk
```

For local testing, expose the backend with Cloudflare Tunnel, ngrok, or another HTTPS tunnel, for example:

```bash
cloudflared tunnel --url http://localhost:8000 run dev-tunnel
```

In the Clerk Dashboard, configure the endpoint as:

```text
https://<your-domain>/api/webhooks/clerk
```

Recommended events:

- `user.created`
- `user.updated`
- `user.deleted`

Sync behavior:

- `user.created` / `user.updated` create or update local users.
- `user.deleted` marks the local user inactive; it does not physically delete the row.
- Emails listed in `CLERK_ADMIN_EMAILS` automatically receive the `super_admin` role, which enables System Management UI access.
- Other Clerk events return success and are ignored.

## Activation code sign-up and Clerk email code

The frontend sign-up page uses a custom Clerk email/password flow:

1. The user enters email, username, password, activation code, and access reason.
2. The backend `POST /api/auth/activation-code/approve` validates the activation code and records the request.
3. The frontend starts Clerk sign-up and sends an email verification code.
4. The user enters the code in the page to finish registration.
5. Clerk webhook or login-time sync creates the local user.

Activation codes only gate this product's own self-service sign-up page. They do not depend on Clerk Allowlist and are not a hard identity-layer restriction. If a user is created successfully through Clerk Dashboard, another entry point, or a future open sign-up flow, the backend still trusts Clerk and syncs the local user.

Confirm these Clerk Dashboard settings:

- Waitlist mode and Restricted mode are disabled so the normal sign-up flow can run.
- Email sign-up, email sign-in, and password sign-up are enabled.
- Verify at sign-up uses Email verification code / OTP, not email link as the primary flow.
- Webhook still subscribes to `user.created`, `user.updated`, and `user.deleted`.

For Docker deployments, create and fill the runtime config files:

```bash
cp docker/ai-newsroom/.env.example docker/ai-newsroom/.env
cp docker/ai-newsroom/config/backend.env.example docker/ai-newsroom/config/backend.env
```

Then copy the local Clerk values into the corresponding backend and frontend Docker settings.

## Frontend environment variables

```bash
NEXT_PUBLIC_API_URL=http://localhost:8000
INTERNAL_API_URL=http://localhost:8000
```

If omitted, the frontend defaults to `localhost:8000`. In Nginx deployments, browser requests use same-origin `/api/*` paths, so hard-coding the backend origin is not required.

## Docker deployment

Deployment has two layers:

- **Infrastructure**: `docker/docker-compose.yml`, containing PostgreSQL, Redis, MinIO, and RSSHub.
- **Application services**: `docker/ai-newsroom/docker-compose.yml`, containing backend, 3 Celery workers, frontend, and nginx.

First-time startup example:

```bash
# 1. Start infrastructure
cd docker
cp rsshub.env.example rsshub.env
docker network create metalm-base-net 2>/dev/null || true
docker compose up -d

# 2. Build application images; the script detects arm64 / amd64
cd ../ai-newsroom
./docker-local.sh local

# 3. Prepare application config
cp ../docker/ai-newsroom/.env.example ../docker/ai-newsroom/.env
cp ../docker/ai-newsroom/config/backend.env.example ../docker/ai-newsroom/config/backend.env
# Edit .env with public frontend config, such as AI_NEWSROOM_NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY.
# Edit backend.env with real API keys, database passwords, auth secrets, and Clerk backend config.

# 4. Start application services
docker compose --env-file ../docker/ai-newsroom/.env \
  -f ../docker/ai-newsroom/docker-compose.yml up -d
```

Entrypoints:

| Service | URL |
|---|---|
| Unified Nginx entrypoint | `http://localhost:8080` |
| Direct frontend | `http://localhost:3000` |
| Direct backend API | `http://localhost:8000` |

Production deployments split Celery into 3 independent workers by task type:

| Worker | Queues | Default concurrency | Responsibilities |
|---|---|---|---|
| `celery-fast` | `newsroom_fast`, `newsroom_default`, `celery` | 2 | RSS scraping, manual scraping, monitor discovery — fast I/O tasks |
| `celery-ai` | `newsroom_ai` | 1 | Article processing, AI review, video metadata analysis, plugin install — LLM inference tasks |
| `celery-video` | `newsroom_video` | 1 | Full video analysis: download audio, transcription, LLM analysis, save card |

Local development uses `start-celery.sh` to run a single combined worker that listens on all queues.

Build options:

```bash
# Build images for the current machine architecture
./docker-local.sh local

# Export a linux/amd64 + linux/arm64 multi-arch OCI archive without pushing
./docker-local.sh archive
# Output directory: ai-newsroom/dist/docker/
```

Configuration files:

| File | Purpose |
|---|---|
| `docker/ai-newsroom/.env` | Compose-layer config: ports, image names, build mirrors, npm / pip / apt mirrors, public frontend Clerk config |
| `docker/ai-newsroom/config/backend.env` | Backend runtime config: database, Redis, MinIO, model keys, auth secrets, Clerk secret / webhook config |
| `docker/rsshub.env` | RSSHub cookies and local runtime config; must not be committed |
| `docker/rsshub.env.example` | Commit-safe RSSHub config template |

Production deployments must replace all default secrets and passwords, especially `AUTH_SECRET_KEY`, `DEFAULT_ADMIN_PASSWORD`, database, Redis, MinIO, Clerk, and model API keys.

Running `docker compose up -d` again does not clear the existing database. On startup, the backend creates missing tables and applies lightweight checks for known missing columns; existing data is preserved. Only delete database volumes when you intentionally want a local reset or the schema is damaged and cannot start.

## RSSHub cookie safety

`docker/rsshub.env` is loaded through Docker Compose `env_file` and may contain platform cookies for Bilibili, Xiaohongshu, and other sources. Real cookies are sensitive and must not be committed.

Safe setup:

```bash
cd docker
cp rsshub.env.example rsshub.env
```

If cookies are needed, prefer filling them from the System Management UI or the video monitor cookie configuration UI. The app writes to local `docker/rsshub.env`; restart or recreate the RSSHub container after changes.

## Backend architecture

```text
app/
├── main.py              # App initialization, middleware, router registration
├── api/                 # HTTP routes for validation, auth, and responses
├── services/            # Business logic and cross-domain coordination
│   ├── worker_jobs.py   # Celery worker execution logic
│   ├── job_dispatcher.py
│   ├── monitor_service.py
│   ├── card_service.py
│   └── ...
├── workers/tasks.py     # Celery task wrappers, retry policies, logging
├── model_defs/          # SQLAlchemy models split by domain
├── schema_defs/         # Pydantic schemas split by domain
├── models.py            # Model aggregate exports
├── schemas.py           # Schema aggregate exports
├── repositories/        # Single-domain data access
└── config.py            # pydantic-settings configuration
```

Celery worker split:

```text
celery_app.py          # Celery instance, task routing, global config
workers/
├── tasks.py           # Task wrappers: retry policies, timeouts, logging
└── cron_jobs.py       # APScheduler cron scheduling, enabled only in the backend process
services/
└── worker_jobs.py     # Actual task execution logic
```

- **celery-fast**: Scraping tasks — I/O-bound with no LLM calls, can run at higher concurrency.
- **celery-ai**: AI inference tasks — large per-task token and memory usage, concurrency set to 1.
- **celery-video**: Full video analysis — mixed I/O + CPU + AI load, longest timeout (55 min), isolated to avoid blocking other tasks.

Key flows:

- **Source ingestion**: `sources` route → `job_dispatcher` → Celery task → `worker_jobs` → `scraper` → `raw_articles`
- **Article processing**: `raw_articles` / `jobs` routes → Celery task → `processor` → `processor_support` calls LLM → `intelligence_cards`
- **Review and rewrite**: `stream` route → `job_dispatcher` → AssassinAgent → `drafts` / `critiques` → SSE polling
- **Video monitoring**: `monitors` route → `monitor_service` → RSS check or cookie mode → Celery task → `VideoAnalyzer` → video intelligence card
- **Clerk sync**: `clerk_webhooks` route → Svix signature verification → `clerk_sync_service` → local user and role sync
- **Plugin installation**: `plugins` route → `plugin_service` → Celery task → `plugin_source` downloads and validates GitHub snapshot → binds to agent

## Tests and quality checks

### Backend tests

```bash
cd ai-newsroom/backend

# Run all backend tests
./.venv/bin/python -m unittest discover -s tests -p 'test*.py'

# Run a specific test module
./.venv/bin/python -m unittest -v tests.test_external_integrations
```

Formal tests live in `ai-newsroom/backend/tests/`. The repository also contains a few manual or experimental scripts; they are not part of the official regression suite.

### Frontend checks

```bash
cd ai-newsroom/frontend
npm run lint
npm run build
```

There is currently no dedicated frontend test runner and no standalone `typecheck` script. `npm run build` is the main frontend build and type-checking gate.

### Recommended high-priority tests or fixes

- **Clerk sync regression**: Test `user.created`, `user.updated`, `user.deleted`, missing/invalid Svix signatures, repeated deliveries, and `CLERK_ADMIN_EMAILS` role assignment.
- **Auth and permissions**: Test local login, Clerk JWT login, expired tokens, inactive users, `system.manage` route protection, and System Management menu visibility.
- **Celery dependency**: Test job submission, status display, and frontend messaging when Redis or Celery is not running.
- **Database initialization**: Test startup with an empty database and an existing legacy schema to ensure startup schema adjustments do not block the service.
- **Frontend API routes**: Test `/api/generate-image`, `/api/agents/chat`, and `/api/stream/...` in both local development and Docker/Nginx deployment.
- **Image generation quota**: Decide whether provider/config failures should consume quota; the current behavior needs product confirmation.
- **Webhook export button**: The editor still has a simulated webhook push entry. If it is not a real feature, disable it, hide it, or label it as not configured.
- **Deployment security**: Production must not use local defaults such as `admin123`, `ai-newsroom-dev-secret`, `metalm2024`, or `minioadmin`.

## Default account

On first startup, the backend creates a default administrator account:

| Field | Value |
|---|---|
| Username | `admin` |
| Email | `admin@newsroom.local` |
| Password | `admin123` |

For production, change the default account through `DEFAULT_ADMIN_*` environment variables or through the System Management UI after login.

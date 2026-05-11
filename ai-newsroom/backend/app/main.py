import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import admin, agents, auth, cards, inspirations, jobs, monitors, plugins, quota, raw_articles, seed, sources, stream, tasks, upload
from app.config import get_settings
from app.database import init_db
from app.workers.cron_jobs import start_scheduler, stop_scheduler

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting AI Newsroom backend...")
    await init_db()
    if settings.enable_scheduler:
        start_scheduler()
    else:
        logger.info("APScheduler disabled by ENABLE_SCHEDULER=false")
    yield
    if settings.enable_scheduler:
        stop_scheduler()


app = FastAPI(title="AI Newsroom", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins.split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(upload.assets_router)
app.include_router(sources.router)
app.include_router(cards.router)
app.include_router(tasks.router)
app.include_router(stream.router)
app.include_router(agents.router)
app.include_router(agents.skills_router)
app.include_router(plugins.router)
app.include_router(auth.router)
app.include_router(admin.router)
app.include_router(quota.router)
app.include_router(raw_articles.router)
app.include_router(upload.router)
app.include_router(seed.router)
app.include_router(monitors.router)
app.include_router(inspirations.router)
app.include_router(jobs.router)


@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "AI Newsroom"}

import asyncio
import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[2]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from sqlalchemy import text
from app.database import engine

async def migrate():
    async with engine.begin() as conn:
        print("Migrating agents table...")
        try:
            await conn.execute(text("ALTER TABLE agents ADD COLUMN api_key VARCHAR(255);"))
            print("Successfully added api_key to agents table.")
        except Exception as e:
            print(f"Migration failed or column already exists: {e}")

if __name__ == "__main__":
    asyncio.run(migrate())

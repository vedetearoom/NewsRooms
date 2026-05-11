import asyncio
import os
import sys
from pathlib import Path

from dotenv import load_dotenv
import psycopg

BACKEND_ROOT = Path(__file__).resolve().parents[2]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

load_dotenv()

async def main():
    db_url = os.environ.get("DATABASE_URL_SYNC")
    if not db_url:
        print("DATABASE_URL_SYNC not found in env")
        return
        
    print(f"Connecting to {db_url}")
    # psycopg connection string from psycopg v3
    conn = psycopg.connect(db_url.replace("postgresql+psycopg://", "postgresql://"))
    try:
        conn.execute("ALTER TABLE agents ADD COLUMN is_active BOOLEAN DEFAULT FALSE;")
        conn.commit()
        print("Successfully added is_active column.")
    except Exception as e:
        print("Error executing migration (maybe already exists?):", e)
    finally:
        conn.close()

if __name__ == "__main__":
    asyncio.run(main())

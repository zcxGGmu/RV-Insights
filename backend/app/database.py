from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from psycopg_pool import AsyncConnectionPool
import redis.asyncio as aioredis
import os

from .config import settings


class DatabaseManager:
    def __init__(self) -> None:
        self.mongo_client: AsyncIOMotorClient | None = None
        self.mongo_db: AsyncIOMotorDatabase | None = None
        self.pg_pool: AsyncConnectionPool | None = None
        self.redis: aioredis.Redis | None = None

    async def connect_all(self) -> None:
        # In testing, skip real connections to keep unit tests fast and hermetic
        if os.environ.get("RV_INSIGHTS_TESTING") == "1":
            self.mongo_client = None
            self.mongo_db = None
            self.pg_pool = None
            self.redis = None
            return

        # MongoDB
        if not self.mongo_client:
            self.mongo_client = AsyncIOMotorClient(settings.MONGODB_URI)
        if not self.mongo_db and self.mongo_client:
            self.mongo_db = self.mongo_client[settings.MONGODB_DB]

        # PostgreSQL
        if not self.pg_pool:
            # AsyncConnectionPool handles pooling for async psycopg connections
            self.pg_pool = AsyncConnectionPool(settings.POSTGRES_URI)

        # Redis
        if not self.redis:
            self.redis = aioredis.from_url(settings.REDIS_URI, decode_responses=True)

    async def disconnect_all(self) -> None:
        if self.mongo_client:
            try:
                self.mongo_client.close()
            except Exception:
                pass

        if self.pg_pool:
            try:
                await self.pg_pool.close()
            except Exception:
                pass

        if self.redis:
            try:
                await self.redis.aclose()
            except Exception:
                pass

        self.mongo_client = None
        self.mongo_db = None
        self.pg_pool = None
        self.redis = None

    async def health_check(self) -> dict:
        status = {
            "mongodb": "disconnected",
            "postgres": "disconnected",
            "redis": "disconnected",
        }

        # Mongo ping
        try:
            if self.mongo_db:
                await self.mongo_db.command("ping")
                status["mongodb"] = "connected"
        except Exception:
            status["mongodb"] = "disconnected"

        # Postgres ping/check
        try:
            if self.pg_pool:
                # Acquire a connection and execute a simple query
                async with self.pg_pool.acquire() as conn:
                    async with conn.cursor() as cur:
                        await cur.execute("SELECT 1")
                        status["postgres"] = "connected"
        except Exception:
            status["postgres"] = "disconnected"

        # Redis ping
        try:
            if self.redis:
                pong = await self.redis.ping()
                if pong:
                    status["redis"] = "connected"
        except Exception:
            status["redis"] = "disconnected"

        return status

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from psycopg_pool import AsyncConnectionPool
import redis.asyncio as aioredis
import os
import structlog

from .config import settings

logger = structlog.get_logger()


class DatabaseManager:
    def __init__(self) -> None:
        self.mongo_client: AsyncIOMotorClient | None = None
        self.mongo_db: AsyncIOMotorDatabase | None = None
        self.pg_pool: AsyncConnectionPool | None = None
        self.redis: aioredis.Redis | None = None

    async def connect_all(self) -> None:
        # In testing, skip real connections
        if os.environ.get("RV_INSIGHTS_TESTING") == "1":
            return

        # MongoDB — best-effort, don't block startup
        try:
            self.mongo_client = AsyncIOMotorClient(
                settings.MONGODB_URI,
                serverSelectionTimeoutMS=5000,
                connectTimeoutMS=5000,
            )
            self.mongo_db = self.mongo_client[settings.MONGODB_DB]
            # Verify connection with a fast ping
            await self.mongo_db.command("ping")
            # Create indexes (best-effort)
            try:
                users_col = self.mongo_db["users"]
                await users_col.create_index([("email", 1)], unique=True)
                await users_col.create_index([("created_at", 1)])
                cases_col = self.mongo_db["cases"]
                await cases_col.create_index([("owner_id", 1), ("created_at", 1)])
                await cases_col.create_index([("status", 1)])
                await cases_col.create_index([("target_repo", 1)])
                chat_col = self.mongo_db["chat_sessions"]
                await chat_col.create_index(
                    [("user_id", 1), ("updated_at", -1)],
                    name="idx_chat_sessions_user_id_updated_at",
                )
                await chat_col.create_index(
                    [("status", 1)],
                    name="idx_chat_sessions_status",
                )
                await chat_col.create_index(
                    [("is_shared", 1)],
                    name="idx_chat_sessions_is_shared",
                )
                models_col = self.mongo_db["model_configs"]
                await models_col.create_index(
                    [("user_id", 1)],
                    name="idx_model_configs_user_id",
                )
                await models_col.create_index(
                    [("is_system", 1)],
                    name="idx_model_configs_is_system",
                )
                memories_col = self.mongo_db["user_memories"]
                await memories_col.create_index(
                    [("user_id", 1)],
                    unique=True,
                    name="idx_user_memories_user_id",
                )
                files_col = self.mongo_db["session_files"]
                await files_col.create_index(
                    [("session_id", 1)],
                    name="idx_session_files_session_id",
                )
            except Exception:
                logger.warning("mongodb_index_creation_failed")
            logger.info("mongodb_connected", uri=settings.MONGODB_URI)
        except Exception as e:
            logger.warning("mongodb_connection_failed", error=str(e))
            self.mongo_client = None
            self.mongo_db = None

        # PostgreSQL — best-effort
        try:
            self.pg_pool = AsyncConnectionPool(
                settings.POSTGRES_URI,
                min_size=0,
                max_size=10,
                open=False,
                timeout=5.0,
            )
            await self.pg_pool.open(wait=False)
            # Quick connectivity test
            async with self.pg_pool.connection(timeout=3.0) as conn:
                await conn.execute("SELECT 1")
            logger.info("postgres_connected", uri=settings.POSTGRES_URI)
        except Exception as e:
            logger.warning("postgres_connection_failed", error=str(e))
            if self.pg_pool:
                try:
                    await self.pg_pool.close()
                except Exception:
                    pass
            self.pg_pool = None

        # Redis — best-effort
        try:
            self.redis = aioredis.from_url(settings.REDIS_URI, decode_responses=True)
            await self.redis.ping()
            logger.info("redis_connected", uri=settings.REDIS_URI)
        except Exception as e:
            logger.warning("redis_connection_failed", error=str(e))
            self.redis = None

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
            if self.mongo_db is not None:
                await self.mongo_db.command("ping")
                status["mongodb"] = "connected"
        except Exception:
            status["mongodb"] = "disconnected"

        # Postgres ping/check
        try:
            if self.pg_pool is not None:
                async with self.pg_pool.connection() as conn:
                    await conn.execute("SELECT 1")
                    status["postgres"] = "connected"
        except Exception:
            status["postgres"] = "disconnected"

        # Redis ping
        try:
            if self.redis is not None:
                pong = await self.redis.ping()
                if pong:
                    status["redis"] = "connected"
        except Exception:
            status["redis"] = "disconnected"

        return status

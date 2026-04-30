"""Shared helpers for pipeline node functions."""

from __future__ import annotations

import structlog

from ..state import PipelineState  # noqa: F401

logger = structlog.get_logger()


async def get_publisher():
    """Return an EventPublisher connected to Redis, or None if unavailable."""
    try:
        import redis.asyncio as aioredis

        from app.config import settings
        from app.pipeline.events import EventPublisher

        r = aioredis.from_url(settings.REDIS_URI, decode_responses=True)
        await r.ping()
        return EventPublisher(r)
    except Exception:
        return None


async def close_publisher(publisher) -> None:
    """Gracefully close the Redis client inside a publisher."""
    if publisher is None:
        return
    try:
        await publisher.redis.aclose()
    except Exception:
        pass


async def publish_fire_and_forget(
    case_id: str, event_type: str, data: dict,
) -> None:
    """Fire-and-forget event publish (creates a short-lived Redis connection)."""
    try:
        import redis.asyncio as aioredis

        from app.config import settings
        from app.models.schemas import EventType
        from app.pipeline.events import EventPublisher

        r = aioredis.from_url(settings.REDIS_URI, decode_responses=True)
        pub = EventPublisher(r)
        et = (
            EventType(event_type)
            if event_type in {e.value for e in EventType}
            else EventType.agent_output
        )
        await pub.publish(case_id, et, data)
        await r.aclose()
    except Exception:
        pass

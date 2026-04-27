import json
from datetime import datetime, timezone
from typing import List, Optional

import redis.asyncio as aioredis
import structlog

from app.models.schemas import PipelineEvent, EventType

logger = structlog.get_logger()


class EventPublisher:
    """Publishes pipeline events to Redis Pub/Sub (real-time) and Stream (reconnection recovery)."""

    def __init__(self, redis_client: aioredis.Redis):
        self.redis = redis_client

    async def _next_seq(self, case_id: str) -> int:
        """Get next monotonically increasing sequence number for a case."""
        key = f"case:{case_id}:seq"
        return await self.redis.incr(key)

    async def publish(self, case_id: str, event_type: EventType, data: dict) -> PipelineEvent:
        """
        Publish a pipeline event.
        
        1. Generate monotonic seq via Redis INCR
        2. Build PipelineEvent
        3. PUBLISH to Pub/Sub channel for real-time SSE
        4. XADD to Stream for reconnection recovery (MAXLEN 500)
        
        Returns the published PipelineEvent.
        """
        seq = await self._next_seq(case_id)
        event = PipelineEvent(
            seq=seq,
            case_id=case_id,
            event_type=event_type,
            data=data,
            timestamp=datetime.now(timezone.utc),
        )
        
        payload = event.model_dump_json()
        channel = f"case:{case_id}:events"
        stream_key = f"case:{case_id}:stream"

        # Pub/Sub for real-time delivery
        await self.redis.publish(channel, payload)

        # Stream for reconnection recovery (capped at 500 entries)
        await self.redis.xadd(stream_key, {"event": payload}, maxlen=500)

        logger.debug("event_published", case_id=case_id, seq=seq, event_type=event_type.value)
        return event

    async def publish_stage_change(self, case_id: str, stage: str, status: str, message: str = "") -> PipelineEvent:
        """Convenience: publish a stage_change event."""
        return await self.publish(
            case_id=case_id,
            event_type=EventType.stage_change,
            data={"stage": stage, "status": status, "message": message},
        )

    async def publish_error(self, case_id: str, message: str, recoverable: bool = True) -> PipelineEvent:
        """Convenience: publish an error event."""
        return await self.publish(
            case_id=case_id,
            event_type=EventType.error,
            data={"message": message, "recoverable": recoverable},
        )

    async def publish_heartbeat(self, case_id: str) -> PipelineEvent:
        """Convenience: publish a heartbeat event."""
        return await self.publish(
            case_id=case_id,
            event_type=EventType.heartbeat,
            data={},
        )

    async def publish_review_request(self, case_id: str, stage: str, iteration: int) -> PipelineEvent:
        """Convenience: publish a review_request event."""
        return await self.publish(
            case_id=case_id,
            event_type=EventType.review_request,
            data={"stage": stage, "iteration": iteration},
        )

    async def publish_cost_update(self, case_id: str, cost: dict) -> PipelineEvent:
        """Convenience: publish a cost_update event."""
        return await self.publish(
            case_id=case_id,
            event_type=EventType.cost_update,
            data=cost,
        )

    async def get_events_since(self, case_id: str, last_seq: int) -> List[PipelineEvent]:
        """
        Retrieve events from Redis Stream with seq > last_seq.
        Used for SSE reconnection recovery via Last-Event-ID.
        """
        stream_key = f"case:{case_id}:stream"
        # Read all entries from the stream
        entries = await self.redis.xrange(stream_key, min="-", max="+")
        
        events: List[PipelineEvent] = []
        for _entry_id, fields in entries:
            raw = fields.get("event")
            if not raw:
                continue
            try:
                event = PipelineEvent.model_validate_json(raw)
                if event.seq > last_seq:
                    events.append(event)
            except Exception:
                logger.warning("event_parse_failed", stream_key=stream_key)
                continue
        
        return events

    async def subscribe(self, case_id: str):
        """
        Create a Redis Pub/Sub subscription for a case's event channel.
        Returns an async generator that yields PipelineEvent objects.
        
        Usage:
            async for event in publisher.subscribe(case_id):
                yield event
        """
        channel = f"case:{case_id}:events"
        pubsub = self.redis.pubsub()
        await pubsub.subscribe(channel)
        
        try:
            async for message in pubsub.listen():
                if message["type"] != "message":
                    continue
                raw = message["data"]
                try:
                    event = PipelineEvent.model_validate_json(raw)
                    yield event
                except Exception:
                    logger.warning("event_parse_failed_pubsub", channel=channel)
                    continue
        finally:
            await pubsub.unsubscribe(channel)
            await pubsub.aclose()

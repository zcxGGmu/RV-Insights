from __future__ import annotations

from datetime import UTC, datetime

import redis.asyncio as aioredis
import structlog

from app.models.schemas import EventType, PipelineEvent

logger = structlog.get_logger()


class EventPublisher:
    """Publishes pipeline events to Redis Pub/Sub and Stream."""

    def __init__(self, redis_client: aioredis.Redis):
        self.redis = redis_client

    async def _next_seq(self, case_id: str) -> int:
        key = f"case:{case_id}:seq"
        return await self.redis.incr(key)

    async def publish(
        self, case_id: str, event_type: EventType, data: dict,
    ) -> PipelineEvent:
        seq = await self._next_seq(case_id)
        event = PipelineEvent(
            seq=seq,
            case_id=case_id,
            event_type=event_type,
            data=data,
            timestamp=datetime.now(UTC),
        )

        payload = event.model_dump_json()
        channel = f"case:{case_id}:events"
        stream_key = f"case:{case_id}:stream"

        await self.redis.publish(channel, payload)
        await self.redis.xadd(stream_key, {"event": payload}, maxlen=500)

        logger.debug(
            "event_published",
            case_id=case_id, seq=seq, event_type=event_type.value,
        )
        return event

    async def publish_stage_change(
        self, case_id: str, stage: str, status: str, message: str = "",
    ) -> PipelineEvent:
        return await self.publish(
            case_id=case_id,
            event_type=EventType.stage_change,
            data={"stage": stage, "status": status, "message": message},
        )

    async def publish_error(
        self, case_id: str, message: str, recoverable: bool = True,
    ) -> PipelineEvent:
        return await self.publish(
            case_id=case_id,
            event_type=EventType.error,
            data={"message": message, "recoverable": recoverable},
        )

    async def publish_heartbeat(self, case_id: str) -> PipelineEvent:
        return await self.publish(
            case_id=case_id,
            event_type=EventType.heartbeat,
            data={},
        )

    async def publish_review_request(
        self, case_id: str, stage: str, iteration: int,
    ) -> PipelineEvent:
        return await self.publish(
            case_id=case_id,
            event_type=EventType.review_request,
            data={"stage": stage, "iteration": iteration},
        )

    async def publish_cost_update(
        self, case_id: str, cost: dict,
    ) -> PipelineEvent:
        return await self.publish(
            case_id=case_id,
            event_type=EventType.cost_update,
            data=cost,
        )

    async def publish_thinking(
        self, case_id: str, content: str,
    ) -> PipelineEvent:
        return await self.publish(
            case_id=case_id,
            event_type=EventType.agent_output,
            data={"type": "thinking", "content": content},
        )

    async def publish_tool_call(
        self, case_id: str, tool_name: str, args: dict,
    ) -> PipelineEvent:
        return await self.publish(
            case_id=case_id,
            event_type=EventType.agent_output,
            data={"type": "tool_call", "tool_name": tool_name, "args": args},
        )

    async def publish_tool_result(
        self, case_id: str, tool_name: str, result: str,
    ) -> PipelineEvent:
        return await self.publish(
            case_id=case_id,
            event_type=EventType.agent_output,
            data={
                "type": "tool_result",
                "tool_name": tool_name,
                "result": result,
            },
        )

    async def get_events_since(
        self, case_id: str, last_seq: int,
    ) -> list[PipelineEvent]:
        stream_key = f"case:{case_id}:stream"
        entries = await self.redis.xrange(stream_key, min="-", max="+")

        events: list[PipelineEvent] = []
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
        """Async generator that yields PipelineEvent from Redis Pub/Sub."""
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
                    logger.warning(
                        "event_parse_failed_pubsub", channel=channel,
                    )
                    continue
        finally:
            await pubsub.unsubscribe(channel)
            await pubsub.aclose()

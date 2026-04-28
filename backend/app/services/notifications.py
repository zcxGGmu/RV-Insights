from __future__ import annotations

import asyncio
import logging
import time
from typing import Any, AsyncIterator

import shortuuid

logger = logging.getLogger(__name__)

_subscribers: dict[str, asyncio.Queue] = {}

QUEUE_MAXSIZE = 256


async def subscribe() -> tuple[str, AsyncIterator[dict[str, Any]]]:
    sub_id = shortuuid.uuid()
    queue: asyncio.Queue = asyncio.Queue(maxsize=QUEUE_MAXSIZE)
    _subscribers[sub_id] = queue

    async def _iter():
        while True:
            event = await queue.get()
            if event is None:
                break
            yield event

    return sub_id, _iter()


async def unsubscribe(sub_id: str) -> None:
    queue = _subscribers.pop(sub_id, None)
    if queue is not None:
        try:
            queue.put_nowait(None)
        except asyncio.QueueFull:
            pass


async def publish(event_type: str, data: dict[str, Any]) -> None:
    data.setdefault("timestamp", time.time())
    event = {"event": event_type, "data": data}
    dead: list[str] = []
    for sub_id, queue in _subscribers.items():
        try:
            queue.put_nowait(event)
        except asyncio.QueueFull:
            dead.append(sub_id)
            logger.warning("notification subscriber %s queue full, dropping", sub_id)
    for sub_id in dead:
        _subscribers.pop(sub_id, None)

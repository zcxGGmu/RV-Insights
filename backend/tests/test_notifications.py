from __future__ import annotations

import asyncio

import pytest

from app.services.notifications import _subscribers, publish, subscribe, unsubscribe


@pytest.fixture(autouse=True)
def _clean_subscribers():
    _subscribers.clear()
    yield
    _subscribers.clear()


@pytest.mark.asyncio
async def test_subscribe_and_publish():
    sub_id, events = await subscribe()
    assert sub_id in _subscribers

    await publish("session_created", {"session_id": "s1", "user_id": "u1"})

    event = await asyncio.wait_for(events.__anext__(), timeout=1)
    assert event["event"] == "session_created"
    assert event["data"]["session_id"] == "s1"
    assert "timestamp" in event["data"]


@pytest.mark.asyncio
async def test_unsubscribe_stops_iterator():
    sub_id, events = await subscribe()
    await unsubscribe(sub_id)
    assert sub_id not in _subscribers

    collected = []
    async for ev in events:
        collected.append(ev)
    assert collected == []


@pytest.mark.asyncio
async def test_publish_fans_out_to_multiple_subscribers():
    sub_id_1, events_1 = await subscribe()
    sub_id_2, events_2 = await subscribe()

    await publish("session_updated", {"session_id": "s2", "user_id": "u2"})

    ev1 = await asyncio.wait_for(events_1.__anext__(), timeout=1)
    ev2 = await asyncio.wait_for(events_2.__anext__(), timeout=1)
    assert ev1["data"]["session_id"] == "s2"
    assert ev2["data"]["session_id"] == "s2"

    await unsubscribe(sub_id_1)
    await unsubscribe(sub_id_2)


@pytest.mark.asyncio
async def test_publish_no_subscribers_is_noop():
    await publish("session_created", {"session_id": "s3", "user_id": "u3"})

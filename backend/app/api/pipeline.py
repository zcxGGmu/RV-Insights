from __future__ import annotations

import asyncio
import uuid
from datetime import datetime
from typing import Optional

import structlog
from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from sse_starlette.sse import EventSourceResponse

from app.api.deps import get_current_user, get_db
from app.models.user import UserInDB
from app.models.schemas import CaseResponse, CaseStatus, PipelineEvent, ReviewDecision
from app.pipeline.events import EventPublisher
from langgraph.errors import GraphInterrupt
from app.pipeline.graph import create_compiled_graph

logger = structlog.get_logger()
router = APIRouter()

HEARTBEAT_INTERVAL = 15


def _doc_to_response(doc: dict) -> CaseResponse:
    return CaseResponse(
        id=str(doc.get("_id")),
        title=doc.get("title", ""),
        status=CaseStatus(doc.get("status", "created")),
        target_repo=doc.get("target_repo", ""),
        input_context=doc.get("input_context", ""),
        owner_id=str(doc.get("owner_id", "")),
        exploration_result=doc.get("exploration_result"),
        execution_plan=doc.get("execution_plan"),
        development_result=doc.get("development_result"),
        review_verdict=doc.get("review_verdict"),
        test_result=doc.get("test_result"),
        review_iterations=doc.get("review_iterations", 0),
        created_at=doc.get("created_at"),
        updated_at=doc.get("updated_at"),
        cost=doc.get("cost", {"total_input_tokens": 0, "total_output_tokens": 0, "estimated_cost_usd": 0.0}),
    )


@router.get("/{case_id}/events")
async def stream_events(
    case_id: str,
    request: Request,
    last_event_id: Optional[str] = Header(None, alias="Last-Event-ID"),
    db=Depends(get_db),
    user: UserInDB = Depends(get_current_user),
):
    cases = db.mongo_db["cases"]
    case_doc = await cases.find_one({"_id": case_id})
    if not case_doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Case not found")

    if not db.redis:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Redis unavailable")

    publisher = EventPublisher(db.redis)

    async def event_generator():
        # 1. Replay missed events if reconnecting
        if last_event_id:
            try:
                last_seq = int(last_event_id)
                missed = await publisher.get_events_since(case_id, last_seq)
                for event in missed:
                    yield {
                        "id": str(event.seq),
                        "event": event.event_type.value,
                        "data": event.model_dump_json(),
                    }
            except (ValueError, TypeError):
                pass

        # 2. Subscribe to real-time events via Pub/Sub
        channel = f"case:{case_id}:events"
        pubsub = db.redis.pubsub()
        await pubsub.subscribe(channel)

        try:
            while True:
                if await request.is_disconnected():
                    break

                message = await asyncio.wait_for(
                    pubsub.get_message(ignore_subscribe_messages=True, timeout=1.0),
                    timeout=HEARTBEAT_INTERVAL,
                )

                if message and message["type"] == "message":
                    try:
                        event = PipelineEvent.model_validate_json(message["data"])
                        yield {
                            "id": str(event.seq),
                            "event": event.event_type.value,
                            "data": event.model_dump_json(),
                        }
                    except Exception:
                        continue
                elif message is None:
                    # Timeout — send heartbeat
                    yield {"event": "heartbeat", "data": "{}"}
        finally:
            await pubsub.unsubscribe(channel)
            await pubsub.aclose()

    return EventSourceResponse(event_generator())


@router.post("/{case_id}/start", response_model=CaseResponse)
async def start_pipeline(
    case_id: str,
    request: Request,
    db=Depends(get_db),
    user: UserInDB = Depends(get_current_user),
):
    cases = db.mongo_db["cases"]
    case_doc = await cases.find_one({"_id": case_id})
    if not case_doc:
        raise HTTPException(status_code=404, detail="Case not found")

    if case_doc.get("status") != CaseStatus.created.value:
        raise HTTPException(
            status_code=409,
            detail=f"Case status is '{case_doc.get('status')}', expected 'created'",
        )

    thread_id = str(uuid.uuid4())
    now = datetime.utcnow()
    await cases.update_one(
        {"_id": case_id},
        {"$set": {"status": CaseStatus.exploring.value, "thread_id": thread_id, "updated_at": now}},
    )

    if db.redis:
        publisher = EventPublisher(db.redis)
        await publisher.publish_stage_change(case_id, "explore", "started")

    async def run_pipeline():
        try:
            async with await create_compiled_graph() as compiled:
                initial_state = {
                    "case_id": case_id,
                    "input_context": case_doc.get("input_context", ""),
                    "target_repo": case_doc.get("target_repo", ""),
                    "contribution_type": case_doc.get("contribution_type", ""),
                    "current_stage": "explore",
                    "status": CaseStatus.exploring.value,
                    "exploration_result": None,
                    "execution_plan": None,
                    "development_result": None,
                    "review_verdict": None,
                    "test_result": None,
                    "review_iterations": 0,
                    "human_decision": None,
                    "human_comment": None,
                    "cost": {
                        "total_input_tokens": 0,
                        "total_output_tokens": 0,
                        "estimated_cost_usd": 0.0,
                    },
                    "error": None,
                    "events": [],
                }
                config = {"configurable": {"thread_id": thread_id}}
                try:
                    await compiled.ainvoke(initial_state, config=config)
                except GraphInterrupt:
                    pass

                # Read full state from checkpoint
                state = await compiled.aget_state(config)
                values = state.values if state else {}

                update_fields: dict = {"updated_at": datetime.utcnow()}
                if values.get("status"):
                    update_fields["status"] = values["status"]
                for field in ["exploration_result", "execution_plan", "development_result", "review_verdict", "test_result"]:
                    if values.get(field):
                        update_fields[field] = values[field]
                if values.get("review_iterations"):
                    update_fields["review_iterations"] = values["review_iterations"]
                if values.get("cost"):
                    update_fields["cost"] = values["cost"]
                await cases.update_one({"_id": case_id}, {"$set": update_fields})

        except Exception as e:
            logger.error("pipeline_execution_failed", case_id=case_id, error=str(e))
            if db.redis:
                pub = EventPublisher(db.redis)
                await pub.publish_error(case_id, str(e), recoverable=False)
            await cases.update_one(
                {"_id": case_id},
                {"$set": {"status": CaseStatus.abandon.value, "updated_at": datetime.utcnow()}},
            )

    asyncio.create_task(run_pipeline())

    updated = await cases.find_one({"_id": case_id})
    return _doc_to_response(updated)


@router.post("/{case_id}/review", response_model=CaseResponse)
async def submit_review(
    case_id: str,
    decision: ReviewDecision,
    request: Request,
    db=Depends(get_db),
    user: UserInDB = Depends(get_current_user),
):
    cases = db.mongo_db["cases"]
    case_doc = await cases.find_one({"_id": case_id})
    if not case_doc:
        raise HTTPException(status_code=404, detail="Case not found")

    current_status = case_doc.get("status", "")
    if not current_status.startswith("pending_"):
        raise HTTPException(status_code=409, detail=f"Case is not awaiting review (status: '{current_status}')")

    thread_id = case_doc.get("thread_id")
    if not thread_id:
        raise HTTPException(status_code=409, detail="Case has no pipeline thread")

    async def resume_pipeline():
        try:
            async with await create_compiled_graph() as compiled:
                config = {"configurable": {"thread_id": thread_id}}

                from langgraph.types import Command
                try:
                    await compiled.ainvoke(
                        Command(resume={"action": decision.action.value, "comment": decision.comment or ""}),
                        config=config,
                    )
                except GraphInterrupt:
                    pass

                # Read full state from checkpoint (ainvoke return may be partial)
                state = await compiled.aget_state(config)
                values = state.values if state else {}

                update_fields: dict = {"updated_at": datetime.utcnow()}
                if values.get("status"):
                    update_fields["status"] = values["status"]
                if values.get("current_stage"):
                    update_fields["current_stage"] = values["current_stage"]
                for field in ["exploration_result", "execution_plan", "development_result", "review_verdict", "test_result"]:
                    if values.get(field):
                        update_fields[field] = values[field]
                if values.get("review_iterations"):
                    update_fields["review_iterations"] = values["review_iterations"]
                if values.get("cost"):
                    update_fields["cost"] = values["cost"]

                # If graph reached END, mark as completed
                if state and not state.next:
                    update_fields["status"] = CaseStatus.completed.value

                await cases.update_one({"_id": case_id}, {"$set": update_fields})

                if db.redis:
                    pub = EventPublisher(db.redis)
                    stage = values.get("current_stage", "")
                    await pub.publish_stage_change(case_id, stage, "resumed")

        except Exception as e:
            logger.error("pipeline_resume_failed", case_id=case_id, error=str(e))
            if db.redis:
                pub = EventPublisher(db.redis)
                await pub.publish_error(case_id, str(e), recoverable=False)

    asyncio.create_task(resume_pipeline())

    return _doc_to_response(case_doc)

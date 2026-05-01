from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Dict

from fastapi import APIRouter, Depends, Query

from app.api.deps import get_current_user, get_db
from app.database import DatabaseManager
from app.models.user import UserInDB
from app.utils.response import ok

router = APIRouter()


def _time_range(days: int) -> datetime:
    return datetime.now(timezone.utc) - timedelta(days=days)


# Approximate pricing per 1K tokens (Claude-class models)
_INPUT_COST_PER_1K = 0.003   # USD per 1K input tokens
_OUTPUT_COST_PER_1K = 0.015  # USD per 1K output tokens
_USD_TO_CNY = 7.25


def _calc_cost(input_tokens: int, output_tokens: int) -> Dict[str, float]:
    cost_usd = (
        (input_tokens / 1000) * _INPUT_COST_PER_1K
        + (output_tokens / 1000) * _OUTPUT_COST_PER_1K
    )
    return {
        "cost_usd": round(cost_usd, 4),
        "cost_cny": round(cost_usd * _USD_TO_CNY, 4),
    }


@router.get("/summary")
async def get_summary(
    days: int = Query(30, ge=1, le=365),
    db: DatabaseManager = Depends(get_db),
    user: UserInDB = Depends(get_current_user),
):
    col = db.mongo_db["chat_sessions"]
    since = _time_range(days)

    pipeline = [
        {"$match": {"user_id": user.email, "created_at": {"$gte": since}}},
        {"$unwind": "$events"},
        {"$match": {"events.type": "done"}},
        {
            "$group": {
                "_id": None,
                "total_sessions": {"$addToSet": "$session_id"},
                "total_input_tokens": {
                    "$sum": "$events.data.statistics.input_tokens"
                },
                "total_output_tokens": {
                    "$sum": "$events.data.statistics.output_tokens"
                },
                "total_duration_ms": {
                    "$sum": "$events.data.statistics.total_duration_ms"
                },
                "total_tool_calls": {
                    "$sum": "$events.data.statistics.tool_call_count"
                },
            }
        },
    ]
    results = await col.aggregate(pipeline).to_list(length=1)

    if not results:
        return ok({
            "total_sessions": 0,
            "total_messages": 0,
            "total_input_tokens": 0,
            "total_output_tokens": 0,
            "total_tokens": 0,
            "total_duration_ms": 0,
            "total_tool_calls": 0,
            "cost_usd": 0,
            "cost_cny": 0,
        })

    r = results[0]
    input_t = r.get("total_input_tokens", 0)
    output_t = r.get("total_output_tokens", 0)
    return ok({
        "total_sessions": len(r.get("total_sessions", [])),
        "total_messages": 0,
        "total_input_tokens": input_t,
        "total_output_tokens": output_t,
        "total_tokens": input_t + output_t,
        "total_duration_ms": r.get("total_duration_ms", 0),
        "total_tool_calls": r.get("total_tool_calls", 0),
        **_calc_cost(input_t, output_t),
    })


@router.get("/models")
async def get_model_stats(
    days: int = Query(30, ge=1, le=365),
    db: DatabaseManager = Depends(get_db),
    user: UserInDB = Depends(get_current_user),
):
    col = db.mongo_db["chat_sessions"]
    since = _time_range(days)

    pipeline = [
        {"$match": {"user_id": user.email, "created_at": {"$gte": since}}},
        {"$unwind": "$events"},
        {"$match": {"events.type": "done"}},
        {
            "$group": {
                "_id": "$model_config_id",
                "session_count": {"$addToSet": "$session_id"},
                "total_input_tokens": {
                    "$sum": "$events.data.statistics.input_tokens"
                },
                "total_output_tokens": {
                    "$sum": "$events.data.statistics.output_tokens"
                },
                "total_duration_ms": {
                    "$sum": "$events.data.statistics.total_duration_ms"
                },
            }
        },
    ]
    results = await col.aggregate(pipeline).to_list(length=None)

    models = []
    for r in results:
        input_t = r.get("total_input_tokens", 0)
        output_t = r.get("total_output_tokens", 0)
        models.append({
            "model_config_id": r["_id"],
            "session_count": len(r.get("session_count", [])),
            "total_input_tokens": input_t,
            "total_output_tokens": output_t,
            "total_tokens": input_t + output_t,
            "total_duration_ms": r.get("total_duration_ms", 0),
            **_calc_cost(input_t, output_t),
        })
    return ok({"models": models})


@router.get("/trends")
async def get_trends(
    days: int = Query(30, ge=1, le=365),
    db: DatabaseManager = Depends(get_db),
    user: UserInDB = Depends(get_current_user),
):
    col = db.mongo_db["chat_sessions"]
    since = _time_range(days)

    pipeline = [
        {"$match": {"user_id": user.email, "created_at": {"$gte": since}}},
        {"$unwind": "$events"},
        {"$match": {"events.type": "done"}},
        {
            "$group": {
                "_id": {
                    "$dateToString": {
                        "format": "%Y-%m-%d",
                        "date": "$created_at",
                    }
                },
                "sessions": {"$addToSet": "$session_id"},
                "total_tokens": {
                    "$sum": {
                        "$add": [
                            "$events.data.statistics.input_tokens",
                            "$events.data.statistics.output_tokens",
                        ]
                    }
                },
            }
        },
        {"$sort": {"_id": 1}},
    ]
    results = await col.aggregate(pipeline).to_list(length=None)

    trends = [
        {
            "date": r["_id"],
            "session_count": len(r.get("sessions", [])),
            "total_tokens": r.get("total_tokens", 0),
        }
        for r in results
    ]
    return ok({"trends": trends})


@router.get("/sessions")
async def get_session_stats(
    days: int = Query(30, ge=1, le=365),
    limit: int = Query(20, ge=1, le=100),
    db: DatabaseManager = Depends(get_db),
    user: UserInDB = Depends(get_current_user),
):
    col = db.mongo_db["chat_sessions"]
    since = _time_range(days)

    pipeline = [
        {"$match": {"user_id": user.email, "created_at": {"$gte": since}}},
        {"$unwind": "$events"},
        {"$match": {"events.type": "done"}},
        {
            "$group": {
                "_id": "$session_id",
                "title": {"$first": "$title"},
                "created_at": {"$first": "$created_at"},
                "total_input_tokens": {
                    "$sum": "$events.data.statistics.input_tokens"
                },
                "total_output_tokens": {
                    "$sum": "$events.data.statistics.output_tokens"
                },
                "total_duration_ms": {
                    "$sum": "$events.data.statistics.total_duration_ms"
                },
            }
        },
        {"$sort": {"created_at": -1}},
        {"$limit": limit},
    ]
    results = await col.aggregate(pipeline).to_list(length=None)

    sessions = []
    for r in results:
        input_t = r.get("total_input_tokens", 0)
        output_t = r.get("total_output_tokens", 0)
        sessions.append({
            "session_id": r["_id"],
            "title": r.get("title"),
            "total_input_tokens": input_t,
            "total_output_tokens": output_t,
            "total_tokens": input_t + output_t,
            "total_duration_ms": r.get("total_duration_ms", 0),
            "created_at": r["created_at"].isoformat() if r.get("created_at") else None,
            **_calc_cost(input_t, output_t),
        })
    return ok({"sessions": sessions})

from __future__ import annotations

from typing import Any


def ok(data: Any = None, msg: str = "ok") -> dict:
    return {"code": 0, "msg": msg, "data": data}


def err(code: int, msg: str) -> dict:
    return {"code": code, "msg": msg, "data": None}

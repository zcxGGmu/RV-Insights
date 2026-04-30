"""Post-exploration verification for Explorer agent output."""

from __future__ import annotations

import asyncio
from typing import Any

import httpx
import structlog

logger = structlog.get_logger()

_URL_TIMEOUT = httpx.Timeout(10.0)
_MIN_EVIDENCE_COUNT = 2


async def _check_url(client: httpx.AsyncClient, url: str) -> bool:
    """Return True if a HEAD request to *url* succeeds (2xx/3xx)."""
    try:
        resp = await client.head(url, follow_redirects=True)
        return resp.status_code < 400
    except Exception:
        return False


def _is_safe_path(path: str) -> bool:
    """Reject paths that try directory traversal or are absolute."""
    return ".." not in path and not path.startswith("/")


async def verify_exploration_claims(result: dict[str, Any]) -> dict[str, Any]:
    """Verify URLs, sanitize paths, and enforce minimum evidence thresholds.

    Modifies and returns *result* (immutable-style: returns a new dict).
    """
    result = {**result}

    # --- 1. URL reachability check ---
    evidence: list[dict[str, Any]] = list(result.get("evidence") or [])
    if evidence:
        async with httpx.AsyncClient(timeout=_URL_TIMEOUT) as client:
            checks = [
                _check_url(client, item["url"])
                if item.get("url")
                else asyncio.coroutine(lambda: True)()
                for item in evidence
            ]
            reachable = await asyncio.gather(*checks, return_exceptions=True)

        verified: list[dict[str, Any]] = []
        for item, ok in zip(evidence, reachable, strict=False):
            if isinstance(ok, Exception):
                ok = False
            if not item.get("url"):
                verified.append(item)
            elif ok:
                verified.append(item)
            else:
                logger.info(
                    "evidence_url_unreachable",
                    url=item.get("url"),
                )
        result["evidence"] = verified

    # --- 2. Path safety ---
    target_files: list[str] = list(result.get("target_files") or [])
    safe_files = [f for f in target_files if _is_safe_path(f)]
    if len(safe_files) != len(target_files):
        logger.warning(
            "unsafe_paths_removed",
            removed=len(target_files) - len(safe_files),
        )
    result["target_files"] = safe_files

    # --- 3. Minimum evidence threshold ---
    verified_count = len(result.get("evidence") or [])
    if verified_count < _MIN_EVIDENCE_COUNT:
        current_score = float(result.get("feasibility_score", 0.0))
        capped = min(current_score, 0.3)
        if capped != current_score:
            logger.info(
                "feasibility_score_capped",
                original=current_score,
                capped=capped,
                evidence_count=verified_count,
            )
        result["feasibility_score"] = capped

    return result

"""Patchwork REST API client for Linux kernel patch tracking."""

from __future__ import annotations

from typing import Any

import httpx
import structlog
from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

logger = structlog.get_logger()

PATCHWORK_BASE_URL = "https://patchwork.kernel.org/api/1.3"


class PatchworkClient:
    """Async client for the Patchwork REST API."""

    def __init__(self, base_url: str = PATCHWORK_BASE_URL) -> None:
        self._base_url = base_url.rstrip("/")
        self._timeout = httpx.Timeout(15.0)

    @retry(
        retry=retry_if_exception_type((httpx.TransportError, httpx.TimeoutException)),
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=1, max=8),
        reraise=True,
    )
    async def _get(self, path: str, params: dict[str, Any] | None = None) -> Any:
        async with httpx.AsyncClient(timeout=self._timeout) as client:
            resp = await client.get(f"{self._base_url}{path}", params=params)
            resp.raise_for_status()
            return resp.json()

    async def search_patches(
        self,
        project: str = "linux-riscv",
        q: str = "",
        state: str | None = None,
        limit: int = 10,
    ) -> list[dict[str, Any]]:
        """Search patches with optional query, state filter, and limit."""
        params: dict[str, Any] = {
            "project": project,
            "per_page": min(limit, 50),
            "order": "-date",
        }
        if q:
            params["q"] = q
        if state:
            params["state"] = state

        try:
            data = await self._get("/patches/", params=params)
        except Exception as exc:
            logger.warning("patchwork_search_failed", error=str(exc), project=project)
            return []

        return [self._simplify(patch) for patch in data[:limit]]

    async def get_recent_patches(
        self,
        project: str = "linux-riscv",
        limit: int = 10,
    ) -> list[dict[str, Any]]:
        """Get the most recent patches for a project."""
        return await self.search_patches(project=project, limit=limit)

    @staticmethod
    def _simplify(patch: dict[str, Any]) -> dict[str, Any]:
        submitter = patch.get("submitter", {})
        return {
            "title": patch.get("name", ""),
            "url": patch.get("web_url", ""),
            "state": patch.get("state", ""),
            "date": patch.get("date", ""),
            "submitter": submitter.get("name", "") if isinstance(submitter, dict) else "",
        }

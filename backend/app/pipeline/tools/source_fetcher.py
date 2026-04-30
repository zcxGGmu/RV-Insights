"""Fetch source file contents from GitHub for prompt context."""

from __future__ import annotations

import structlog

logger = structlog.get_logger()

_GITHUB_RAW_URL = "https://raw.githubusercontent.com/{repo}/{branch}/{path}"


async def fetch_source_files(
    target_repo: str,
    file_paths: list[str],
    branch: str = "master",
) -> dict[str, str]:
    """Fetch file contents from GitHub raw content API.

    Returns {filepath: content} dict. Missing files get empty string.
    """
    import httpx

    results: dict[str, str] = {}

    async with httpx.AsyncClient(timeout=15.0) as client:
        for path in file_paths:
            url = _GITHUB_RAW_URL.format(
                repo=target_repo, branch=branch, path=path,
            )
            try:
                resp = await client.get(url)
                if resp.status_code == 200:
                    results[path] = resp.text
                else:
                    logger.debug(
                        "source_file_not_found",
                        path=path, status=resp.status_code,
                    )
                    results[path] = ""
            except Exception as exc:
                logger.warning(
                    "source_file_fetch_failed",
                    path=path, error=str(exc),
                )
                results[path] = ""

    return results

"""Explorer agent tool set for RISC-V contribution discovery."""

from __future__ import annotations

from typing import Any

import httpx
import structlog
from langchain_core.tools import tool

logger = structlog.get_logger()


@tool
async def patchwork_search(query: str, project: str = "linux-riscv") -> str:
    """Search the Linux kernel Patchwork for patches related to a query.

    Args:
        query: Search terms for finding relevant patches.
        project: Patchwork project slug (default: linux-riscv).

    Returns:
        Formatted text listing matching patches with title, state, date, and URL.
    """
    from app.datasources.patchwork import PatchworkClient

    client = PatchworkClient()
    try:
        patches = await client.search_patches(project=project, q=query, limit=10)
    except Exception as exc:
        return f"Patchwork search failed: {exc}"

    if not patches:
        return f"No patches found for query: {query} (project={project})"

    lines: list[str] = []
    for p in patches:
        lines.append(
            f"- **{p['title']}** [{p['state']}]\n"
            f"  Submitter: {p['submitter']} | Date: {p['date']}\n"
            f"  URL: {p['url']}"
        )
    return f"Found {len(patches)} patches:\n\n" + "\n\n".join(lines)


@tool
async def mailing_list_search(query: str) -> str:
    """Search the Linux kernel mailing list archives on lore.kernel.org.

    Args:
        query: Search terms for finding relevant mailing list discussions.

    Returns:
        Search results from lore.kernel.org as formatted text.
    """
    from app.tools.web_search import web_search

    prefixed_query = f"site:lore.kernel.org {query}"
    return await web_search.ainvoke({"query": prefixed_query})


@tool
async def code_grep(pattern: str, repo_url: str = "riscv/linux") -> str:
    """Search GitHub code for a pattern in a repository.

    Args:
        pattern: Code pattern or keyword to search for.
        repo_url: GitHub repository in 'owner/repo' format (default: riscv/linux).

    Returns:
        Matching files and code snippets as formatted text.
    """
    repo = repo_url.strip().removeprefix("https://github.com/").rstrip("/")
    search_query = f"{pattern} repo:{repo}"

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(
                "https://api.github.com/search/code",
                params={"q": search_query, "per_page": 10},
                headers={
                    "Accept": "application/vnd.github.v3+json",
                    "User-Agent": "RV-Insights-Explorer/0.1",
                },
            )
            resp.raise_for_status()
            data = resp.json()
    except Exception as exc:
        return f"GitHub code search failed: {exc}"

    items = data.get("items", [])
    if not items:
        return f"No code matches for '{pattern}' in {repo}"

    lines: list[str] = []
    for item in items[:10]:
        name = item.get("name", "")
        path = item.get("path", "")
        html_url = item.get("html_url", "")
        lines.append(f"- **{name}** ({path})\n  {html_url}")

    return f"Found {data.get('total_count', len(items))} matches:\n\n" + "\n\n".join(lines)


def get_explorer_tools() -> list[Any]:
    """Return the full tool set for the Explorer agent."""
    from app.tools.web_search import web_search

    return [patchwork_search, mailing_list_search, code_grep, web_search]

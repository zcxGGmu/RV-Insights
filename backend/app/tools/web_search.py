from __future__ import annotations

import httpx
from langchain_core.tools import tool

from app.config import settings


@tool
async def web_search(query: str) -> str:
    """Search the web for RISC-V, Linux kernel, and open source topics.

    Args:
        query: The search query string.

    Returns:
        Search results as formatted text.
    """
    if not settings.SEARCH_API_KEY:
        return "Web search is not configured. Please set SEARCH_API_KEY."

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            url = settings.SEARCH_API_URL or "https://api.tavily.com/search"
            resp = await client.post(
                url,
                json={
                    "query": query,
                    "max_results": 5,
                    "api_key": settings.SEARCH_API_KEY,
                },
            )
            resp.raise_for_status()
            data = resp.json()

        results = data.get("results", [])
        if not results:
            return f"No results found for: {query}"

        lines = []
        for r in results[:5]:
            title = r.get("title", "")
            content = r.get("content", "")[:500]
            url_str = r.get("url", "")
            lines.append(f"**{title}**\n{content}\nSource: {url_str}\n")
        return "\n---\n".join(lines)

    except Exception as exc:
        return f"Search failed: {exc}"

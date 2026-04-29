from __future__ import annotations

from app.tools.code_analysis import code_analysis
from app.tools.web_search import web_search

CHAT_TOOLS = [web_search, code_analysis]

__all__ = ["CHAT_TOOLS", "web_search", "code_analysis"]

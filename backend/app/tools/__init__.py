from __future__ import annotations

from app.tools.web_search import web_search
from app.tools.code_analysis import code_analysis

CHAT_TOOLS = [web_search, code_analysis]

__all__ = ["CHAT_TOOLS", "web_search", "code_analysis"]

from __future__ import annotations

from typing import Optional

import structlog
from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.api.deps import get_current_user
from app.models.user import UserInDB
from app.services.model_factory import create_chat_model, get_default_model_config
from app.utils.response import err, ok

logger = structlog.get_logger()

router = APIRouter()


class OptimizePromptRequest(BaseModel):
    prompt: str
    language: Optional[str] = "en"


@router.post("/optimize-prompt")
async def optimize_prompt(
    body: OptimizePromptRequest,
    user: UserInDB = Depends(get_current_user),
):
    try:
        config = get_default_model_config()
        if not config.api_key:
            return ok({"optimized_prompt": _heuristic_optimize(body.prompt, body.language)})
        llm = create_chat_model(config)
        from langchain_core.messages import HumanMessage, SystemMessage
        lang_hint = "Chinese" if body.language == "zh" else "English"
        messages = [
            SystemMessage(content=(
                "You are a prompt optimization expert. Rewrite the user's prompt to be "
                f"clearer, more specific, and more effective. Output only the optimized "
                f"prompt in {lang_hint}. Do not add explanations."
            )),
            HumanMessage(content=body.prompt),
        ]
        response = await llm.ainvoke(messages)
        return ok({"optimized_prompt": response.content.strip()})
    except Exception as exc:
        logger.error("optimize_prompt_failed", error=str(exc))
        return err(9006, "Prompt optimization failed")


def _heuristic_optimize(prompt: str, language: Optional[str] = "en") -> str:
    optimized = prompt.strip()
    if not optimized.endswith((".", "?", "!", "。", "？", "！")):
        optimized += "."
    if len(optimized) < 20:
        if language == "zh":
            optimized = f"请详细说明：{optimized}"
        else:
            optimized = f"Please elaborate on: {optimized}"
    return optimized

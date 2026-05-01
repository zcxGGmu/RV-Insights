from fastapi import APIRouter

from .auth import router as auth_router
from .cases import router as cases_router
from .chat import router as chat_router
from .file_download import router as file_download_router
from .files import router as files_router
from .memory import router as memory_router
from .models import router as models_router
from .pipeline import router as pipeline_router
from .science import router as science_router
from .skills import router as skills_router, session_router as skills_session_router
from .statistics import router as statistics_router
from .tools import router as tools_router, session_router as tools_session_router
from .tooluniverse import router as tooluniverse_router


api_router = APIRouter()


@api_router.get("/")
async def root():
    return {"message": "RV-Insights API v1"}

api_router.include_router(auth_router, prefix="/auth", tags=["auth"])
api_router.include_router(skills_router, prefix="/sessions/skills", tags=["skills"])
api_router.include_router(skills_session_router, prefix="/sessions", tags=["skills"])
api_router.include_router(tools_router, prefix="/sessions/tools", tags=["tools"])
api_router.include_router(tools_session_router, prefix="/sessions", tags=["tools"])
api_router.include_router(chat_router, prefix="/sessions", tags=["sessions"])
api_router.include_router(files_router, prefix="/sessions", tags=["files"])
api_router.include_router(cases_router, prefix="/cases", tags=["cases"])
api_router.include_router(pipeline_router, prefix="/cases", tags=["pipeline"])
api_router.include_router(models_router, prefix="/models", tags=["models"])
api_router.include_router(memory_router, prefix="/memory", tags=["memory"])
api_router.include_router(statistics_router, prefix="/statistics", tags=["statistics"])
api_router.include_router(tooluniverse_router, prefix="/tooluniverse", tags=["tooluniverse"])
api_router.include_router(science_router, prefix="/science", tags=["science"])
api_router.include_router(file_download_router, prefix="/file", tags=["file"])

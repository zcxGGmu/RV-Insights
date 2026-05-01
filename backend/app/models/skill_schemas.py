from __future__ import annotations

from typing import List, Optional

from pydantic import BaseModel


class ExternalSkillItem(BaseModel):
    name: str
    description: str
    files: List[str]
    blocked: bool = False
    builtin: bool = False


class SkillBlockRequest(BaseModel):
    blocked: bool


class SkillSaveRequest(BaseModel):
    skill_name: str


class SkillReadRequest(BaseModel):
    file: str


class FileEntry(BaseModel):
    name: str
    path: str
    type: str


class ExternalToolItem(BaseModel):
    name: str
    description: str
    file: str
    blocked: bool = False


class ToolBlockRequest(BaseModel):
    blocked: bool


class ToolSaveRequest(BaseModel):
    tool_name: str
    replaces: Optional[str] = None

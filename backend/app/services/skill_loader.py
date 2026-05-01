from __future__ import annotations

import shutil
from pathlib import Path
from typing import Any, Dict, List, Optional

import structlog
import yaml

from app.models.skill_schemas import FileEntry

logger = structlog.get_logger()


class SkillLoader:
    def __init__(self, skills_dir: str) -> None:
        self._skills_dir = Path(skills_dir)
        self._cache: Dict[str, Dict[str, Any]] = {}

    def scan(self) -> None:
        self._cache.clear()
        if not self._skills_dir.exists():
            logger.warning("skills_dir_not_found", path=str(self._skills_dir))
            return
        for child in sorted(self._skills_dir.iterdir()):
            if not child.is_dir():
                continue
            meta_file = child / "SKILL.md"
            if not meta_file.exists():
                continue
            meta = self._parse_skill_md(meta_file)
            if meta is None:
                continue
            files = [
                str(f.relative_to(child))
                for f in sorted(child.rglob("*"))
                if f.is_file()
            ]
            self._cache[meta["name"]] = {
                "name": meta["name"],
                "description": meta.get("description", ""),
                "builtin": meta.get("builtin", False),
                "files": files,
                "dir": child,
            }
        logger.info("skills_scanned", count=len(self._cache))

    def list_all(self) -> List[Dict[str, Any]]:
        return list(self._cache.values())

    def get(self, name: str) -> Optional[Dict[str, Any]]:
        return self._cache.get(name)

    def delete(self, name: str) -> bool:
        item = self._cache.get(name)
        if item is None:
            return False
        skill_dir: Path = item["dir"]
        if skill_dir.exists():
            shutil.rmtree(skill_dir)
        del self._cache[name]
        return True

    def browse_files(self, name: str, sub_path: str = "") -> Optional[List[FileEntry]]:
        item = self._cache.get(name)
        if item is None:
            return None
        skill_dir: Path = item["dir"]
        target = (skill_dir / sub_path).resolve()
        if not target.is_relative_to(skill_dir.resolve()):
            return None
        if not target.exists() or not target.is_dir():
            return None
        entries: List[FileEntry] = []
        for child in sorted(target.iterdir()):
            rel = str(child.relative_to(skill_dir))
            entry_type = "directory" if child.is_dir() else "file"
            entries.append(FileEntry(name=child.name, path=rel, type=entry_type))
        return entries

    def read_file(self, name: str, file_path: str) -> Optional[str]:
        item = self._cache.get(name)
        if item is None:
            return None
        skill_dir: Path = item["dir"]
        target = (skill_dir / file_path).resolve()
        if not target.is_relative_to(skill_dir.resolve()):
            return None
        if not target.exists() or not target.is_file():
            return None
        return target.read_text(encoding="utf-8")

    def save_skill(self, name: str, description: str, content: str) -> bool:
        skill_dir = self._skills_dir / name
        if skill_dir.exists():
            return False
        skill_dir.mkdir(parents=True)
        meta = f"---\nname: {name}\ndescription: \"{description}\"\nbuiltin: false\n---\n"
        (skill_dir / "SKILL.md").write_text(meta, encoding="utf-8")
        (skill_dir / "prompt.txt").write_text(content, encoding="utf-8")
        self.scan()
        return True

    @staticmethod
    def _parse_skill_md(path: Path) -> Optional[Dict[str, Any]]:
        try:
            text = path.read_text(encoding="utf-8")
            if not text.startswith("---"):
                return None
            parts = text.split("---", 2)
            if len(parts) < 3:
                return None
            meta = yaml.safe_load(parts[1])
            if not isinstance(meta, dict) or "name" not in meta:
                return None
            return meta
        except Exception as exc:
            logger.warning("skill_parse_failed", path=str(path), error=str(exc))
            return None

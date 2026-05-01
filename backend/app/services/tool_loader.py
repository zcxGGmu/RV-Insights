from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, List, Optional

import structlog

logger = structlog.get_logger()


class ToolLoader:
    def __init__(self, tools_dir: str) -> None:
        self._tools_dir = Path(tools_dir)
        self._cache: Dict[str, Dict[str, Any]] = {}

    def scan(self) -> None:
        self._cache.clear()
        if not self._tools_dir.exists():
            logger.warning("tools_dir_not_found", path=str(self._tools_dir))
            return
        for child in sorted(self._tools_dir.iterdir()):
            if not child.is_file() or child.name.startswith("."):
                continue
            if child.suffix not in (".py", ".yaml", ".yml", ".json"):
                continue
            meta = self._parse_tool_file(child)
            if meta is None:
                continue
            self._cache[meta["name"]] = {
                "name": meta["name"],
                "description": meta.get("description", ""),
                "file": str(child.relative_to(self._tools_dir)),
                "dir": self._tools_dir,
            }
        logger.info("tools_scanned", count=len(self._cache))

    def list_all(self) -> List[Dict[str, Any]]:
        return list(self._cache.values())

    def get(self, name: str) -> Optional[Dict[str, Any]]:
        return self._cache.get(name)

    def delete(self, name: str) -> bool:
        item = self._cache.get(name)
        if item is None:
            return False
        file_path = self._tools_dir / item["file"]
        if file_path.exists():
            file_path.unlink()
        del self._cache[name]
        return True

    def read_file(self, name: str) -> Optional[str]:
        item = self._cache.get(name)
        if item is None:
            return None
        file_path = self._tools_dir / item["file"]
        if not file_path.exists():
            return None
        return file_path.read_text(encoding="utf-8")

    def save_tool(self, name: str, content: str, replaces: Optional[str] = None) -> bool:
        if replaces and replaces in self._cache:
            self.delete(replaces)
        elif name in self._cache:
            return False
        file_path = self._tools_dir / f"{name}.py"
        file_path.write_text(content, encoding="utf-8")
        self.scan()
        return True

    @staticmethod
    def _parse_tool_file(path: Path) -> Optional[Dict[str, Any]]:
        try:
            text = path.read_text(encoding="utf-8")
            name = path.stem
            description = ""
            for line in text.split("\n"):
                stripped = line.strip()
                if stripped.startswith("#") and not stripped.startswith("#!"):
                    description = stripped.lstrip("# ").strip()
                    break
                if stripped.startswith('"""') or stripped.startswith("'''"):
                    description = stripped.strip("\"'").strip()
                    break
            return {"name": name, "description": description}
        except Exception as exc:
            logger.warning("tool_parse_failed", path=str(path), error=str(exc))
            return None

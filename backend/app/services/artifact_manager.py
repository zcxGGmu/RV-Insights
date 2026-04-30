"""MVP artifact manager — patches stored inline in MongoDB case documents.

This establishes the interface for Sprint 7+ when larger artifacts
(test logs, build outputs) need dedicated file storage.
"""

from __future__ import annotations

import structlog

logger = structlog.get_logger()


class ArtifactManager:
    """Artifact storage for pipeline outputs.

    MVP: no-op pass-through. Patches are already embedded in the
    DevelopmentResult field of the case document.
    """

    async def save_patches(
        self,
        case_id: str,
        patches: dict,
        iteration: int,
    ) -> str:
        """Store patch artifacts. Returns a reference ID."""
        ref_id = f"{case_id}/patches/iter-{iteration}"
        logger.debug(
            "artifact_save_noop",
            case_id=case_id,
            ref_id=ref_id,
            file_count=len(patches),
        )
        return ref_id

    async def load_patches(
        self,
        case_id: str,
        iteration: int,
    ) -> dict:
        """Load patch artifacts from case document."""
        from app.database import DatabaseManager

        db = DatabaseManager.get_db()
        case_doc = await db.contribution_cases.find_one(
            {"case_id": case_id},
            {"development_result.patches": 1},
        )
        if not case_doc:
            return {}
        dev_result = case_doc.get("development_result", {}) or {}
        return dev_result.get("patches", {})

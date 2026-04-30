"""Source fetcher tests — input validation, path traversal, file cap."""

from __future__ import annotations

import os
from unittest.mock import AsyncMock, MagicMock, patch

import pytest


@pytest.fixture(autouse=True)
def _setup_env():
    os.environ.setdefault("RV_INSIGHTS_TESTING", "1")


class TestRepoValidation:
    @pytest.mark.asyncio
    async def test_valid_repo_format_accepted(self):
        from app.pipeline.tools.source_fetcher import _REPO_PATTERN

        assert _REPO_PATTERN.match("torvalds/linux")
        assert _REPO_PATTERN.match("riscv-collab/riscv-gnu-toolchain")
        assert _REPO_PATTERN.match("org.name/repo-v2")

    @pytest.mark.asyncio
    async def test_invalid_repo_format_rejected(self):
        from app.pipeline.tools.source_fetcher import fetch_source_files

        result = await fetch_source_files(
            "../etc/passwd", ["file.c"],
        )
        assert result == {"file.c": ""}

    @pytest.mark.asyncio
    async def test_repo_with_slashes_rejected(self):
        from app.pipeline.tools.source_fetcher import fetch_source_files

        result = await fetch_source_files(
            "owner/repo/extra", ["file.c"],
        )
        assert result == {"file.c": ""}


class TestPathSanitization:
    @pytest.mark.asyncio
    async def test_path_traversal_stripped(self):
        from app.pipeline.tools.source_fetcher import fetch_source_files

        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.text = "file content"

        mock_client = AsyncMock()
        mock_client.get = AsyncMock(return_value=mock_resp)
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)

        with patch("httpx.AsyncClient", return_value=mock_client):
            result = await fetch_source_files(
                "torvalds/linux",
                ["safe/path.c", "../../etc/passwd", "/absolute/path.c"],
            )

        assert result.get("safe/path.c") == "file content"
        assert result.get("../../etc/passwd") == ""
        assert result.get("/absolute/path.c") == ""

    @pytest.mark.asyncio
    async def test_max_files_capped_at_20(self):
        from app.pipeline.tools.source_fetcher import fetch_source_files

        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.text = "content"

        mock_client = AsyncMock()
        mock_client.get = AsyncMock(return_value=mock_resp)
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)

        files = [f"file{i}.c" for i in range(30)]

        with patch("httpx.AsyncClient", return_value=mock_client):
            result = await fetch_source_files("torvalds/linux", files)

        fetched_count = sum(1 for v in result.values() if v == "content")
        assert fetched_count == 20
        assert len(result) == 30


class TestFetchConstruction:
    @pytest.mark.asyncio
    async def test_correct_url_constructed(self):
        from app.pipeline.tools.source_fetcher import fetch_source_files

        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.text = "int main() {}"

        mock_client = AsyncMock()
        mock_client.get = AsyncMock(return_value=mock_resp)
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)

        with patch("httpx.AsyncClient", return_value=mock_client):
            result = await fetch_source_files(
                "torvalds/linux", ["arch/riscv/boot/dts/test.dts"],
                branch="v6.8",
            )

        mock_client.get.assert_called_once_with(
            "https://raw.githubusercontent.com/torvalds/linux/v6.8/arch/riscv/boot/dts/test.dts",
        )
        assert result["arch/riscv/boot/dts/test.dts"] == "int main() {}"

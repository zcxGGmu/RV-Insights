from __future__ import annotations

from langchain_core.tools import tool


@tool
async def code_analysis(code: str, analysis_type: str = "explain") -> str:
    """Analyze a code snippet — explain, review for bugs, or suggest improvements.

    Args:
        code: The code snippet to analyze.
        analysis_type: One of 'explain', 'review', or 'improve'.

    Returns:
        Analysis result as text.
    """
    if not code.strip():
        return "No code provided for analysis."

    if analysis_type not in ("explain", "review", "improve"):
        analysis_type = "explain"

    lines = code.strip().splitlines()
    lang = _detect_language(code)

    if analysis_type == "explain":
        comment_count = sum(
            1 for line in lines
            if line.strip().startswith(("#", "//", "/*"))
        )
        return (
            f"Code analysis ({lang}, {len(lines)} lines):\n"
            f"This code appears to be written in {lang}. "
            f"It contains {len(lines)} lines with "
            f"{comment_count} comment lines."
        )

    if analysis_type == "review":
        issues = []
        for i, line in enumerate(lines, 1):
            if "TODO" in line or "FIXME" in line:
                issues.append(f"Line {i}: Contains TODO/FIXME marker")
            if len(line) > 120:
                issues.append(f"Line {i}: Line exceeds 120 characters")
        if not issues:
            return "No obvious issues found in the code."
        return "Potential issues:\n" + "\n".join(f"- {issue}" for issue in issues)

    return (
        f"Improvement suggestions for {lang} code ({len(lines)} lines):\n"
        "- Consider adding type annotations\n"
        "- Check for proper error handling\n"
        "- Ensure consistent naming conventions"
    )


def _detect_language(code: str) -> str:
    if "def " in code or "import " in code:
        return "Python"
    if "function " in code or "const " in code or "let " in code:
        return "JavaScript/TypeScript"
    if "#include" in code:
        return "C/C++"
    if "fn " in code and "let " in code:
        return "Rust"
    if "func " in code and "package " in code:
        return "Go"
    return "Unknown"

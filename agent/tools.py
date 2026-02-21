import os
from fnmatch import fnmatch
from pathlib import Path
from anthropic import beta_tool

from utils import sh

WORKDIR = Path("cloned_repo")
MAX_TOOL_CHARS = 12_000
MAX_TOOL_LINES = 300


def _truncate(text: str, max_chars: int = MAX_TOOL_CHARS, max_lines: int = MAX_TOOL_LINES) -> str:
    lines = text.splitlines()
    if len(lines) > max_lines:
        lines = lines[:max_lines]
        text = "\n".join(lines) + f"\n... [truncated {len(text.splitlines()) - max_lines} lines]"
    if len(text) > max_chars:
        cut = len(text) - max_chars
        text = text[:max_chars] + f"\n... [truncated {cut} chars]"
    return text

def set_workdir(path: str | Path) -> str:
    """Set repo working directory used by all tools."""
    global WORKDIR
    WORKDIR = Path(path)
    return f"WORKDIR set to {WORKDIR}"

@beta_tool
def repo_read_file(path: str, start_line: int | None = None, end_line: int | None = None) -> str:
    """Read a repo file. Optional 1-based line range can be provided."""
    
    toPrint = f"Read file: {path}"
    if start_line:
        toPrint += f" from {start_line}"
    if end_line:
        toPrint += f" to {end_line}"
    print(toPrint)

    p = WORKDIR / path
    text = p.read_text(encoding="utf-8")
    if start_line is not None or end_line is not None:
        lines = text.splitlines()
        start = 1 if start_line is None else max(1, start_line)
        end = len(lines) if end_line is None else min(len(lines), end_line)
        if start > end:
            return f"Invalid line range: start_line={start_line}, end_line={end_line}"
        text = "\n".join(lines[start - 1:end])
    return _truncate(text)

@beta_tool
def repo_write_file(path: str, content: str) -> str:
    print(f"Wrote to: {path}")
    """Overwrite a text file in the checked-out repo. path is repo-relative."""
    p = WORKDIR / path
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(content, encoding="utf-8")
    return f"Wrote {path} ({len(content)} chars)"

@beta_tool
def repo_search(query: str, glob: str = "*") -> str:
    print(f"Searched for: {query}. Glob: {glob}")
    """Search for text in repo. Uses rg if available, otherwise Python fallback."""
    rg_out = sh(WORKDIR, "rg", "--glob", glob, query, timeout=60)
    if "(exit 127)" not in rg_out:
        return _truncate(rg_out)

    # Fallback when rg is not installed.
    matches = []
    for p in WORKDIR.rglob("*"):
        if not p.is_file():
            continue
        rel = p.relative_to(WORKDIR).as_posix()
        if not fnmatch(rel, glob):
            continue
        try:
            text = p.read_text(encoding="utf-8")
        except Exception:
            continue
        for i, line in enumerate(text.splitlines(), start=1):
            if query in line:
                matches.append(f"{rel}:{i}:{line}")
                if len(matches) >= 200:
                    break
        if len(matches) >= 200:
            break
    header = f"$ repo_search_python_fallback query={query!r} glob={glob!r}"
    body = "\n".join(matches) if matches else "(no matches)"
    return _truncate(f"{header}\n(exit 0)\nSTDOUT:\n{body}\nSTDERR:\n")

@beta_tool
def run_command(command: str, timeout: int = 300) -> str:
    print(f"Ran command: {command}")
    """Run a shell command in the repo (e.g., pytest, ruff)."""
    # Keep this strict in production: allow-list commands, no network, etc.
    if os.name == "nt":
        return _truncate(sh(WORKDIR, "powershell", "-NoProfile", "-Command", command, timeout=timeout))
    return _truncate(sh(WORKDIR, "bash", "-lc", command, timeout=timeout))

@beta_tool
def git_diff() -> str:
    """Show git diff."""
    print(f"Got git diff.")
    return _truncate(sh(WORKDIR, "git", "diff", "--unified=1", timeout=30))

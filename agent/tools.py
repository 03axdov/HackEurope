import tempfile
from pathlib import Path
from anthropic import beta_tool

from utils import sh


WORKDIR = Path(tempfile.TemporaryDirectory())

@beta_tool
def repo_read_file(path: str) -> str:
    """Read a text file from the checked-out repo. path is repo-relative."""
    p = WORKDIR / path
    return p.read_text(encoding="utf-8")

@beta_tool
def repo_write_file(path: str, content: str) -> str:
    """Overwrite a text file in the checked-out repo. path is repo-relative."""
    p = WORKDIR / path
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(content, encoding="utf-8")
    return f"Wrote {path} ({len(content)} chars)"

@beta_tool
def repo_search(query: str, glob: str = "*") -> str:
    """Search for text using ripgrep. Returns matching lines."""
    return sh(WORKDIR, "rg", "--glob", glob, query, timeout=60)

@beta_tool
def run_command(command: str, timeout: int = 300) -> str:
    """Run a shell command in the repo (e.g., pytest, ruff)."""
    # Keep this strict in production: allow-list commands, no network, etc.
    return sh(WORKDIR, "bash", "-lc", command, timeout=timeout)

@beta_tool
def git_diff() -> str:
    """Show git diff."""
    return sh(WORKDIR, "git", "diff", timeout=30)

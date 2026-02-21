from urllib.parse import urlparse
from utils import _run_or_raise, _stdout
from pathlib import Path


def _owner_repo_from_url(repo_url: str) -> tuple[str, str]:
    if repo_url.startswith("git@"):
        path = repo_url.split(":", 1)[1].removesuffix(".git")
        owner, repo = path.split("/", 1)
        return owner, repo

    parsed = urlparse(repo_url)
    path = parsed.path.strip("/").removesuffix(".git")
    owner, repo = path.split("/", 1)
    return owner, repo


def _has_uncommitted_changes(cwd: Path) -> bool:
    out = _run_or_raise(cwd, "git", "status", "--porcelain")
    return bool(_stdout(out).strip())


def _ahead_commit_count(cwd: Path, base_branch: str, head_branch: str) -> int:
    out = _run_or_raise(cwd, "git", "rev-list", "--count", f"{base_branch}..{head_branch}")
    value = _stdout(out).strip()
    return int(value or "0")
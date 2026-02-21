import os
import re
import shlex
import shutil
from pathlib import Path
from datetime import datetime
from urllib.parse import urlparse
from dotenv import load_dotenv

from utils import sh, _on_rm_error, create_pr


ROOT_DIR = Path(__file__).resolve().parents[1]
load_dotenv(ROOT_DIR / ".env")

api_key = os.getenv("ANTHROPIC_API_KEY") or os.getenv("CLAUDE_API_KEY")
if not api_key:
    raise RuntimeError("Missing API key. Set ANTHROPIC_API_KEY (or CLAUDE_API_KEY) in .env.")

EXIT_RE = re.compile(r"\(exit (-?\d+)\)")


def _exit_code(cmd_output: str) -> int:
    m = EXIT_RE.search(cmd_output)
    return int(m.group(1)) if m else -1


def _stdout(cmd_output: str) -> str:
    marker = "STDOUT:\n"
    err_marker = "\nSTDERR:\n"
    if marker not in cmd_output:
        return ""
    body = cmd_output.split(marker, 1)[1]
    return body.split(err_marker, 1)[0]


def _run_or_raise(cwd: Path, *cmd: str, timeout: int = 120) -> str:
    out = sh(cwd, *cmd, timeout=timeout)
    print(out)
    code = _exit_code(out)
    if code != 0:
        raise RuntimeError(f"Command failed ({code}): {' '.join(cmd)}")
    return out


def _claude_code_command(task: str) -> list[str]:
    cmd = os.getenv("CLAUDE_CODE_CMD", "claude")
    args_str = os.getenv("CLAUDE_CODE_ARGS", "-p")
    args = shlex.split(args_str) if args_str else []
    parts = [cmd, *args]

    model = os.getenv("ANTHROPIC_MODEL")
    if model and "--model" not in parts and "-m" not in parts:
        parts.extend(["--model", model])

    # Prevent interactive permission prompts from blocking file edits in -p mode.
    if "--permission-mode" not in parts:
        permission_mode = os.getenv("CLAUDE_PERMISSION_MODE", "acceptEdits")
        parts.extend(["--permission-mode", permission_mode])

    selected_mode = None
    if "--permission-mode" in parts:
        mode_idx = parts.index("--permission-mode")
        if mode_idx + 1 < len(parts):
            selected_mode = parts[mode_idx + 1]

    bypass_env = os.getenv("CLAUDE_BYPASS_PERMISSIONS", "").strip().lower() in {"1", "true", "yes", "on"}
    if selected_mode == "bypassPermissions" or bypass_env:
        if "--dangerously-skip-permissions" not in parts:
            parts.append("--dangerously-skip-permissions")

    parts.append(task)
    return parts


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


def _looks_like_confirmation_request(cmd_output: str) -> bool:
    text = _stdout(cmd_output).lower()
    cues = (
        "would you like me to",
        "would you like me",
        "should i apply",
        "should i make",
        "do you want me to",
        "want me to apply",
    )
    return any(cue in text for cue in cues)


def generate_pr(repo_url: str, prompt: str, create_tests: bool = False):
    run_id = datetime.utcnow().strftime("%Y%m%d-%H%M%S")
    workdir = Path("agent/cloned_repo") / run_id
    workdir.mkdir(parents=True, exist_ok=True)

    base_branch = os.getenv("BASE_BRANCH", "main")
    branch = f"claude/fix-{run_id}"

    try:
        _run_or_raise(workdir, "git", "clone", repo_url, ".")
        _run_or_raise(workdir, "git", "checkout", base_branch)
        _run_or_raise(workdir, "git", "checkout", "-b", branch)

        final_report = run_agent(prompt, workdir, create_tests)
        print(final_report)

        if _has_uncommitted_changes(workdir):
            _run_or_raise(workdir, "git", "add", "-A")
            _run_or_raise(workdir, "git", "commit", "-m", f"Claude Code updates ({run_id})")

        ahead = _ahead_commit_count(workdir, base_branch, branch)
        if ahead == 0:
            print("No commits ahead of base branch; skipping push and PR creation.")
            return None

        _run_or_raise(workdir, "git", "push", "-u", "origin", branch)

        token = os.getenv("GITHUB_TOKEN")
        if not token:
            print("Missing GITHUB_TOKEN; skipping API PR creation.")
            owner, repo = _owner_repo_from_url(repo_url)
            manual_url = f"https://github.com/{owner}/{repo}/pull/new/{branch}"
            print(f"Open this URL to create the PR manually: {manual_url}")
            return None

        owner, repo = _owner_repo_from_url(repo_url)
        try:
            pr = create_pr(
                owner=owner,
                repo=repo,
                token=token,
                head=branch,
                base=base_branch,
                title=f"Claude Code updates ({run_id})",
                body=final_report,
            )
        except Exception as e:
            manual_url = f"https://github.com/{owner}/{repo}/compare/{base_branch}...{branch}?expand=1"
            print(f"Automatic PR creation failed: {e}")
            print(f"Open this URL to create the PR manually: {manual_url}")
            return None
        print(f"Created PR: {pr.get('html_url')}")
        return pr
    finally:
        if os.path.exists(workdir):
            # Need a bit of a workaround
            shutil.rmtree(workdir, onerror=_on_rm_error)


def run_agent(task: str, workdir: Path, create_tests: bool = False) -> str:
    test_instruction = (
        "- Add appropriate tests for the change.\n"
        if create_tests
        else "- Do NOT create new tests.\n"
    )

    base_prompt = (
        "You are an automated code-change agent working in the current repository.\n"
        "- Implement the requested code changes directly in files.\n"
        "- Do not ask for confirmation; apply the edits immediately.\n"
        "- Keep behavior unchanged unless the task says otherwise.\n"
        "- Run relevant tests/linters after edits.\n"
        f"{test_instruction}"
        "- Output a concise PR report: summary, rationale, tests run, risks.\n\n"
        f"Task:\n{task}"
    )

    timeout = int(os.getenv("CLAUDE_CODE_TIMEOUT", "1800"))
    cmd = _claude_code_command(base_prompt)
    print(f"Using Claude Code command: {' '.join(cmd[:-1])} <task>")
    out = sh(workdir, *cmd, timeout=timeout)
    if _exit_code(out) != 0:
        raise RuntimeError(f"Claude Code command failed.\n{out}")

    if _looks_like_confirmation_request(out):
        print("Claude asked for confirmation; retrying with strict apply-now instructions.")
        retry_prompt = (
            base_prompt
            + "\n\nIMPORTANT: Apply the code changes now. "
            + "Do not ask any question. If no changes are needed, say NO_CHANGES_NEEDED."
        )
        retry_cmd = _claude_code_command(retry_prompt)
        out = sh(workdir, *retry_cmd, timeout=timeout)
        if _exit_code(out) != 0:
            raise RuntimeError(f"Claude Code retry failed.\n{out}")

    return out


# Just to debug
if __name__ == "__main__":
    generate_pr(
        "https://github.com/03axdov/HackEuropeTesting",
        "In file2.py, func3 is slow. Improve it without changing behavior.",
    )


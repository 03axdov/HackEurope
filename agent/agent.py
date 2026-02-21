import os
import re
import shlex
import shutil
from pathlib import Path
from datetime import datetime
import requests
from dotenv import load_dotenv

from utils import _create_pr_record_via_backend, _run_or_raise, _stdout, _on_rm_error, sh, _exit_code, _looks_like_confirmation_request
from git_interactions import _has_uncommitted_changes, _ahead_commit_count, _owner_repo_from_url


ROOT_DIR = Path(__file__).resolve().parents[1]
load_dotenv(ROOT_DIR / ".env")

api_key = os.getenv("ANTHROPIC_API_KEY") or os.getenv("CLAUDE_API_KEY")
if not api_key:
    raise RuntimeError("Missing API key. Set ANTHROPIC_API_KEY (or CLAUDE_API_KEY) in .env.")


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


# Entry point
def generate_pr(repo_url: str, prompt: str, create_tests: bool = False):
    run_id = datetime.utcnow().strftime("%Y%m%d-%H%M%S")
    workdir = Path("agent/cloned_repos") / run_id
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

        owner, repo = _owner_repo_from_url(repo_url)
        title = f"Claude Code updates ({run_id})"
        try:
            pr = _create_pr_record_via_backend(
                repo_url=repo_url,
                owner=owner,
                repo=repo,
                base_branch=base_branch,
                head_branch=branch,
                title=title,
                body=final_report,
            )
        except Exception as e:
            manual_url = f"https://github.com/{owner}/{repo}/compare/{base_branch}...{branch}?expand=1"
            raise RuntimeError(
                f"Failed to create PullRequest record via backend API: {e}\n"
                f"Compare URL: {manual_url}"
            ) from e
        print(f"Created PullRequest record via backend API: id={pr.get('id')}")
        return pr
    finally:
        if os.path.exists(workdir):
            # Need a bit of a workaround
            shutil.rmtree(workdir, onerror=_on_rm_error)


def run_agent(task: str, workdir: Path, create_tests: bool = False) -> str:
    test_instruction = (
        "- Add appropriate tests for the change, and run these if possible.\n"
        if create_tests
        else "- Do NOT create new tests.\n"
    )

    base_prompt = (
        "You are an automated code-change agent working in the current repository.\n"
        "- Implement the requested code changes directly in files.\n"
        "- Do not ask for confirmation; apply the edits immediately.\n"
        "- Keep behavior unchanged unless the task says otherwise.\n"
        f"{test_instruction}"
        "- Output a concise PR report: summary, rationale, risks.\n\n"
        "- Use ASCII characters only in the PR report (e.g., write O(n^2), use [x] instead of checkmarks).\n\n"
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

    report = _stdout(out).strip()
    return report or out


# Just to debug
if __name__ == "__main__":
    generate_pr(
        "https://github.com/03axdov/HackEuropeTesting",
        "In file2.py, func3 is slow. Improve it without changing behavior.",
    )

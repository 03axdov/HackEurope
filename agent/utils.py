import subprocess
from pathlib import Path
import requests
import os
import stat
import time
import re


def sh(cwd: Path, *cmd: str, timeout: int = 120) -> str:
    try:
        p = subprocess.run(
            cmd,
            cwd=cwd,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=timeout,
        )
        return f"$ {' '.join(cmd)}\n(exit {p.returncode})\nSTDOUT:\n{p.stdout}\nSTDERR:\n{p.stderr}"
    except FileNotFoundError as e:
        return f"$ {' '.join(cmd)}\n(exit 127)\nSTDOUT:\n\nSTDERR:\n{e}"


def _create_pr_record_via_backend(
    repo_url: str,
    owner: str,
    repo: str,
    base_branch: str,
    head_branch: str,
    title: str,
    body: str,
):
    backend_api_base = os.getenv("BACKEND_API_BASE_URL").rstrip("/")
    url = f"{backend_api_base}/pull-requests/"
    compare_url = f"https://github.com/{owner}/{repo}/compare/{base_branch}...{head_branch}?expand=1"

    payload = {
        "repo_owner": owner,
        "repo_name": repo,
        "repo_url": repo_url,
        "base_branch": base_branch,
        "head_branch": head_branch,
        "title": title,
        "body": body,
        "compare_url": compare_url,
    }
    response = requests.post(url, json=payload, timeout=30)
    if not response.ok:
        raise RuntimeError(
            f"Backend API pull-request creation failed ({response.status_code}): {response.text}"
        )
    return response.json()


def _on_rm_error(func, path, exc_info):
    # Make the file writable, then retry
    try:
        os.chmod(path, stat.S_IWRITE)
        func(path)
    except Exception:
        # Small backoff and retry once more (helps when a process just released the handle)
        time.sleep(0.2)
        os.chmod(path, stat.S_IWRITE)
        func(path)


def _stdout(cmd_output: str) -> str:
    marker = "STDOUT:\n"
    err_marker = "\nSTDERR:\n"
    if marker not in cmd_output:
        return ""
    body = cmd_output.split(marker, 1)[1]
    return body.split(err_marker, 1)[0]


EXIT_RE = re.compile(r"\(exit (-?\d+)\)")
def _exit_code(cmd_output: str) -> int:
    m = EXIT_RE.search(cmd_output)
    return int(m.group(1)) if m else -1


def _run_or_raise(cwd: Path, *cmd: str, timeout: int = 120) -> str:
    out = sh(cwd, *cmd, timeout=timeout)
    print(out)
    code = _exit_code(out)
    if code != 0:
        raise RuntimeError(f"Command failed ({code}): {' '.join(cmd)}")
    return out


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

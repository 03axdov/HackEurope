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


def create_pr(owner: str, repo: str, token: str, head: str, base: str, title: str, body: str):
    url = f"https://api.github.com/repos/{owner}/{repo}/pulls"
    payload = {"title": title, "head": head, "base": base, "body": body}
    auth_headers = [f"Bearer {token}", f"token {token}"]
    last_response = None

    for auth in auth_headers:
        r = requests.post(
            url,
            headers={
                "Authorization": auth,
                "Accept": "application/vnd.github+json",
            },
            json=payload,
            timeout=30,
        )
        last_response = r
        if r.ok:
            return r.json()

        # Retry with alternate auth header format only for auth-style failures.
        if r.status_code not in (401, 403):
            break

    status = last_response.status_code if last_response is not None else "unknown"
    details = ""
    if last_response is not None:
        try:
            j = last_response.json()
            message = j.get("message", "").strip()
            errors = j.get("errors")
            if errors:
                details = f"{message}; errors={errors}"
            else:
                details = message
        except Exception:
            details = (last_response.text or "").strip()

    raise RuntimeError(
        "GitHub PR creation failed "
        f"(status={status}). {details or 'No response details.'} "
        "Check token permissions for this repo (Pull requests: Read and write)."
    )


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

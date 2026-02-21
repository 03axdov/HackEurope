import subprocess
from pathlib import Path
import requests
import os
import stat
import time


def sh(cwd: Path, *cmd: str, timeout: int = 120) -> str:
    try:
        p = subprocess.run(
            cmd, cwd=cwd, capture_output=True, text=True, timeout=timeout
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

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
    r = requests.post(
        url,
        headers={
            "Authorization": f"Bearer {token}",
            "Accept": "application/vnd.github+json",
        },
        json={"title": title, "head": head, "base": base, "body": body},
        timeout=30,
    )
    r.raise_for_status()
    return r.json()


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
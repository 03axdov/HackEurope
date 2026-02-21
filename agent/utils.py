import subprocess
from pathlib import Path
import requests


def sh(cwd: Path, *cmd: str, timeout: int = 120) -> str:
    p = subprocess.run(
        cmd, cwd=cwd, capture_output=True, text=True, timeout=timeout
    )
    return f"$ {' '.join(cmd)}\n(exit {p.returncode})\nSTDOUT:\n{p.stdout}\nSTDERR:\n{p.stderr}"


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
import os
import re
import shutil
from pathlib import Path
from datetime import datetime
import anthropic
from dotenv import load_dotenv

from utils import sh, _on_rm_error
from tools import *


ROOT_DIR = Path(__file__).resolve().parents[1]
load_dotenv(ROOT_DIR / ".env")

api_key = os.getenv("ANTHROPIC_API_KEY") or os.getenv("CLAUDE_API_KEY")
if not api_key:
    raise RuntimeError("Missing API key. Set ANTHROPIC_API_KEY (or CLAUDE_API_KEY) in .env.")

client = anthropic.Anthropic(api_key=api_key)

EXIT_RE = re.compile(r"\(exit (-?\d+)\)")
MAX_TOOL_RESULT_CHARS = 8_000
MAX_HISTORY_ITEMS = 8


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


def _truncate_for_model(text: str, max_chars: int = MAX_TOOL_RESULT_CHARS) -> str:
    if len(text) <= max_chars:
        return text
    cut = len(text) - max_chars
    return text[:max_chars] + f"\n... [truncated {cut} chars before sending to model]"


def _prune_messages(messages: list[dict], keep_items: int = MAX_HISTORY_ITEMS) -> list[dict]:
    if len(messages) <= keep_items + 1:
        return messages
    head = messages[0]
    tail = messages[-keep_items:]
    return [head] + tail


def generate_pr(repo_url: str, prompt: str):
    run_id = datetime.utcnow().strftime("%Y%m%d-%H%M%S")
    workdir = Path("agent/cloned_repo") / run_id
    workdir.mkdir(parents=True, exist_ok=True)
    print(set_workdir(workdir))

    # Contains two files and three functions, with func2 in file2 being an O(n^2) solution to two-sum
    repo_url = repo_url
    base_branch = "main"
    branch = f"claude/fix-{run_id}"

    try:
        _run_or_raise(workdir, "git", "clone", repo_url, ".")
        _run_or_raise(workdir, "git", "checkout", base_branch)
        _run_or_raise(workdir, "git", "checkout", "-b", branch)
        
        final_report = run_agent(prompt)
        print(final_report)

        print(sh(workdir, "git", "status"))
        print(sh(workdir, "git", "diff"))
    finally:
        if os.path.exists(workdir):
            # Need a bit of a workaround
            shutil.rmtree(workdir, onerror=_on_rm_error)
        

def run_agent(task: str) -> str:
    system = """You are an automated code-change agent.
- Prefer small, correct changes.
- Implement the requested code changes directly in the repo using tools.
- Always run tests/linters relevant to your change.
- When performance is requested, add or update a micro-benchmark or justify via reasoning + complexity.
- Output a clear PR description at the end: summary, rationale, tests run, risks.
"""
    messages = [{"role": "user", "content": task}]
    model = os.getenv("ANTHROPIC_MODEL")
    if not model:
        raise RuntimeError("Missing ANTHROPIC_MODEL in .env.")

    print(f"Using Anthropic model: {model}")
    for i in range(20):
        print(f"Iteration: {i + 1}")
        resp = client.messages.create(
            model=model,
            max_tokens=800,
            system=system,
            messages=messages,
            tools=[
                repo_read_file.to_dict(),
                repo_write_file.to_dict(),
                repo_search.to_dict(),
                run_command.to_dict(),
                git_diff.to_dict(),
            ],
        )

        # If Claude produced final text without tool calls:
        if resp.stop_reason == "end_turn":
            return resp.content[0].text

        # Tool use:
        tool_results = []
        for block in resp.content:
            if block.type == "tool_use":
                tool_name = block.name
                tool_input = block.input
                try:
                    # anthropic SDK beta_tool helpers will route these for you in higher-level wrappers,
                    # but explicit dispatch is fine for a prototype:
                    if tool_name == "repo_read_file":
                        out = repo_read_file(**tool_input)
                    elif tool_name == "repo_write_file":
                        out = repo_write_file(**tool_input)
                    elif tool_name == "repo_search":
                        out = repo_search(**tool_input)
                    elif tool_name == "run_command":
                        out = run_command(**tool_input)
                    elif tool_name == "git_diff":
                        out = git_diff()
                    else:
                        out = f"Unknown tool: {tool_name}"
                except Exception as e:
                    out = f"Tool error in {tool_name}: {e}"

                tool_results.append({
                    "type": "tool_result",
                    "tool_use_id": block.id,
                    "content": _truncate_for_model(out)
                })

        messages.append({"role": "assistant", "content": resp.content})
        messages.append({"role": "user", "content": tool_results})
        messages = _prune_messages(messages)

    raise RuntimeError("Agent exceeded max iterations (20) without finishing.")


# Just to debug
if __name__ == "__main__":
    generate_pr(
        "https://github.com/03axdov/HackEuropeTesting", 
        "In file2.py, function2 is slow. Improve it without changing behavior."
    )

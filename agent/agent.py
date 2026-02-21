import os
import tempfile
from pathlib import Path
from datetime import datetime
import anthropic

from utils import sh
from tools import *


client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])


def run_agent(task: str, model: str = "claude-3-5-sonnet-20241022") -> str:
    system = """You are an automated code-change agent.
- Prefer small, correct changes.
- Always run tests/linters relevant to your change.
- When performance is requested, add or update a micro-benchmark or justify via reasoning + complexity.
- Output a clear PR description at the end: summary, rationale, tests run, risks.
"""
    messages = [{"role": "user", "content": task}]

    while True:
        resp = client.messages.create(
            model=model,
            max_tokens=2000,
            system=system,
            messages=messages,
            tools=[repo_read_file, repo_write_file, repo_search, run_command, git_diff],
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

                tool_results.append({
                    "type": "tool_result",
                    "tool_use_id": block.id,
                    "content": out
                })

        messages.append({"role": "assistant", "content": resp.content})
        messages.append({"role": "user", "content": tool_results})

# -------- main prototype ----------
with tempfile.TemporaryDirectory() as d:
    WORKDIR = Path(d)

    repo_url = "https://github.com/OWNER/REPO.git"
    base_branch = "main"
    branch = f"claude/fix-{datetime.utcnow().strftime('%Y%m%d-%H%M%S')}"

    print(sh(WORKDIR, "git", "clone", repo_url, "."))
    print(sh(WORKDIR, "git", "checkout", base_branch))
    print(sh(WORKDIR, "git", "checkout", "-b", branch))

    task = "In file2.py, function1 is slow. Improve it without changing behavior. Add/adjust tests and a micro-benchmark if easy."
    final_report = run_agent(task)
    print(final_report)

    print(sh(WORKDIR, "git", "status"))
    print(sh(WORKDIR, "git", "diff"))
#!/usr/bin/env python3
"""
Export Claude Code chat history to a readable text file.
Usage:
  python3 export-chat.py                  # exports the most recent session
  python3 export-chat.py <session-id>     # exports a specific session
"""

import json
import os
import sys
import glob
from datetime import datetime

SESSIONS_DIR = os.path.expanduser("~/.claude/projects/-Users-alexstoliarchuk-budgetly")
FALLBACK_DIR = os.path.expanduser("~/.claude/projects/-Users-alexstoliarchuk")
OUTPUT_DIR   = os.path.expanduser("~/budgetly")


def find_session_file(session_id=None):
    for base in [SESSIONS_DIR, FALLBACK_DIR]:
        if session_id:
            path = os.path.join(base, f"{session_id}.jsonl")
            if os.path.exists(path):
                return path
        else:
            files = glob.glob(os.path.join(base, "*.jsonl"))
            if files:
                return max(files, key=os.path.getmtime)
    return None


def extract_text(content):
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = []
        for block in content:
            if isinstance(block, dict):
                if block.get("type") == "text":
                    parts.append(block.get("text", ""))
                elif block.get("type") == "tool_use":
                    parts.append(f"[tool: {block.get('name', '')}]")
                elif block.get("type") == "tool_result":
                    inner = extract_text(block.get("content", ""))
                    if inner:
                        parts.append(f"[tool result: {inner[:200]}{'...' if len(inner) > 200 else ''}]")
        return "\n".join(p for p in parts if p)
    return ""


def export_session(session_file, output_file):
    turns = []
    with open(session_file) as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                obj = json.loads(line)
            except json.JSONDecodeError:
                continue

            if obj.get("type") not in ("user", "assistant"):
                continue

            msg = obj.get("message", {})
            role = msg.get("role", obj.get("type", "?"))
            content = extract_text(msg.get("content", ""))
            ts = obj.get("timestamp", "")
            if ts:
                try:
                    dt = datetime.fromisoformat(ts.replace("Z", "+00:00"))
                    ts = dt.strftime("%Y-%m-%d %H:%M:%S UTC")
                except Exception:
                    pass

            if content.strip():
                turns.append((role, ts, content))

    if not turns:
        print("No messages found in session.")
        return

    session_id = os.path.basename(session_file).replace(".jsonl", "")
    with open(output_file, "w") as out:
        out.write(f"# Claude Code Chat Export\n")
        out.write(f"Session: {session_id}\n")
        out.write(f"Exported: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
        out.write(f"Messages: {len(turns)}\n")
        out.write("=" * 60 + "\n\n")

        for role, ts, content in turns:
            label = "You" if role == "user" else "Claude"
            out.write(f"### {label}  [{ts}]\n\n")
            out.write(content.strip())
            out.write("\n\n" + "-" * 60 + "\n\n")

    print(f"Exported {len(turns)} messages → {output_file}")


if __name__ == "__main__":
    session_id = sys.argv[1] if len(sys.argv) > 1 else None
    session_file = find_session_file(session_id)

    if not session_file:
        print("No session file found.")
        sys.exit(1)

    print(f"Session file: {session_file}")
    ts = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    output_file = os.path.join(OUTPUT_DIR, f"chat-export-{ts}.txt")
    export_session(session_file, output_file)

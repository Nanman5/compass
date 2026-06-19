#!/usr/bin/env bash
# Live, readable tail of Compass chat/voice logs.
#
# Next.js 16 dev writes a JSON-lines log that captures BOTH server and browser console
# output to .next/dev/logs/next-development.log. This filters it to the chat/voice/tool
# lines (and any error/warn) and pretty-prints them, so you (or the assistant) can troubleshoot
# the text and voice onboarding flows in one place.
#
# Usage:  ./scripts/chat-logs.sh            (follow live)
#         ./scripts/chat-logs.sh --all      (don't filter — show everything)

LOG="${COMPASS_DEV_LOG:-.next/dev/logs/next-development.log}"
MODE="${1:-filter}"

if [ ! -f "$LOG" ]; then
  echo "No dev log at $LOG — start the dev server first (npm run dev)."
  exit 1
fi

LOG="$LOG" MODE="$MODE" python3 -u - <<'PY'
import os, json, time

path = os.environ["LOG"]
show_all = os.environ.get("MODE") == "--all"
KEEP = ("[voice]", "[chat]", "[tool]", "[llm]")

def keep(o):
    if show_all:
        return True
    msg = o.get("message", "")
    lvl = o.get("level", "")
    return any(k in msg for k in KEEP) or lvl in ("ERROR", "WARN")

def show(line):
    line = line.strip()
    if not line:
        return
    try:
        o = json.loads(line)
    except Exception:
        return
    if not keep(o):
        return
    ts = o.get("timestamp", "")
    src = (o.get("source", "") or "")[:3]
    lvl = o.get("level", "")
    print(f"{ts}  {src:>3}  {lvl:<5}  {o.get('message','')}")

with open(path) as f:
    # Print the recent tail, then follow.
    lines = f.readlines()
    for line in lines[-200:]:
        show(line)
    while True:
        line = f.readline()
        if line:
            show(line)
        else:
            time.sleep(0.4)
PY

#!/bin/bash
# planning-with-files: User prompt submit hook for Cursor
# Reminds the agent about active planning files on every user message.
# Critical for session recovery after context reset.

if [ -f task_plan.md ]; then
    echo "[planning-with-files] Active plan detected. If you have not read task_plan.md, progress.md, and findings.md in this conversation, read them now before proceeding."
fi
exit 0

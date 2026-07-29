# planning-with-files: User prompt submit hook for Cursor (PowerShell)
# Reminds the agent about active planning files on every user message.
# Critical for session recovery after context reset.

if (Test-Path "task_plan.md") {
    Write-Output "[planning-with-files] Active plan detected. If you have not read task_plan.md, progress.md, and findings.md in this conversation, read them now before proceeding."
}
exit 0

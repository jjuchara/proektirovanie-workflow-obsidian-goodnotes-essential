#!/usr/bin/env bash
set -uo pipefail

REPO_ROOT="$(git -C "${PWD}" rev-parse --show-toplevel 2>/dev/null || printf '%s' "${PWD}")"
[ -f "${REPO_ROOT}/.projectAgents/AGENTS.md" ] || exit 0

printf '%s
' '<project-agent-plugin>'
printf '%s
' '# Проектирование workflow Obsidian + Goodnotes (Essential)'
cat "${REPO_ROOT}/.projectAgents/AGENTS.md"
if [ -f "${REPO_ROOT}/.projectAgents/memory/MEMORY.md" ]; then
  printf '%s
' '## Project memory index'
  cat "${REPO_ROOT}/.projectAgents/memory/MEMORY.md"
fi
printf '%s
' '</project-agent-plugin>'

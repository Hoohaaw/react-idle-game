#!/bin/bash
# Blocks any git push that targets master directly.
# Claude must use a feature/fix branch and open a PR instead.

INPUT=$(cat)
CMD=$(echo "$INPUT" | jq -r '.tool_input.command // ""')

if echo "$CMD" | grep -qE 'git push.*(origin\s+master|master\s+master|--force.*master|master$)'; then
  echo "Direct push to master is not allowed." >&2
  echo "Create a branch and open a PR instead (see CLAUDE.md § Git workflow)." >&2
  exit 2
fi

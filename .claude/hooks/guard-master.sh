#!/bin/bash
# Blocks direct pushes to master AND commits made while on master.
# Claude must use a feature/fix branch and open a PR instead.
# Registered for both the Bash and PowerShell tools.
# Parses hook JSON with node (jq is not installed on this machine).

INPUT=$(cat)
CMD=$(printf '%s' "$INPUT" | node -p 'try{(JSON.parse(require("fs").readFileSync(0,"utf8")).tool_input||{}).command||""}catch(e){""}' 2>/dev/null)

block() {
  echo "$1" >&2
  echo "Create a branch and open a PR instead (see CLAUDE.md § Git workflow)." >&2
  exit 2
}

# --- push guard ---
if echo "$CMD" | grep -qE '(^|[;&|({])[[:space:]]*git\b[^|;&]*\bpush\b'; then
  # Any push that names master explicitly, regardless of current branch
  if echo "$CMD" | grep -qE '\bpush\b[^|;&]*\bmaster\b'; then
    block "Direct push to master is not allowed."
  fi
  # Any push while HEAD is master (a bare 'git push' would push master via tracking)
  if [ "$(git rev-parse --abbrev-ref HEAD 2>/dev/null)" = "master" ]; then
    block "Refusing to push while on master."
  fi
fi

# --- commit guard ---
if echo "$CMD" | grep -qE '(^|[;&|({])[[:space:]]*git\b[^|;&]*\bcommit\b'; then
  # Allow compound commands that create a branch first (git checkout -b / git switch -c)
  if ! echo "$CMD" | grep -qE 'checkout +-b|switch +-c'; then
    if [ "$(git rev-parse --abbrev-ref HEAD 2>/dev/null)" = "master" ]; then
      block "Committing on master is not allowed."
    fi
  fi
fi

exit 0

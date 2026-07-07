#!/bin/bash
# Pre-commit safety net: blocks commits containing secrets, .env files, or
# merge-conflict markers. Scans staged + unstaged + untracked changes because
# compound commands (git add ... && git commit) stage AFTER this hook runs.
# Registered for both the Bash and PowerShell tools.

INPUT=$(cat)
CMD=$(printf '%s' "$INPUT" | node -p 'try{(JSON.parse(require("fs").readFileSync(0,"utf8")).tool_input||{}).command||""}catch(e){""}' 2>/dev/null)

echo "$CMD" | grep -qE '(^|[;&|({])[[:space:]]*git\b[^|;&]*\bcommit\b' || exit 0

block() { echo "$1" >&2; echo "Commit blocked." >&2; exit 2; }

FILES=$(git status --porcelain 2>/dev/null | sed 's/^...//' | tr -d '"')

# 1. Sensitive files (.env and variants, except .env.example)
BAD_ENV=$(echo "$FILES" | grep -E '(^|/)\.env(\.|$)' | grep -v '\.example$')
[ -n "$BAD_ENV" ] && block "Refusing to commit environment file(s): $BAD_ENV"

# 2. Merge-conflict markers in changed content
if git diff HEAD 2>/dev/null | grep -qE '^\+(<<<<<<< |>>>>>>> )'; then
  block "Merge-conflict markers found in changed files."
fi

# 3. Secret patterns in changed content (added lines) and untracked files
SECRET_RE='sbp_[A-Za-z0-9]{16,}|sk-ant-[A-Za-z0-9_-]{16,}|-----BEGIN [A-Z ]*PRIVATE KEY|eyJ[A-Za-z0-9_-]{20,}\.eyJ[A-Za-z0-9_-]{20,}'
if git diff HEAD 2>/dev/null | grep '^+' | grep -qE "$SECRET_RE"; then
  block "Possible secret/API key detected in changed files. Move it to .env (gitignored) or Supabase secrets."
fi
UNTRACKED=$(git status --porcelain 2>/dev/null | grep '^??' | sed 's/^...//' | tr -d '"')
for f in $UNTRACKED; do
  [ -f "$f" ] && grep -qIE "$SECRET_RE" "$f" 2>/dev/null && block "Possible secret/API key detected in new file: $f"
done

exit 0

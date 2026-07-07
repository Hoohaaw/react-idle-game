#!/bin/bash
# Quality gate before every git commit: lint, type-check, then the test suite
# (with one retry — the full parallel run intermittently crashes all workers;
# infra flake, not a real break). Skips entirely for commits that touch no
# source/config files (docs, ADRs, hooks), so docs commits stay fast.
# Registered for both the Bash and PowerShell tools.
# Parses hook JSON with node (jq is not installed on this machine).

INPUT=$(cat)
CMD=$(printf '%s' "$INPUT" | node -p 'try{(JSON.parse(require("fs").readFileSync(0,"utf8")).tool_input||{}).command||""}catch(e){""}' 2>/dev/null)

echo "$CMD" | grep -qE '(^|[;&|({])[[:space:]]*git\b[^|;&]*\bcommit\b' || exit 0

# Staged + unstaged + untracked (compound commands stage after this hook runs)
CHANGED=$(git status --porcelain 2>/dev/null | sed 's/^...//' | tr -d '"')
if ! echo "$CHANGED" | grep -qE '^(src|supabase/functions)/|^(package(-lock)?\.json|vite\.config\.ts|tsconfig[^/]*\.json|eslint\.config\.[^/]+|index\.html)$'; then
  echo "No source changes — skipping lint/type-check/tests for this commit." >&2
  exit 0
fi

echo "Linting..." >&2
if ! npm run lint --silent; then
  echo "Lint failed — commit blocked." >&2
  exit 2
fi

echo "Type-checking..." >&2
if ! npx tsc --noEmit; then
  echo "Type check failed — commit blocked." >&2
  exit 2
fi

echo "Running tests before commit..." >&2
if ! npm test --silent; then
  echo "Tests failed — retrying once (known flaky full-run worker crash)..." >&2
  if ! npm test --silent; then
    echo "Tests failed twice — commit blocked. Fix the failures above before committing." >&2
    exit 2
  fi
fi
echo "All pre-commit checks passed." >&2

exit 0

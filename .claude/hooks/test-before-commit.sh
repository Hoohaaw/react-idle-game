#!/bin/bash
# Runs the test suite before every git commit.
# Blocks the commit if any test fails.

INPUT=$(cat)
CMD=$(echo "$INPUT" | jq -r '.tool_input.command // ""')

if echo "$CMD" | grep -qE '^git commit'; then
  echo "Running tests before commit..." >&2
  if ! npm test --silent; then
    echo "" >&2
    echo "Tests failed — commit blocked. Fix the failures above before committing." >&2
    exit 2
  fi
  echo "Tests passed." >&2
fi

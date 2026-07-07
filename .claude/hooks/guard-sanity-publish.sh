#!/bin/bash
# Blocks Sanity publish operations. Content stays in DRAFTS until the full
# roster + attributes + skills are authored (drafts-only policy).
# Registered for Bash, PowerShell, and the mcp__Sanity__publish_documents tool.
# Parses hook JSON with node (jq is not installed on this machine).

INPUT=$(cat)
TOOL=$(printf '%s' "$INPUT" | node -p 'try{JSON.parse(require("fs").readFileSync(0,"utf8")).tool_name||""}catch(e){""}' 2>/dev/null)
CMD=$(printf '%s' "$INPUT" | node -p 'try{(JSON.parse(require("fs").readFileSync(0,"utf8")).tool_input||{}).command||""}catch(e){""}' 2>/dev/null)

if [ "$TOOL" = "mcp__Sanity__publish_documents" ]; then
  echo "Sanity publish is blocked: drafts-only policy until the full roster is authored." >&2
  exit 2
fi

# CLI publish: sanity documents publish, npx sanity ... publish, etc.
# (requires whitespace after 'sanity' so prose like 'guard-sanity-publish' doesn't match)
if echo "$CMD" | grep -qiE '\bsanity[[:space:]]+[^|;&]*\bpublish\b'; then
  echo "Sanity publish is blocked: drafts-only policy until the full roster is authored." >&2
  exit 2
fi

exit 0

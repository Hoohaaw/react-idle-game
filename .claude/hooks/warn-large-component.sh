#!/bin/bash
# After a Write/Edit to a component file, warn when it exceeds the ~200-line
# component convention (CLAUDE.md) so it gets split instead of growing.

INPUT=$(cat)
FILE=$(printf '%s' "$INPUT" | node -p 'try{(JSON.parse(require("fs").readFileSync(0,"utf8")).tool_input||{}).file_path||""}catch(e){""}' 2>/dev/null | tr '\\' '/')

case "$FILE" in
  */src/*.tsx|src/*.tsx)
    [ -f "$FILE" ] || exit 0
    LINES=$(wc -l < "$FILE" | tr -d ' ')
    if [ "$LINES" -gt 250 ] 2>/dev/null; then
      printf '{"hookSpecificOutput":{"hookEventName":"PostToolUse","additionalContext":"%s is now %s lines — the project convention targets ~200-line components (CLAUDE.md). Consider extracting subcomponents or moving logic into a hook."}}\n' "$FILE" "$LINES"
    fi
    ;;
esac

exit 0

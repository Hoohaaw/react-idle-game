#!/bin/bash
# After any Write/Edit touching supabase/migrations/, inject the ADR-0003
# security checklist as context so it never gets skipped.
# Parses hook JSON with node (jq is not installed on this machine).

INPUT=$(cat)
FILE=$(printf '%s' "$INPUT" | node -p 'try{(JSON.parse(require("fs").readFileSync(0,"utf8")).tool_input||{}).file_path||""}catch(e){""}' 2>/dev/null)

case "$FILE" in
  *supabase/migrations/*|*supabase\\migrations\\*)
    cat <<'JSON'
{"hookSpecificOutput":{"hookEventName":"PostToolUse","additionalContext":"Migration file touched — ADR-0003 checklist before this ships: (1) ALTER TABLE ... ENABLE ROW LEVEL SECURITY on every new table; (2) owner-read RLS policy (auth.uid() = user_id); (3) explicit GRANTs to authenticated — SELECT only for gameplay tables, NO client INSERT/UPDATE/DELETE; (4) all writes go through an Edge Function; (5) run mcp__supabase__get_advisors after applying; (6) regenerate src/types/database.types.ts (mcp generate_typescript_types) so client types match the schema."}}
JSON
    ;;
esac

exit 0

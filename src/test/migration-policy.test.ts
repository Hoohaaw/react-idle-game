import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

// Static lint over supabase/migrations/*.sql enforcing the ADR-0003 security posture that every
// gameplay table and RPC must follow. The 2026-09-09 audit found group_runs shipped with RLS
// enabled but no table GRANT — every client read failed with "permission denied" — and the
// service-layer tests couldn't catch it because they mock the Supabase client. This test reads
// the migrations themselves, so the whole class is caught at `npm test` time with no database.
//
// Three invariants, all derived from the conventions the existing migrations already follow:
//   1. Every table with RLS enabled has `grant select ... to authenticated` (otherwise RLS
//      without a grant = permission denied on read).
//   2. No table grants INSERT/UPDATE/DELETE to authenticated — clients never write gameplay
//      state directly; every write goes through a SECURITY DEFINER RPC.
//   3. Every RPC is revoked from public/anon/authenticated and execute-granted to service_role
//      only. Supabase's default privileges auto-grant EXECUTE on new public functions to anon +
//      authenticated, so a missing revoke lets any signed-in user call the RPC via /rest/v1/rpc
//      with an arbitrary p_player (see 20260705140000_mission_rpcs.sql's own warning). Trigger
//      functions (`returns trigger`) are exempt — PostgREST cannot invoke them as RPCs at all.

// Vitest runs with the repo root as cwd (vite.config.ts's root); import.meta.url isn't a file: URL
// under the jsdom environment, so resolve from cwd instead.
const MIGRATIONS_DIR = resolve(process.cwd(), 'supabase', 'migrations')

function loadMigrationsSql(): string {
  const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort()
  const raw = files.map((f) => readFileSync(join(MIGRATIONS_DIR, f), 'utf8')).join('\n')
  // Strip comments so a commented-out grant/revoke can't satisfy (or trip) a check.
  return raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/--.*$/gm, '')
}

const unique = (xs: string[]) => [...new Set(xs)]
const matches = (sql: string, re: RegExp, group = 1) => unique([...sql.matchAll(re)].map((m) => m[group]))

const sql = loadMigrationsSql()

const rlsTables = matches(sql, /alter\s+table\s+public\.(\w+)\s+enable\s+row\s+level\s+security/gi)
const selectGrantedTables = matches(sql, /grant\s+select\s+on\s+public\.(\w+)\s+to\s+authenticated/gi)
const clientWriteGrants = matches(
  sql,
  /grant\s+[^;]*\b(?:insert|update|delete)\b[^;]*\bon\s+public\.(\w+)\s+to\s+authenticated/gi,
)

// name -> return type, for every function definition (last definition wins, same as Postgres).
const functionReturnTypes = new Map<string, string>()
for (const m of sql.matchAll(/create\s+(?:or\s+replace\s+)?function\s+public\.(\w+)\s*\([^)]*\)\s*returns\s+([\w.]+)/gi)) {
  functionReturnTypes.set(m[1], m[2].toLowerCase())
}
const rpcFunctions = [...functionReturnTypes.entries()].filter(([, ret]) => ret !== 'trigger').map(([name]) => name)
const revokedFunctions = matches(sql, /revoke\s+all\s+on\s+function\s+public\.(\w+)\s*\(/gi)
const serviceRoleGrantedFunctions = matches(
  sql,
  /grant\s+execute\s+on\s+function\s+public\.(\w+)\s*\([^)]*\)\s+to\s+service_role/gi,
)

describe('migration security policy (ADR-0003)', () => {
  it('parses at least one RLS table and one RPC (guards against a regex silently matching nothing)', () => {
    expect(rlsTables.length).toBeGreaterThan(0)
    expect(rpcFunctions.length).toBeGreaterThan(0)
  })

  it('every RLS-enabled table grants select to authenticated', () => {
    const missing = rlsTables.filter((t) => !selectGrantedTables.includes(t))
    expect(missing, `RLS tables with no \`grant select ... to authenticated\`: ${missing.join(', ')}`).toEqual([])
  })

  it('no table grants a client write (insert/update/delete) to authenticated', () => {
    expect(clientWriteGrants, `client write grants found on: ${clientWriteGrants.join(', ')}`).toEqual([])
  })

  it('every RPC is revoked from public/anon/authenticated', () => {
    const missing = rpcFunctions.filter((f) => !revokedFunctions.includes(f))
    expect(missing, `RPCs with no \`revoke all on function ...\`: ${missing.join(', ')}`).toEqual([])
  })

  it('every RPC is execute-granted to service_role', () => {
    const missing = rpcFunctions.filter((f) => !serviceRoleGrantedFunctions.includes(f))
    expect(missing, `RPCs with no \`grant execute ... to service_role\`: ${missing.join(', ')}`).toEqual([])
  })
})

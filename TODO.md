# The Idle Game — Roadmap / TODO

Shared checklist for the build. Tick items as we finish them — either of us can edit this file.
Each open item has a `↳ context:` anchor pointing at the memory topics + key files that hold the
full picture, so a review (even an unattended one) can give a *qualified* proposal.

> **Scheduled reviews (optional, local-only):** if we set up a scheduled "TODO review", the agent
> will — *while Claude Code is running* — read this file and write a **dated** file to
> `todo-reviews/YYYY-MM-DD.md` (**gitignored — local, not on GitHub**). For each open item it gives a
> plain-language definition + technical description + how-to. **Advisory only; it never implements.**
> See memory `feedback-todo-schedule-workflow`.

## Backend (Supabase)
- [ ] First Edge Function (recruit / level-up) — the server-authoritative write path
  `↳ context: project-data-architecture, project-tech-stack · supabase/functions/, src/lib/supabase.ts`
- [ ] Transcendence-reset logic (keep characters, reset level → 1 + blessings)
  `↳ context: project-design-decisions (transcendence), project-undecided (reset scope) · supabase/functions/`
- [ ] Generate DB types (`createClient<Database>`) — after `npx supabase login`
  `↳ context: project-data-architecture (types deferred) · src/lib/supabase.ts, src/types/`
- [ ] Auth wiring: connect the login/register forms to Supabase Auth
  `↳ context: project-tech-stack (auth) · src/components/ (login/register), src/lib/supabase.ts`
- [ ] Hosted Supabase project + push migrations (deploy time)
  `↳ context: project-data-architecture (no cloud yet) · supabase/`

## Combat (sim v1 — ADR-0013)
- [x] Enemy / encounter stat schema — `enemyDef` + `encounterDef` + `encounterEnemy` built, deployed, types regenerated; first fight seeded as drafts (Rotting Ghoul / Graveyard Awakening)
  `↳ context: project-combat (ADR-0013 fork 3) · studio/schemaTypes/`
- [x] Combat math v1 — formulas + first-pass constants pinned (ADR-0015): power routing, hit pipeline (K=100), timeline, healing, threat, margin/level-bonus curves, enemy tier template
  `↳ context: project-combat (ADR-0015) · docs/DECISIONS.md`
- [ ] Combat sim module — pure, seeded (mission_run id), action-timeline auto-battle → win/lose + per-char ending HP; ADR-0015 constants as a header block; unit-tested
  `↳ context: project-combat (ADR-0013 + ADR-0015) · src/lib/combat.ts`
- [ ] `player_characters.current_hp` migration (nullable = full; 0 = downed) + persistence on claim
  `↳ context: project-combat (persistence), project-data-architecture · supabase/migrations/`
- [ ] Utility role passive expression — OPEN (fork 6, digging deeper before deciding)
  `↳ context: project-combat (ADR-0013 fork 6), project-undecided, project-roles`

## Content (Sanity)
- [ ] Mission / item / loot-table / recipe schemas
  `↳ context: project-design-decisions (loot/items), project-crafting · studio/schemaTypes/`
- [ ] Author the remaining roster + content
  `↳ context: project-character-development, project-existing-assets · studio/`

## App wiring
- [ ] Install `@sanity/client` + first GROQ query into a page
  `↳ context: project-data-architecture (option a fetch), project-tech-stack · src/lib/, src/services/`
- [ ] Replace mock data in pages with real Supabase / Sanity reads
  `↳ context: project-next-steps (UI pages), project-data-architecture · src/pages/, src/hooks/`

## Housekeeping / polish
- [ ] Rename the project in `package.json` (`name` is still `vite-scaffold`, `version` `0.0.0`)
  `↳ context: cosmetic scaffold leftover · package.json`
- [ ] Code-split the app bundle (build warns: chunk > 500 kB)
  `↳ context: whole-app bundle; route-level dynamic import() or manualChunks · vite.config.ts, src/`

## Done
- [x] First real character authored in Sanity: **Mordrek Graveborn** (Death Knight / tank) — base stats + per-level growth (str +8@10, hp +30@25 milestones) + a 5-node blessing tree (prereq chain + row-7 ultimate). Seeded via Sanity **CLI** (`sanity documents create`, the MCP is read-only here). Currently a **draft** — review/publish in the Studio.
- [x] Profiles table (wallet: extensible JSONB currencies/resources + transcendence count) + signup trigger + `src/lib/currencies.ts` (RLS + grants, verified) — ADR-0004/0005
- [x] Stat engine: compute-on-read baselines, stacking, blessing bonuses, reward pipeline (`src/lib/stats.ts`, 16 tests) — per-stat *combat* effects & gear bonuses deferred to the combat model / item schema
- [x] Sanity Studio + `characterDef`/blessing-tree schema (deployed)
- [x] Supabase local stack + `player_characters` / `player_inventory` / `mission_runs` / `gather_assignments` (RLS + grants, verified)
- [x] Supabase browser client + env wiring

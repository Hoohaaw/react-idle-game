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
- [ ] Player profile + currency/resources table (coins, wood/ore/…, transcendence count)
  `↳ context: project-data-architecture, project-design-decisions · supabase/migrations/`
- [ ] Transcendence-reset logic (keep characters, reset level → 1 + blessings)
  `↳ context: project-design-decisions (transcendence), project-undecided (reset scope) · supabase/functions/`
- [ ] Generate DB types (`createClient<Database>`) — after `npx supabase login`
  `↳ context: project-data-architecture (types deferred) · src/lib/supabase.ts, src/types/`
- [ ] Auth wiring: connect the login/register forms to Supabase Auth
  `↳ context: project-tech-stack (auth) · src/components/ (login/register), src/lib/supabase.ts`
- [ ] Hosted Supabase project + push migrations (deploy time)
  `↳ context: project-data-architecture (no cloud yet) · supabase/`

## Content (Sanity)
- [ ] Author the first real character + blessing tree in the Studio
  `↳ context: project-character-development, project-data-architecture (Sanity modeling) · studio/`
- [ ] Mission / item / loot-table / recipe schemas
  `↳ context: project-design-decisions (loot/items), project-crafting · studio/schemaTypes/`
- [ ] Author the remaining roster + content
  `↳ context: project-character-development, project-existing-assets · studio/`

## App wiring
- [ ] Install `@sanity/client` + first GROQ query into a page
  `↳ context: project-data-architecture (option a fetch), project-tech-stack · src/lib/, src/services/`
- [ ] Stat engine: `statDefinitions.ts` effects + compute-on-read baselines + reward calc (with tests)
  `↳ context: project-design-decisions (stats/rewards), project-data-architecture (growth) · src/lib/statDefinitions.ts`
- [ ] Replace mock data in pages with real Supabase / Sanity reads
  `↳ context: project-next-steps (UI pages), project-data-architecture · src/pages/, src/hooks/`

## Done
- [x] Sanity Studio + `characterDef`/blessing-tree schema (deployed)
- [x] Supabase local stack + `player_characters` / `player_inventory` / `mission_runs` / `gather_assignments` (RLS + grants, verified)
- [x] Supabase browser client + env wiring

# The Idle Game — Roadmap / TODO

Shared checklist for the build. Tick items as we finish them — either of us can edit this file.

> **Scheduled reviews (optional):** if we set up a scheduled "TODO review", the agent will —
> *while Claude Code is running* — read this file and write a **dated, advisory** file to
> `todo-reviews/YYYY-MM-DD.md` with **suggestions on how to tackle each open item** (approach,
> steps, considerations, blockers). It does **not** implement anything — we review the
> suggestions together and decide. See memory `feedback-todo-schedule-workflow`.

## Backend (Supabase)
- [ ] First Edge Function (recruit / level-up) — the server-authoritative write path
- [ ] Player profile + currency/resources table (coins, wood/ore/…, transcendence count)
- [ ] Transcendence-reset logic (keep characters, reset level → 1 + blessings)
- [ ] Generate DB types (`createClient<Database>`) — after `npx supabase login`
- [ ] Auth wiring: connect the login/register forms to Supabase Auth
- [ ] Hosted Supabase project + push migrations (deploy time)

## Content (Sanity)
- [ ] Author the first real character + blessing tree in the Studio
- [ ] Mission / item / loot-table / recipe schemas
- [ ] Author the remaining roster + content

## App wiring
- [ ] Install `@sanity/client` + first GROQ query into a page
- [ ] Stat engine: `statDefinitions.ts` effects + compute-on-read baselines + reward calc (with tests)
- [ ] Replace mock data in pages with real Supabase / Sanity reads

## Done
- [x] Sanity Studio + `characterDef`/blessing-tree schema (deployed)
- [x] Supabase local stack + `player_characters` / `player_inventory` / `mission_runs` / `gather_assignments` (RLS + grants, verified)
- [x] Supabase browser client + env wiring

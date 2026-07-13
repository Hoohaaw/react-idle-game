# The Idle Game — Roadmap / TODO

Shared checklist for the build. Tick items as we finish them — either of us can edit this file.
Each open item has a `↳ context:` anchor pointing at the memory topics + key files that hold the
full picture, so a review (even an unattended one) can give a *qualified* proposal.

> **Scheduled reviews (optional, local-only):** if we set up a scheduled "TODO review", the agent
> will — *while Claude Code is running* — read this file and write a **dated** file to
> `todo-reviews/YYYY-MM-DD.md` (**gitignored — local, not on GitHub**). For each open item it gives a
> plain-language definition + technical description + how-to. **Advisory only; it never implements.**
> See memory `feedback-todo-schedule-workflow`.

## ✅ Milestone — mission→combat→claim→heal loop LIVE (2026-07-05)
The core gameplay cycle is built, deployed (hosted), and browser-verified end-to-end. See
[ARCHITECTURE.md §5.3](./docs/ARCHITECTURE.md#53-the-mission--combat--claim--heal-loop--built--verified-hosted)
and ADRs 0012–0017. Done since the sections below were written:
- **Backend hosted** (`nqaitmbwmuwpnpqatsfs`): auth, `recruit`, `mission-start`, `mission-claim`,
  `heal` Edge Functions; `start_mission`/`claim_mission` atomic RPCs; `player_characters.current_hp`.
- **Combat**: sim (`src/lib/combat.ts`) + gear-aware stat/reward engine; mission/item/loot Sanity schema.
- **UI (PR #14, open)**: MissionsPage (dispatch + active runs + claim) + InfirmaryPage, wired live;
  `/design` keeps mock prototypes.

**Next in this flow (not yet built):** heal cost/rate/capacity; feed real `transcendence_count`
(profile hook); gather start/claim loop; transcendence flow; balance combat constants + loot odds;
character sprite art. Older open items below may be stale — trust the milestone + ARCHITECTURE.md §5.3.

## Current queue — 2026-07-13 (post maps session)
- [x] **World maps + stage progression** (ADR-0034, PRs #51/#52, deployed + e2e-verified) — map
  toggle, 7 stages per map (7 = boss), sequential unlock, boss-gated next map. 3 maps live in
  drafts (Gravemarch / Embercrag / Frosthollow, 21 missions). Add maps per `docs/MAPS.md`.
  `↳ context: project-maps · docs/MAPS.md, docs/DECISIONS.md ADR-0034`
- [ ] **Mission durations / pacing** — all 21 missions carry PLACEHOLDER durations (15s stage 1 →
  15min map-3 boss). Playtest Gravemarch→Frosthollow, then decide the real pacing curve.
  `↳ context: project-maps (placeholders), project-undecided (mission-speed sources) · Sanity missionDef drafts`
- [ ] **itemDef authoring session** — only 4 items exist; gates map loot identity (waves 2+:
  earth/wind/holy/shadow maps), gear progression feel, and the Upgrading page. ~20–30 items
  across slots/tiers, wired into the 21 mission loot tables.
  `↳ context: project-gear-equip, project-maps (loot focus) · studio/schemaTypes/itemDef.ts, docs/MAPS.md`

## Decisions queue — 2026-07-10 (post balance-tuning + character-budget session)
- [x] **Elemental damage schools + enemy resistances** — BUILT: engine + schema + content
  (ADR-0033, PR #46), mission-claim deployed 2026-07-11, UI surfaces (dispatch strong/weak,
  mission-card resist line, roster school badges) in PR #48. Remaining: character-side resist
  gear affixes (v2, deferred by design — see docs/ELEMENTS.md).
  `↳ context: project-design-decisions, project-combat (hit pipeline), src/lib/combat.ts, studio/schemaTypes/enemyDef.ts`
- [ ] **Blessing trees = real build choices** — trees must change how a character plays (a tank
  specs deeper tankiness OR real damage), priced with the ADR-0031 stat prices + a per-tree budget
  so trees don't reopen the runaway problem. Decide tree budget size when authoring the first tree.
  `↳ context: project-character-budget, project-character-development · docs/CHARACTERS.md`
- [x] **Item rarity multiplier flattened** (was ×2/step = ×16 Legendary) — see ADR-0032.
- [x] **Mission failed screen** — distinguish *ran out of time* (team alive, enemy stood) from
  *party wiped*; claim UI needs a failure state that explains the loss honestly. Built (PR #49):
  reason-keyed Party Wiped / Out of Time screens in ClaimReward.
  `↳ context: project-combat (timeout = loss), feedback-game-stats-guide · src/features/missions/components/ClaimReward.tsx`
- [ ] **History / activity log component** — a place where the player can look back at what
  happened: missions run (win/loss, loot, XP), characters recruited/leveled/downed, gathers
  collected, upgrades made. Needs an events table (or derive from existing rows) + a page.
  `↳ context: project-next-steps · supabase/ (new events table?), src/features/`
- [ ] **Character acquisition economy** — recruit costs/sources per rarity (rarity now exists,
  ADR-0031); is the empty Legendary tier a launch character or long-term carrot?
  `↳ context: project-character-budget, project-undecided · docs/CHARACTERS.md`
- Party size: **3 is the law** (max 3, sending 1–2 allowed) — recorded in ADR-0032 consequences.

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

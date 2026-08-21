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
- [x] **itemDef authoring session** (ADR-0043/0044, 2026-07-15) — 23 itemDefs live (19 new + 4
  backfilled), all 10 slot types covered, rarity-scaled level-requirement gate shipped, 21
  mission loot tables rewired, `docs/ITEMS.md` written for replicating on future maps.
  `↳ context: project-items · docs/ITEMS.md, docs/DECISIONS.md ADR-0043/0044`
- [ ] **Caster/healer weapon-equivalent itemization** — wave 1's `weapon` slot lane is
  physical-attack only; casters/healers get spellPower/healingPower solely from trinkets,
  measuring ~23% vs. physical's ~32% in the wave-1 verification. Needs a magic-implement item
  lane (or a second weapon-slot variant per map) for role parity.
  `↳ context: project-items · docs/ITEMS.md, src/lib/stats.ts`
- [x] **Item flavour text** (2026-08-19) — all 23 itemDefs given map-themed one-sentence
  descriptions (Gravemarch: burial-road/shadow/bone; Embercrag: volcanic/fire; Frosthollow:
  glacier/ice), written to Sanity drafts. No mechanical restatement — statBonuses already show
  the numbers, description is flavor only.
  `↳ context: project-items · studio/schemaTypes/itemDef.ts`
- [x] **Item power-budget file** — `src/lib/itemBudget.ts` built, wired into `itemDef.ts`'s
  `statBonuses` validation. Budget is a per-slot cost-PER-LEVEL rate (not per-rarity — items only
  author a Common baseline), with a wider tolerance for minLevel≤3 "universal fill" items. New
  `PCT_STAT_PRICE` table prices pct effects (first-pass approximation, not modeled equivalence).
  `↳ context: project-items, project-character-budget · src/lib/itemBudget.ts, docs/ITEMS.md`
- [ ] **5 wave-1 items fail the new item budget** — `rusted-blade`, `battered-cuirass`,
  `iron-band` (all minLevel-1 starter placeholders, overcosted), `deadfen-treads` (carries a
  `dodge` bonus that also violates docs/ITEMS.md's "armor slots = health only" rule), `grave-sigil`
  (healingPower pct priced ~3.6x richer than `hoarfrost-talisman`'s). Retune values in Sanity drafts.
  `↳ context: project-items · src/lib/itemBudget.ts (auditItem), docs/ITEMS.md`

## Decisions queue — 2026-07-10 (post balance-tuning + character-budget session)
- [x] **Elemental damage schools + enemy resistances** — BUILT: engine + schema + content
  (ADR-0033, PR #46), mission-claim deployed 2026-07-11, UI surfaces (dispatch strong/weak,
  mission-card resist line, roster school badges) in PR #48. Remaining: character-side resist
  gear affixes (v2, deferred by design — see docs/ELEMENTS.md).
  `↳ context: project-design-decisions, project-combat (hit pipeline), src/lib/combat.ts, studio/schemaTypes/enemyDef.ts`
- [x] **Blessing trees = real build choices** (ADR-0045, 2026-07-15) — redesigned as 4 rows × 2
  choices (permanent, level-gated 10/20/30/40) + an earned capstone (stat/conditional/ability
  flavors). Mechanism shipped (`choose_blessing` RPC, real `/blessings` page); flat pricing across
  rarity closes the budget question. Ability-flavor combat engine + real per-character content are
  follow-ups (see below).
  `↳ context: project-blessings · docs/DECISIONS.md ADR-0045, src/lib/blessings.ts`
- [x] **Blessing capstone ability engine** (ADR-0045 Phase B, 2026-07-15) — `combat.ts` gained
  `surviveFatal` (once-per-fight lethal-hit save) and `partyBuffOnStart` (party-wide stat buff,
  dodge re-clamped to `COMBAT.DODGE_CAP`). Wired through mission-claim/roster/win-chance estimator.
  `↳ context: project-blessings · docs/DECISIONS.md ADR-0045, src/lib/combat.ts`
- [x] **Blessing tree content wave 1** (ADR-0046, 2026-07-15) — real 4-row+capstone trees authored
  for all 19 characters: per-role fork templates (damage offense/bulk+finishing-move, tank
  wall/off-tank, healer heal-style+tankiness, utility throughput/economy, gatherer
  resource-flavor+hybrid-combat), 6 ability/7 conditional/6 stat capstone split. `docs/BLESSINGS.md`
  is the methodology doc.
  `↳ context: project-blessings · docs/DECISIONS.md ADR-0046, docs/BLESSINGS.md`
- [x] **Blessing respec** (ADR-0047, 2026-07-15) — gold-cost (`RESPEC_COST`), all-or-nothing wipe
  of a character's entire tree via a new `/respec` page + `respec_blessings` RPC. Doubles as an
  intentional resource sink.
  `↳ context: project-blessings · docs/DECISIONS.md ADR-0047, supabase/migrations/20260715140000_blessing_respec.sql`
- [ ] **Blessing row-level conditions** — `blessingChoice` has no `condition` field (only the
  capstone does), so a row pick can't be gated to a specific resource/map/enemy. Gatherer rows
  work around this with unconditional, flavor-only bonuses (ADR-0046). Real engine PR if ever wanted.
  `↳ context: project-blessings · docs/BLESSINGS.md, studio/schemaTypes/objects/blessingChoice.ts`
- [ ] **`blessingBudget.ts` validator script** — a dedicated equal-cost/pct-drift checker for
  blessing content (mirrors the still-open `itemBudget.ts` TODO from ADR-0044); wave 1 verified
  by a throwaway scratchpad script instead.
  `↳ context: project-blessings · docs/BLESSINGS.md, src/lib/characterBudget.ts`
- [ ] **Re-derive harness power-tier proxy from real blessing content** — ADR-0040's own ask;
  `scripts/balance/roster.ts` is still the naked-baseline snapshot, unaware of wave 1's trees.
  `↳ context: project-balance-harness · docs/DECISIONS.md ADR-0040, scripts/balance/roster.ts`
- [x] **Item rarity multiplier flattened** (was ×2/step = ×16 Legendary) — see ADR-0032.
- [x] **Mission failed screen** — distinguish *ran out of time* (team alive, enemy stood) from
  *party wiped*; claim UI needs a failure state that explains the loss honestly. Built (PR #49):
  reason-keyed Party Wiped / Out of Time screens in ClaimReward.
  `↳ context: project-combat (timeout = loss), feedback-game-stats-guide · src/features/missions/components/ClaimReward.tsx`
- [ ] **History / activity log component** — a place where the player can look back at what
  happened: missions run (win/loss, loot, XP), characters recruited/leveled/downed, gathers
  collected, upgrades made. Needs an events table (or derive from existing rows) + a page.
  `↳ context: project-next-steps · supabase/ (new events table?), src/features/`
- [x] **Character acquisition economy** (2026-08-20) — full engine + wave-1 content shipped: 6
  condition types (`evaluateCondition`), Sanity `acquisition`/`characterLootDrop` schema, recruit
  RPC/Edge Function, `/recruits` UI with blind-surprise reveal. All 19 characters authored: 7 named
  unlocks (Nira/Rowan resourceTotal-Wood, Gort resourceTotal-Copper, Brom missionTimeTotal, Vex
  statThreshold-attack, Aldric characterLevel, Lyra goldTotal) + Mordrek Graveborn mapCompletion
  (Gravemarch stage 7) + Callum Emberveil as a 3% characterLootDrop on the Ember Tyrant (Embercrag
  boss); the other 11 are gold-only. goldCost scales Common 200 → Uncommon 500 → Rare 1000 → Epic
  2500 (empty Legendary tier still undecided). Thresholds computed from real roster/mission/mine
  data, not guessed.
  `↳ context: project-character-budget · ADR-0048, docs/superpowers/specs/2026-08-20-character-acquisition-design.md, docs/superpowers/plans/2026-08-20-character-acquisition.md`
- Party size: **3 is the law** (max 3, sending 1–2 allowed) — recorded in ADR-0032 consequences.

## Backend (Supabase)
- [x] First Edge Function — `recruit/` shipped; leveling is XP-driven via `mission-claim`
  (compute-on-read, ADR-0002), never needed a separate level-up endpoint.
- [ ] **Transcendence-reset logic** (keep characters, reset level → 1 + blessings) — the counter
  (`transcendence_count`) exists in `stats.ts`/`currencies.ts`/`mission-claim`, but
  `src/pages/TranscendencePage.tsx` is a 5-line stub. No reset RPC built at all.
  `↳ context: project-design-decisions (transcendence), project-undecided (reset scope) · supabase/functions/, src/pages/TranscendencePage.tsx`
- [x] Generate DB types — `src/types/database.types.ts` (465 lines, real generated types).
- [x] Auth wiring — `src/features/auth/AuthPage.tsx` + `RequireAuth.tsx`, wired into `App.tsx`.
- [x] Hosted Supabase project + migrations — 15 migrations live, `config.toml` has a real
  `project_id` (not the scaffold default).

## Combat (sim v1 — ADR-0013)
- [x] Enemy / encounter stat schema — `enemyDef` + `encounterDef` + `encounterEnemy` built, deployed, types regenerated; first fight seeded as drafts (Rotting Ghoul / Graveyard Awakening)
  `↳ context: project-combat (ADR-0013 fork 3) · studio/schemaTypes/`
- [x] Combat math v1 — formulas + first-pass constants pinned (ADR-0015): power routing, hit pipeline (K=100), timeline, healing, threat, margin/level-bonus curves, enemy tier template
  `↳ context: project-combat (ADR-0015) · docs/DECISIONS.md`
- [x] Combat sim module — `src/lib/combat.ts` (576 lines) + `combat.test.ts` (418 lines), pure/seeded.
- [x] `player_characters.current_hp` migration — `20260705120000_player_characters_current_hp.sql`,
  referenced across mission/gather/infirmary/map migrations.
- [ ] **Utility role passive expression** — OPEN (ADR-0013 fork 6). Re-checked 2026-08-20: still
  unresolved, no evidence the design question was ever closed. Needs a decision, not just code.
  `↳ context: project-combat (ADR-0013 fork 6), project-undecided, project-roles`

## Content (Sanity)
- [x] Mission / item / loot-table schemas — `missionDef`/`itemDef`/`lootDrop` real and deployed.
- [ ] **Recipe schema** — never built. Crafting still runs on `src/lib/mockRecipes.ts`; no
  `recipeDef` in `studio/schemaTypes/`. Split out from the old combined TODO line 2026-08-20.
  `↳ context: project-design-decisions (loot/items), project-crafting · studio/schemaTypes/, src/lib/mockRecipes.ts`
- [ ] **Roster size target** — 19 `characterDef` docs live (matches ADR-0046's "all 19
  characters"). Unclear whether that's the full intended roster or more are planned — no target
  number found in docs/CHARACTERS.md or elsewhere. Needs a decision before "author the rest" is
  actionable.
  `↳ context: project-character-development, project-existing-assets · docs/CHARACTERS.md`

## App wiring
- [x] `@sanity/client` installed (`^7.22.1`) and in use.
- [x] Mock data replaced with real Supabase/Sanity reads in `src/pages/*.tsx` — one exception:
  crafting still reads `mockRecipes.ts` (tied to the recipe-schema gap above).

## Housekeeping / polish
- [x] Rename the project in `package.json` — now `The-Idle-Game` (working title; final game name still open)
- [x] Code-split the app bundle — route-level `React.lazy` in `App.tsx`; entry chunk 921 kB → 488 kB, warning gone

## Done
- [x] First real character authored in Sanity: **Mordrek Graveborn** (Death Knight / tank) — base stats + per-level growth (str +8@10, hp +30@25 milestones) + a 5-node blessing tree (prereq chain + row-7 ultimate). Seeded via Sanity **CLI** (`sanity documents create`, the MCP is read-only here). Currently a **draft** — review/publish in the Studio.
- [x] Profiles table (wallet: extensible JSONB currencies/resources + transcendence count) + signup trigger + `src/lib/currencies.ts` (RLS + grants, verified) — ADR-0004/0005
- [x] Stat engine: compute-on-read baselines, stacking, blessing bonuses, reward pipeline (`src/lib/stats.ts`, 16 tests) — per-stat *combat* effects & gear bonuses deferred to the combat model / item schema
- [x] Sanity Studio + `characterDef`/blessing-tree schema (deployed)
- [x] Supabase local stack + `player_characters` / `player_inventory` / `mission_runs` / `gather_assignments` (RLS + grants, verified)
- [x] Supabase browser client + env wiring

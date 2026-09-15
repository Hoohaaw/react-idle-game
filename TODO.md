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
- [x] **Mission durations / pacing** (ADR-0049, 2026-09-08) — replaced all 21 placeholder
  durations with a doubling-per-stage, resetting-per-map curve (Gravemarch 15s→15min, Embercrag
  60s→1h, Frosthollow 5min→2h); formula recorded in `docs/MAPS.md` for future maps. Decided via
  design conversation, not a live playtest (none was run this session).
  `↳ context: project-maps · docs/DECISIONS.md ADR-0049, docs/MAPS.md`
- [ ] **Dungeon/raid content-authoring wave** — ADR-0050 shipped the engine + one reference dungeon
  ("Emberdeep Vault") + one reference raid ("Duskmaw Reliquary"). More dungeons/raids and their
  full themed item sets are the deferred next wave, same split as maps (ADR-0034) vs. item
  authoring (ADR-0043/0044).
  `↳ context: project-dungeons-raids · docs/DECISIONS.md ADR-0050, studio/schemaTypes/dungeonDef.ts`
- [ ] **Dungeon/raid server code has zero automated test coverage** — the accepted "no pgTAP/Deno
  test infra" gap (same one `recruit_character` already carries) now also covers `group_runs` +
  `start_group_stage`/`claim_group_stage` (new) and four EXISTING RPCs rewritten in the same
  migration (`equip_item`, `unequip_item`, `choose_blessing`, `respec_blessings`, each gained a
  `group_runs` busy-check). A bigger, more security-relevant surface than what the spec originally
  accepted the gap for. Building real Edge Function/SQL test infra would close this — not just for
  this feature, but for every future one that touches these RPCs.
  `↳ context: project-dungeons-raids · supabase/migrations/20260908140000_group_runs.sql, docs/superpowers/specs/2026-09-08-dungeons-and-raids-design.md §10`
- [x] **itemDef authoring session** (ADR-0043/0044, 2026-07-15) — 23 itemDefs live (19 new + 4
  backfilled), all 10 slot types covered, rarity-scaled level-requirement gate shipped, 21
  mission loot tables rewired, `docs/ITEMS.md` written for replicating on future maps.
  `↳ context: project-items · docs/ITEMS.md, docs/DECISIONS.md ADR-0043/0044`
- [x] **Caster/healer weapon-equivalent itemization** (2026-09-09) — added a caster (spellPower)
  and healer (healingPower) weapon alongside every existing physical weapon: 8 new itemDefs
  (`withered-femur-wand`/`cracked-prayer-beads` L1, `grave-iron-scepter`/`bone-reliquary` L4,
  `cinderfang-rod`/`cinderfang-censer` L8, `glacial-wand`/`glacial-chalice` L14), each budget-rate
  matched to its physical counterpart and wired into the same 10 missions at the same drop
  chances/rarity weights. `docs/ITEMS.md`'s slot-to-stat lane updated: `weapon` is now
  role-routed (3 itemDefs per tier), not physical-exclusive.
  `↳ context: project-items · docs/ITEMS.md, src/lib/itemBudget.ts`
- [x] **Caster/healer itemization overshoots parity** (2026-09-10) — retuned the 8 magic weapons
  to ≈0.6× their physical siblings (`2/6/15/16` → `1/4/9/12`): predicted +35.4%/+39.0% vs physical
  +32.2% at the L20 Rare anchor, down from +43.4/+47.2. Residual is `itemBudget.ts`'s weapon floor
  at L14 (can't go under 12), not a choice — see ADR-0051's amendment. Rule recorded in
  `docs/ITEMS.md`: magic weapon ≈ 0.6× physical at the same tier.
  `↳ context: project-items · docs/DECISIONS.md ADR-0051, docs/ITEMS.md`
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
- [x] **5 wave-1 items fail the new item budget** (2026-09-09) — retuned in Sanity drafts:
  `rusted-blade` attack 5→2 (rate 2.0/1.5 target), `battered-cuirass` health 20→2/defense 3→1
  (rate 1.3/0.75), `iron-band` defense 2→1/strength 2→1 (rate 2.0/1.2), `deadfen-treads` health
  6→8 + dodge bonus removed entirely (rate 1.2/0.7, also fixes the armor-slots-health-only
  violation), `grave-sigil` healingPower 6%→3% (rate 1.5/1.0 — down from 3.6x `hoarfrost-talisman`'s
  rate to 1.8x). All 5 now pass `auditItem`.
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
- [x] **`blessingBudget.ts` validator script** (2026-09-09) — dedicated module: `auditBlessingRow`
  (flat-effects equal-cost check, moved out of blessingRow.ts's inline validator into a reusable/
  tested function), `auditCapstoneCost`/`CAPSTONE_STAT_BUDGET` (new — capstone stat/conditional
  effects had no budget validator before this), and `pctEffectValue`/`auditPctDrift`/
  `auditCapstonePctCost` (the pct-drift checker — takes a real per-level baseline from
  `computeBaselines`, replacing the throwaway scratchpad approach with a reusable, tested one).
  `↳ context: project-blessings · src/lib/blessingBudget.ts, docs/BLESSINGS.md`
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
- [x] **Reset tier** (ADR-0053) — `reset_player`/`purchase_echo_shop_node` RPCs, the
  `reset-player`/`echo-shop-purchase` Edge Functions, the 20-node Echo Shop registry
  (`src/lib/echoShop.ts`), and the `src/features/reset/` page (nav renamed "Transcendence" →
  "Reset"). The harder Transcendence tier (full wipe including characters) shipped separately,
  see ADR-0054 below.
  `↳ context: project-reset · docs/DECISIONS.md ADR-0053, docs/superpowers/specs/2026-09-11-reset-echoes-design.md`
- [x] **Transcendence tier** (ADR-0054) — Ascendant Shards (earned via milestone thresholds on
  lifetime stats, not a lump sum), the Ascendant Shop (per-character Power/Vitality + flat
  economy nodes + rarity bias), the all-raids-cleared unlock gate, and protected character slots
  (a new Echo Shop node). Second tab in the `PrestigePage` shell, gated on eligibility.
  `↳ context: project-reset · docs/DECISIONS.md ADR-0054, docs/superpowers/specs/2026-09-12-transcendence-ascendant-shards-design.md`
- [x] **Ascendant/Echo Shop purchase price race** (2026-09-15) — fixed: both RPCs now recompute
  cost server-side under the same `for update` lock that reads the current level, ported from
  `src/lib/echoShop.ts`/`src/lib/ascendantShop.ts`'s `floor(costBase * costGrowth ** level)`
  formula into SQL (`double precision` math, not `numeric`, to keep parity with the client's
  JS-computed display price). `p_cost` dropped from both signatures entirely — a client-supplied
  price is no longer accepted at all. `supabase/migrations/20260915150000_lock_shop_purchase_price.sql`.
  `↳ context: project-reset · docs/DECISIONS.md ADR-0054, ADR-0057`
- [x] **Wire Ascendant stat bonuses into mission-start/gather-collect/client roster display**
  (2026-09-13) — `resolveCharAscendantBonuses`/`resolveFlatAscendantStatBonuses` now flow through
  `mission-start`, `gather-collect`, and `useRoster()`, matching `mission-claim`/`group-claim-stage`.
  Only `useRoster()` has a currently-visible effect (displayed max HP, dispatch win-chance estimate);
  the other two are consistency fixes since Power/Vitality don't touch `missionSpeedDecrease`/
  `gatherSpeed`/`gatherYield`. Both Edge Functions redeployed and byte-verified. PR #104.
  `↳ context: project-reset · docs/DECISIONS.md ADR-0054`
- [ ] **Pin the SQL/TypeScript Ascendant Milestone ladders together with a test** —
  `check_ascendant_milestones` (SQL) and `ASCENDANT_MILESTONES` (`src/lib/ascendantMilestones.ts`)
  hand-list the same thresholds independently; nothing catches drift if a future resource is added
  to one side and not the other (`src/test/migration-policy.test.ts` already parses migrations and
  is the natural home for this check).
  `↳ context: project-reset · docs/DECISIONS.md ADR-0054`
- [x] **Achievements system** (ADR-0055, 2026-09-14) — a purely cosmetic badge system: threshold
  ladders reusing `ASCENDANT_MILESTONES`'s own numbers plus one-off "moment" badges (Legendary
  equip, blessing capstone, level cap, full roster, first Reset/Transcend, Shard Hoarder, Days
  Played). No reward payout — a deliberate cut that lets `check_achievements` skip the row-locking
  discipline `check_ascendant_milestones` needs. New `/achievements` page. Two retroactivity gaps
  (pre-existing Shard balances, already-equipped Legendaries) flagged as open product decisions,
  not fixed.
  `↳ context: project-reset · docs/DECISIONS.md ADR-0055, src/lib/achievements.ts, src/features/achievements/`
- [ ] **Lifetime stats page** — a page showing the player's full `lifetime_stats` (missions/
  dungeons/raids cleared, gold earned, resources gathered, mission time sent, etc.), not just the
  Ascendant Milestone progress subset already shown in the Transcend tab's `MilestoneProgressList`.
  `↳ context: project-reset · src/lib/lifetimeStats.ts, src/features/reset/components/MilestoneProgressList.tsx`
- [ ] **Legendary class-specific quest-lines** — certain Legendary items, equippable only by a
  specific class, unlock a class-specific mission/quest line that further powers up that item once
  equipped. Flavor + a power ceiling for build-defining Legendaries. Raised during Transcendence
  brainstorming (2026-09-12) but is an independent item/content system, not part of that spec.
  `↳ context: project-items · docs/ITEMS.md, studio/schemaTypes/itemDef.ts`
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
- [ ] **Mission win-chance is too binary — needs strategic depth** — players can currently swing a
  mission's win chance from near-0% to near-100% without much meaningful choice along the way; want
  deliberate strategy (gear, party composition, blessings, prep) that actually earns a
  high-confidence mission rather than the current curve doing most of the work on its own. Needs its
  own design + balance pass per `docs/BALANCE.md`'s playbook (before/after sweep evidence, a
  discriminating regression test, an ADR) before any numbers change.
  `↳ context: project-combat · src/lib/combat.ts, docs/BALANCE.md, docs/DECISIONS.md ADR-0015`
- [x] **Indefinite "hone your skills" mission type (first instance: Religion/Church)** — shipped
  (ADR-0056): a character can be sent to train a skill (Religion, at Church) indefinitely, XP
  accrues continuously while assigned, the player collects or stops ("cashes out") whenever they
  choose, banking it into a per-character skill level independent of combat level. Generalizable —
  `src/lib/skills.ts`'s `SKILL_DEFS` registry, `src/features/skills/`. Skill levels have no effect
  on character power yet (deliberately deferred, see ADR-0056); a second skill type is a one-line
  registry entry.
  `↳ context: project-content · src/lib/skills.ts, src/features/skills/, docs/DECISIONS.md ADR-0056`

## Content (Sanity)
- [x] Mission / item / loot-table schemas — `missionDef`/`itemDef`/`lootDrop` real and deployed.
- [x] **Recipe schema** (ADR-0052) — `recipeDef`/`reagentLine` Sanity types, `craft_runs` +
  `start_craft`/`claim_craft`, `craft-start`/`craft-claim` Edge Functions, page migrated to
  `src/features/crafting/`, mocks deleted, 3 reference recipes authored. `infuse` recipes and
  discovery are separate follow-ups (spec §3).
  `↳ context: project-crafting · docs/DECISIONS.md ADR-0052, docs/superpowers/specs/2026-09-09-crafting-create-recipes-design.md`
- [ ] **Deploy the Sanity Studio schema** — `recipeDef`/`reagentLine`/`rarityWeight` exist in
  `studio/schemaTypes/` and content authored through them already works (verified end-to-end
  against the hosted Supabase project 2026-09-10), but the Studio UI itself hasn't been redeployed
  since, so these types won't show up for authoring there yet. Run `cd studio && npm run
  schema:deploy` (or `npm run deploy` for the full Studio).
  `↳ context: project-crafting · studio/schemaTypes/recipeDef.ts`
- [ ] **Crafting cancel/abandon** — no way to clear a stuck craft (recipe broken between start and
  claim) except deleting the `craft_runs` row. Design together with the rarity seed (client-derivable;
  cancel + restart = free re-roll) and a refund rule. See ADR-0052 consequences.
  `↳ context: project-crafting · docs/DECISIONS.md ADR-0052`
- [ ] **Roster size target** — 19 `characterDef` docs live (matches ADR-0046's "all 19
  characters"). Unclear whether that's the full intended roster or more are planned — no target
  number found in docs/CHARACTERS.md or elsewhere. Needs a decision before "author the rest" is
  actionable.
  `↳ context: project-character-development, project-existing-assets · docs/CHARACTERS.md`

## App wiring
- [x] `@sanity/client` installed (`^7.22.1`) and in use.
- [x] Mock data replaced with real Supabase/Sanity reads in `src/pages/*.tsx` — the one exception
  (crafting reading `mockRecipes.ts`) is closed: ADR-0052 deleted the mocks in favor of real
  Sanity recipes.

## Housekeeping / polish
- [x] Rename the project in `package.json` — now `The-Idle-Game` (working title; final game name still open)
- [x] Code-split the app bundle — route-level `React.lazy` in `App.tsx`; entry chunk 921 kB → 488 kB, warning gone
- [x] **Launch-checklist basics** (2026-09-15) — `<title>`/meta description in `index.html`
  (placeholder copy, real branding still open), `public/robots.txt`, and a real `/*` 404 route
  (`src/pages/NotFoundPage.tsx`, rendered inside `GameLayout` so the header stays) replacing the
  old silent redirect-to-`/missions`. Audited against a generic pre-launch checklist; CTA-above-
  fold / sticky mobile CTA / thank-you page judged not applicable — this is an auth-gated SPA with
  no marketing funnel or checkout, not a landing site.
  `↳ context: src/App.tsx, index.html`
- [ ] **Launch checklist — still open** — from the same audit: `sitemap.xml`; a real favicon set
  (currently one `favicon.svg` only — no `apple-touch-icon`, sized PNGs, or manifest); an Open
  Graph image + `og:*`/`twitter:*` meta tags; terms & conditions / privacy policy pages; a cookie
  banner (relevant once real users sign up with email via Supabase auth — GDPR-adjacent); an
  analytics tool; a real contact address in the app/legal pages; and a pass confirming image
  assets are compressed. Alt text and mobile breakpoints weren't flagged as gaps but weren't
  verified either.
  `↳ context: index.html, public/`
- [x] **Deploy the username feature to the hosted Supabase project** (PR #119, merged 2026-09-15) —
  Supabase MCP authorized that session; steps 1-5 done and verified. Step 6 (real browser signup)
  was exercised manually and caught a real bug: signing up with an email that already had a
  confirmed account showed the same "check your email" success message as a real signup, with no
  email ever sent (Supabase's anti-enumeration `identities: []` response wasn't being checked).
  Fixed + merged separately as **PR #120** (`fix/reject-duplicate-email-signup`,
  `src/services/auth.ts`) — now throws "An account with that email already exists." Still not
  manually re-verified: a **fresh, never-used email** end-to-end (confirmation email actually
  arrives, `handle_new_user()` writes the username, sign-in works after confirming). What's below
  is the original per-step record from the deploy session.
  1. [x] Applied `supabase/migrations/20260915120000_profiles_username.sql`. Verified live:
     `username_available` is `SECURITY DEFINER`, `search_path=""`, execute granted to
     `service_role` only (anon/authenticated confirmed `false` via `has_function_privilege`);
     `profiles.username` is `NOT NULL text`; the format check constraint is live.
  2. [x] Deployed the `username-available` Edge Function with `verify_jwt: false`. Confirmed live
     end-to-end with an unauthenticated `curl` (no Authorization header) —
     `{"available":true}` / HTTP 200 — so the gateway-level exception actually took effect, not
     just the config flag.
  3. [x] Ran `get_advisors` (security + performance). No new findings from this feature (function
     search_path is correctly set, unlike the two pre-existing flagged functions
     `check_ascendant_milestones`/`check_achievements`). All findings are pre-existing and
     unrelated (leaked-password-protection, unindexed FKs on other tables, one RLS initplan
     warning on `group_runs`) — out of scope here, not fixed.
  4. [x] Regenerated types and diffed rather than overwriting. **No file change needed** —
     `src/types/database.types.ts` already had `username: string` on `profiles` and
     `username_available` in Functions, hand-written ahead of deploy, and it already matched the
     regenerated shape. Did NOT write the regenerated output over it: regeneration still reverts
     `craft_runs`/`group_runs` `Insert: never`/`Update: never` (ADR-0003 guard) back to full
     writable shapes, and separately reflects unrelated schema drift (a `p_lifetime_stats` param
     on `claim_group_stage`, a `skills` field on `recruit_character`'s return) that predates this
     PR and is out of scope for it.
  5. [x] Byte-verified: `get_edge_function` on the live deploy matches
     `supabase/functions/username-available/index.ts` + its `_shared/cors.ts` and
     `_shared/supabaseAdmin.ts` imports exactly.
  6. [x] Manually exercised in the browser. Found + fixed the already-registered-email gap (see
     above, PR #120). **Still not covered by this pass**: a fresh never-used email's full happy
     path (confirmation email arrives, `handle_new_user()` sets the username, sign-in works after
     confirming) and the same-name-different-case duplicate-username pre-check UX.
  `↳ context: supabase/migrations/20260915120000_profiles_username.sql, supabase/functions/username-available/, src/services/auth.ts`

## Done
- [x] First real character authored in Sanity: **Mordrek Graveborn** (Death Knight / tank) — base stats + per-level growth (str +8@10, hp +30@25 milestones) + a 5-node blessing tree (prereq chain + row-7 ultimate). Seeded via Sanity **CLI** (`sanity documents create`, the MCP is read-only here). Currently a **draft** — review/publish in the Studio.
- [x] Profiles table (wallet: extensible JSONB currencies/resources + transcendence count) + signup trigger + `src/lib/currencies.ts` (RLS + grants, verified) — ADR-0004/0005
- [x] Stat engine: compute-on-read baselines, stacking, blessing bonuses, reward pipeline (`src/lib/stats.ts`, 16 tests) — per-stat *combat* effects & gear bonuses deferred to the combat model / item schema
- [x] Sanity Studio + `characterDef`/blessing-tree schema (deployed)
- [x] Supabase local stack + `player_characters` / `player_inventory` / `mission_runs` / `gather_assignments` (RLS + grants, verified)
- [x] Supabase browser client + env wiring

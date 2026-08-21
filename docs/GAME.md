# The Idle Game — what it is, where it's going, where it stands

> _Working title — final name TBD._ This doc is the player/audience-facing companion to
> [`README.md`](../README.md) (dev setup) and [`docs/ARCHITECTURE.md`](./ARCHITECTURE.md) (technical
> deep-dive). For the full history of *why* things are built the way they are, see the
> [ADR log](./DECISIONS.md).

---

## 1. What the game is

A browser-based **idle / incremental RPG**, built around **character development** as the
headline pillar rather than a side track to number-go-up progress:

- **Recruit a fixed, hand-authored roster.** No procedurally-generated stats, no duplicates —
  every character is a designed individual with their own base stats, growth curve, and role.
- **Send them on real-time missions and gathering runs.** Missions resolve through a
  deterministic auto-battle simulation — every stat matters, and **missions can fail**: damage
  persists on your characters, and a wiped party comes back hurt, not safe.
- **Gear them up.** Craft and equip items across 10 slot types, scaled by rarity and level
  requirement, looted from the maps you clear.
- **Spec them through a bespoke blessing tree.** Not a shared talent-tree template — every
  character has their own 4-row, 2-choice-per-row tree (permanent picks, unlocked at levels
  10/20/30/40) capped by an *earned* capstone ability. Respec is available at a gold cost.
- **Push through world maps.** Each map is 7 stages (the 7th a boss), unlocked in sequence,
  gating the next map behind the previous boss.
- **Reset and transcend for permanent power.** A two-tier prestige system — a soft reset and a
  harder transcendence wipe — for the long-arc progression idle players expect.

The whole thing is **server-authoritative**: the client never writes its own game state. Stats
are computed on read from intent (level, gear, blessings) rather than stored as mutable values,
so there's nothing for a player to tamper with client-side.

## 2. Vision

The game started as a straightforward idle/incremental RPG. That's still the spine — low
attention, always progressing, respects a player who checks in a few times a day rather than
sits and grinds. But pure idle games have a well-known retention problem: between prestige
resets, the mid-game flattens into a line with no session-level goal, and in a genre where
word-of-mouth *is* the distribution channel, that's a real cost.

**The genre goal, decided in [ADR-0020](./DECISIONS.md#adr-0020--genre-direction-idle--roguelike-hybrid-run-based-expeditions-as-the-retention-layer),
is an idle/incremental RPG *with* a roguelike run layer** — matching where the market has already
proven demand (Capybara Go, The Tower, Legend of Mushroom, and the run-based-incremental wave on
Steam). Concretely:

- **The idle loop stays the spine.** The roguelike layer — working name "expeditions" — is an
  **opt-in session mode**, never a gate on core progression. Players chose an idle game because
  it respects their attention; that doesn't change.
- **Expeditions (design target, not yet built):** pick a party, chain N seeded encounters,
  choose 1-of-3 run-scoped boons between them (temporary buffs/relics that never persist past the
  run), for a session-shaped burst of variance layered on top of the permanent idle progression.
- **This isn't a bolt-on.** The prerequisites — a seeded, deterministic combat sim; missions that
  can fail with persistent consequences; transcendence as a macro-prestige layer with room for
  run-scoped micro-progression underneath it — were already built for other reasons. The direction
  is recorded now so future systems are shaped for it instead of being refactored into it later.

## 3. Current state

**Status: early work in progress (pre-alpha).** The core gameplay cycle is built and
hosted end-to-end; a lot of the surrounding game (gear economy depth, expeditions, transcendence
UI, art) is still ahead. Live vs. open work is tracked in [`TODO.md`](../TODO.md); what follows is
a snapshot as of **2026-07-24**.

### Built, hosted, and verified end-to-end
- **Mission → combat → claim → heal loop.** Auth, recruit, mission-start, mission-claim, and heal
  Edge Functions are deployed; the seeded auto-battle sim, gear-aware stat engine, and reward
  pipeline are live and browser-verified.
- **Gathering loop.** Continuous accrual with start/collect RPCs, live and verified.
- **World maps & stage progression.** Three maps live — Gravemarch, Embercrag, Frosthollow — 21
  missions total, 7 stages each (7th = boss), boss-gated unlock into the next map.
- **Elemental damage schools.** Strong/weak matchups against enemy resistances, surfaced in
  dispatch and mission cards.
- **Gear & items.** 23 item definitions across all 10 slot types, rarity-scaled level-requirement
  gating, atomic equip-swap RPCs.
- **Blessing trees.** The 4-row/2-choice + earned-capstone system is shipped as a real mechanism
  (`choose_blessing` RPC, live `/blessings` page), with real per-role content authored for all 19
  characters, plus a gold-cost respec flow.
- **Infirmary.** A leveled recovery building (beds × HP/s regen) that heals downed/damaged
  characters over real time, settled server-side.
- **Character roster.** 19 hand-authored characters across 5 roles (Tank, Damage, Healer,
  Utility, Gatherer), each on the point-buy budget system so no character can be authored
  over- or under-powered for its rarity.

### Open / next
- **Expeditions** (the roguelike run layer from ADR-0020) — direction is decided, not yet built.
- **Mission pacing** — all 21 missions currently carry placeholder durations pending a real
  playtest pass.
- **Caster/healer itemization** — the current item lane favors physical damage; a
  spellPower/healingPower-equivalent lane is an open gap.
- **Resource sinks & character acquisition economy** — recruit costs, upgrade costs, and general
  gold/resource sinks beyond blessing respec are still being designed.
- **History/activity log**, **transcendence flow**, and **character art** (sprites are
  currently a gap) round out the near-term list.

See [`TODO.md`](../TODO.md) for the live, itemized backlog and [`docs/DECISIONS.md`](./DECISIONS.md)
for the full ADR trail behind every decision above.

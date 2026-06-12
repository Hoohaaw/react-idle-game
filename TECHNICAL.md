# The Idle Game — Technical Documentation (LEGACY / OLD PROTOTYPE)

> ⚠️ **LEGACY — this describes the _previous_ prototype, not the current project.**
> The old game was an **Express + MongoDB + EJS** server-rendered app. The current project is a
> fundamentally different rewrite: a **React + Vite + TypeScript SPA**, with **Supabase**
> (Postgres / Auth / Edge Functions) for player runtime and **Sanity** (headless CMS) for authored
> content. **None of the code, database models, or routes described below exist in the new stack.**
>
> This file is kept **only as a reference for carried-over game _values_** — mission, gather,
> crafting, upgrade, and blessing numbers, plus character data — while we rebuild. Treat the
> architecture here as historical.
>
> 👉 For how the **current** project is built, see [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).
> For the decisions behind it (and why), see [`docs/DECISIONS.md`](docs/DECISIONS.md).

> **Original purpose (old project):** Complete technical specification for an AI agent or developer to understand, extend, or rebuild this project. Every system, model, route, and data flow is described precisely.

---

## 1. What the Project Is

A browser-based idle/incremental RPG. The player:

1. Sends characters on timed missions to earn coins and resources.
2. Sends characters to mines/gathering spots to collect raw materials.
3. Spends coins in a rotating shop to buy equipment.
4. Crafts items from resources.
5. Equips items to characters to improve their stats.
6. Buys permanent account-wide upgrades.
7. Allocates per-character talent trees (Blessings).
8. Progresses through 27 missions across 4 maps, each gated by `adventureStage`.
9. After clearing all 4 boss missions, Transcends — resetting most progress in exchange for a permanent percentage bonus.

The game runs entirely server-side (Express + MongoDB). The client polls or reacts to timers; no WebSockets. All timers are stored as `createdAt + duration` in the DB; the client reconstructs remaining time from `Date.now() - startedAt`.

---

## 2. Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js (ES modules, `"type": "module"`) |
| Web framework | Express 5.x |
| Templating | EJS + `express-ejs-layouts` 2.5.x |
| Database | MongoDB via Mongoose 8.x |
| Authentication | JWT stored in an HTTP-only cookie (`token`) |
| Password hashing | bcrypt |
| Dev server | nodemon (`npm run dev`) |
| Static assets | Served from `/public` via `express.static` |
| Scheduled jobs | `setInterval` in `app.js` (no external cron library) |

---

## 3. Directory Structure

```
the-idle-game/
├── public/
│   ├── css/
│   │   ├── design-library.css   # CSS variables, base button styles, .game-main
│   │   ├── header.css           # Fixed top navigation bar
│   │   ├── dashboard.css        # Dashboard / mission map
│   │   ├── mines.css            # Mines & gathering cards
│   │   ├── team.css             # Team page character cards
│   │   ├── character.css        # Character equipment sheet
│   │   ├── blessings.css        # Blessing talent tree
│   │   ├── statistics.css       # Statistics page
│   │   └── test-page.css        # Dev cheat page
│   ├── js/
│   │   ├── dashboard-script.js  # Mission timers, reward modal, stage unlocking
│   │   ├── mines.js             # Gather timers, stop-gathering, overlay
│   │   ├── character-script.js  # Equip/unequip modal
│   │   ├── blessings-script.js  # Talent tree UI
│   │   ├── test-page.js         # Dev cheat buttons
│   │   ├── missionDurations.js  # { missionId: seconds } lookup (client-side)
│   │   └── missionNames.js      # { missionId: displayName } lookup (client-side)
│   └── images/
│       └── team/                # Character portrait images (*.webp)
└── src/
    ├── app.js                   # Express bootstrap, middleware, scheduled shop refresh
    ├── config/
    │   └── mongoose.js          # DB connection helper
    ├── middleware/
    │   ├── auth.js              # JWT cookie verification → req.user
    │   └── flash.js             # One-shot cookie-based flash messages
    ├── controllers/
    │   └── MissionController.js # startMission, completeMission, removeMission
    ├── models/                  # All Mongoose schemas (see §5)
    ├── js/                      # Server-side game data / pure logic
    │   ├── missionData.js       # MISSIONS array + MISSION_MAP + BOSS_MISSIONS
    │   ├── characterUnlocks.js  # UNLOCKABLE_CHARACTERS + getNewAutoUnlocks()
    │   ├── blessingsData.js     # BLESSING_ROWS talent tree definition
    │   ├── craftingRecipes.js   # RECIPES array
    │   ├── upgrades.js          # UPGRADES array + upgradeCost()
    │   ├── shop.js              # shopItems() generator
    │   ├── equipment.js         # createWeapon() + createArmor() constructors
    │   └── shop-items.js        # (may exist — legacy)
    ├── routes/
    │   ├── router.js            # Root router: mounts loginRouter + gameRouter at /
    │   ├── login.js             # /login GET/POST, /register GET/POST, logout
    │   └── game.js              # All authenticated game routes (see §7)
    └── views/
        ├── layouts/
        │   ├── game-layout.ejs  # Single unified layout for all game pages
        │   └── default.ejs      # Auth pages layout
        ├── partials/
        │   ├── header.ejs       # Fixed nav bar with resource chips + coins
        │   └── flash.ejs        # Flash message display
        └── game/
            ├── dashboard.ejs    # Mission maps + active activity feed
            ├── mines.ejs        # Gathering cards (9 resources)
            ├── team.ejs         # Character roster + locked slots
            ├── character.ejs    # Per-character equipment sheet + stats
            ├── shop.ejs         # Rotating item shop
            ├── inventory.ejs    # Player's full item list
            ├── crafting.ejs     # Recipe crafting
            ├── upgrade.ejs      # Account-wide stat upgrades
            ├── blessings.ejs    # Per-character talent trees
            ├── transcendence.ejs# Prestige/reset mechanic
            ├── statistics.ejs   # Lifetime stats
            └── test-page.ejs    # Dev cheat page (remove before prod)
```

---

## 4. Authentication Flow

- **Register:** `POST /register` — hashes password with bcrypt (10 rounds via `pre('save')` hook on `RegisterModel`), creates user, issues JWT.
- **Login:** `POST /login` — calls `RegisterModel.authenticate(username, password)`, issues JWT on success.
- **JWT:** Signed with `process.env.JWT_SECRET`. Stored as cookie `token`. Payload: `{ id, username }`.
- **Guard:** `authUser` middleware reads `req.cookies.token`, verifies it, attaches `{ id, username }` to `req.user`. On failure, redirects to `/login`.
- **Logout:** Clears the `token` cookie.

All game routes require `authUser`. The `attachUserData` middleware (called on GET routes that need header data) fetches `{ coins, username }` from `RegisterModel` and all resources from `ResourceModel` into `res.locals` so they are available in the layout's header partial without being explicitly passed in every render call.

---

## 5. Database Models

### 5.1 RegisterModel (`Register` collection)

Represents a user account.

| Field | Type | Default | Notes |
|---|---|---|---|
| `username` | String | required | 3–30 chars, unique |
| `password` | String | required | Stored as bcrypt hash |
| `attack` | Number | 10 | Account-wide stat (upgraded via Upgrades) |
| `attackPercent` | Number | 0 | Account-wide stat |
| `speed` | Number | 0 | Account-wide stat |
| `crit` | Number | 10 | Account-wide stat |
| `critDamage` | Number | 0 | Account-wide stat |
| `coins` | Number | 10 | Primary currency |
| `experience` | Number | 0 | Account-level XP (unused in display currently) |
| `adventureStage` | Number | 1 | Gating counter. Increments by 1 when each mission in order is completed. Mission N requires `stageRequired === N`. |
| `bossStage` | Number | 1 | Increments when a boss mission is completed. Tracks chapter progression. Used for character auto-unlock conditions and Transcendence eligibility (`bossStage > 4`). |
| `inventory` | Array | [] | Legacy field — not used by new InventoryModel |
| `shopStock` | Array | [] | Current shop items (subdocuments). Refreshed every 8 hours by scheduled job. |
| `shopRefreshedAt` | Date | null | Timestamp of last shop refresh |
| `transcendenceCount` | Number | 0 | Number of times player has transcended |
| `transcendenceBonus` | Number | 0 | Percentage bonus earned from transcendence (`count * 10`) |

**Scheduled shop refresh:** `app.js` runs `setInterval` every 8 hours calling `RegisterModel.updateMany({}, { $set: { shopStock: shopItems(), shopRefreshedAt: new Date() } })`.

---

### 5.2 TeamMemberModel (`TeamMember` collection)

Represents a single recruited character belonging to a user.

| Field | Type | Default | Notes |
|---|---|---|---|
| `user` | ObjectId → Register | required | Owner |
| `name` | String | required | Display name |
| `class` | String | required | e.g. `'Rogue'`, `'Death Knight'` |
| `image` | String | `'Rogue.webp'` | Filename under `public/images/team/` |
| `attack` | Number | 10 | Base stat |
| `defense` | Number | 5 | Base stat |
| `health` | Number | required | Current HP |
| `maxHealth` | Number | required | Max HP |
| `speed` | Number | 5 | Base stat |
| `intelligence` | Number | 5 | Base stat |
| `agility` | Number | 5 | Base stat |
| `strength` | Number | 5 | Base stat |
| `level` | Number | required | Character level |
| `experience` | Number | required | Current XP toward next level |
| `maxExperience` | Number | required | XP needed for next level = `level * 200` |

**Level-up formula:** On mission/gather completion: `experience += xpGained`. While `experience >= maxExperience`: `experience -= maxExperience`, `level++`, `maxExperience = level * 200`, `attack += 3`, `maxHealth += 25`, `health = maxHealth`.

**XP awarded per mission:** `missionDef.stageRequired * 20`. For gather: `Math.max(1, Math.floor(gatherYield * 2))`.

---

### 5.3 MissionModel (`Mission` collection)

Represents a single active or completed activity (mission or gather).

| Field | Type | Default | Notes |
|---|---|---|---|
| `user` | ObjectId → Register | required | Owner |
| `mission_id` | String | required | e.g. `'mission-one'` or `'gather-copper'` |
| `description` | String | required | Human-readable label |
| `reward` | Number | required | Coin reward (0 for gathers) |
| `duration` | Number | required | Seconds the activity lasts |
| `isActive` | Boolean | false | True while timer is running |
| `character` | ObjectId → TeamMember | null | Assigned character (nullable) |
| `activityType` | String enum | `'mission'` | `'mission'` or `'gather'` |
| `gatherTier` | String | null | Resource key when `activityType === 'gather'` (e.g. `'copper'`) |
| `gatherYield` | Number | 0 | Amount of resource awarded on completion |
| `createdAt` | Date | auto | Used by client to reconstruct `elapsed = now - createdAt` |

**Timer reconstruction:** The client never trusts its own clock for start time. It reads `createdAt` from the server-rendered `data-started-at` attribute, computes `elapsed = Math.floor((Date.now() - startedAt) / 1000)`, and starts the countdown from `duration - elapsed`.

---

### 5.4 ResourceModel (`Resource` collection)

One document per user. Tracks all 9 gathered resources.

| Field | Type | Default |
|---|---|---|
| `user` | ObjectId → Register | unique |
| `copper` | Number | 0 |
| `silver` | Number | 0 |
| `gold` | Number | 0 |
| `platinum` | Number | 0 |
| `wood` | Number | 0 |
| `coal` | Number | 0 |
| `stone` | Number | 0 |
| `bronze` | Number | 0 |
| `iron` | Number | 0 |

All increments use `$inc` with `upsert: true`. Never goes negative (no current enforcement — would need validation).

---

### 5.5 InventoryModel (`Inventory` collection)

One document per user. Contains a subdocument array of items.

**Item subdocument fields:**

| Field | Type | Notes |
|---|---|---|
| `name` | String | Display name |
| `type` | String enum | `'weapon'` or `'armor'` — legacy field, kept for compatibility |
| `slot` | String enum | Item category: `head`, `shoulder`, `chest`, `hands`, `belt`, `legs`, `boots`, `weapon`, `trinket`, `ring` |
| `rarity` | String enum | `Common`, `Uncommon`, `Rare`, `Epic`, `Legendary` |
| `stat` | String | Legacy single-stat field (e.g. `'attack'`) |
| `statValue` | Number | Legacy single-stat value |
| `stats` | Object | New multi-stat object: `{ attack, defense, health, speed, intelligence, agility, strength }` — all default 0 |
| `price` | Number | Original purchase price |
| `equippedBy` | ObjectId → TeamMember | null when unequipped |
| `equippedSlot` | String | Specific equipped slot: `head`, `shoulder`, `chest`, `hands`, `belt`, `legs`, `boots`, `weapon`, `ring1`, `ring2`, `ring3`, `ring4`, `trinket1`, `trinket2` |
| `acquiredAt` | Date | When acquired |

**Equip logic:** `slot` (item category) maps to possible `equippedSlot` IDs:
- Single-slot items (`head`, `shoulder`, etc.): `equippedSlot === slot`
- `ring` items: can go in `ring1`, `ring2`, `ring3`, `ring4`
- `trinket` items: can go in `trinket1`, `trinket2`

**Stat bonus calculation:**
```js
const bonuses = { attack: 0, defense: 0, health: 0, speed: 0, intelligence: 0, agility: 0, strength: 0 };
items.filter(i => i.equippedBy?.equals(charId))
     .forEach(i => Object.keys(bonuses).forEach(k => { bonuses[k] += i.stats?.[k] || 0; }));
// effectiveStat = character.baseStat + bonuses.stat
```

---

### 5.6 StatisticsModel (`Statistics` collection)

One document per user. All fields increment over time, never reset (except by Transcendence which currently does not reset stats).

Fields: `timePlayed` (seconds, incremented by a `/ping` POST every 60s from client), `missionsCompleted`, `timeOnMission`, `timeInMines`, `copperEarned` through `ironEarned`, `gearFound`, `upgradesDone`, `commonItemsFound`, `uncommonItemsFound`, `rareItemsFound`, `epicItemsFound`, `legendaryItemsFound`, `ArtifactsFound`.

---

### 5.7 UpgradeModel (`Upgrade` collection)

Stores each user's upgrade levels.

| Field | Type | Notes |
|---|---|---|
| `user` | ObjectId → Register | unique |
| `levels` | Map of String → Number | `{ upgradeId: currentLevel }` |

Levels start at 0. Cost formula: `Math.floor(baseCost * Math.pow(1.8, currentLevel))`. On purchase, the stat is incremented directly on `RegisterModel` via `$inc: { [upgrade.stat]: upgrade.bonusPerLevel }`.

**Current upgrades:**

| ID | Label | Stat on RegisterModel | Bonus/Level | Base Cost |
|---|---|---|---|---|
| `attack1` | Sharpened Blades | `attack` | +5 | 50 |
| `attackPct1` | Battle Fury | `attackPercent` | +2 | 75 |
| `crit1` | Eagle Eye | `crit` | +2 | 60 |
| `critDmg1` | Savage Strike | `critDamage` | +5 | 80 |
| `speed1` | Swift Feet | `speed` | +3 | 70 |

---

### 5.8 TalentModel (`Talent` collection)

Stores per-character blessing allocations.

| Field | Type | Notes |
|---|---|---|
| `user` | ObjectId → Register | unique |
| `talentData` | Map of String → [Number] | Key = `character._id.toString()`, Value = array of 18 numbers (6 rows × 3 talents) |

Each value in the 18-length array is the number of points invested in that talent slot. The talent tree is defined in `src/js/blessingsData.js` as `BLESSING_ROWS` (6 rows of 3 blessings each). Row unlock gating: must spend 5 points in row N to unlock row N+1.

---

## 6. Game Data (Server-side Static Definitions)

### 6.1 Missions (`src/js/missionData.js`)

27 missions across 4 maps. Each has:
- `id`: slug (e.g. `'mission-one'`, `'Map-one-boss'`)
- `coins`: coin reward
- `resources`: object of `{ resourceKey: amount }` awarded on completion
- `stageRequired`: derived from array index + 1

`MISSION_MAP` is an object keyed by mission ID for O(1) lookup. `BOSS_MISSIONS` is a Set of the 4 boss mission IDs.

**Stage gating:** `adventureStage` must equal `stageRequired` exactly for the mission to count as "next" and advance the stage. A player with `adventureStage = 5` can play missions 1–5 but only mission 5's completion will increment the stage to 6.

**Map groupings:**
- Map 1: missions 1–6 + `Map-one-boss` (stages 1–7)
- Map 2: missions 7–12 + `Map-two-boss` (stages 8–14)
- Map 3: missions 13–18 + `Map-three-boss` (stages 15–21)
- Map 4: missions 19–24 + `Map-four-boss` (stages 22–28)

---

### 6.2 Gathering (`src/routes/game.js` — `GATHER_CONFIG`)

9 resource tiers with fixed duration and yield:

| Tier | Duration | Yield |
|---|---|---|
| `copper` | 30s | 5 |
| `wood` | 20s | 4 |
| `stone` | 30s | 5 |
| `coal` | 45s | 6 |
| `iron` | 60s | 8 |
| `silver` | 90s | 10 |
| `bronze` | 120s | 15 |
| `gold` | 300s | 25 |
| `platinum` | 900s | 75 |

Gathering creates a `MissionModel` with `activityType: 'gather'`. A character must be assigned. A character cannot be on more than one active activity at once (mission or gather).

---

### 6.3 Characters (`src/js/characterUnlocks.js`)

**Starting character:** Rogue (created on account registration — see login route, not explicitly in this file).

**Unlockable characters:**

| Class | Name | Unlock Condition | Cost |
|---|---|---|---|
| Death Knight | Alexandros Mograine | `bossStage >= 2` (auto) | — |
| Druid | Fandral Staghelm | `missionsCompleted >= 100` (auto) | — |
| Priest | Sally Whitemane | Purchase | 500 coins |
| Warlock | Teron Gorefiend | `bossStage >= 3` (auto) | — |

Auto-unlocks are checked inside `MissionController.completeMission` after each mission completion via `getNewAutoUnlocks(existingClasses, { bossStage, missionsCompleted })`. New characters are inserted with `TeamMemberModel.insertMany`.

---

### 6.4 Blessings / Talent Tree (`src/js/blessingsData.js`)

6 rows × 3 blessings = 18 slots per character. Each blessing has `id`, `name`, `desc`, `max` (max points), and `effect` (stat bonus per rank). Row N requires 5 points spent in row N-1 to unlock. Effects reference `attack` and `maxHealth` only in the current definition. The actual application of these bonuses to gameplay is **not yet implemented** — they are saved to `TalentModel` but not read back to modify combat or mission outcomes.

---

### 6.5 Shop & Equipment (`src/js/shop.js`, `src/js/equipment.js`)

`shopItems()` generates 2 weapons + 2 armor on each call. Items are stored in `RegisterModel.shopStock` as plain objects (not Mongoose documents). On purchase, they are pushed to `InventoryModel.items` via `$push`.

**Item generation:**
- `slot` derived from armor type name → slot enum mapping
- `stats` generated by `getStatsForSlot(slot, rarity)`: picks thematic stats from a per-slot pool, assigns values scaled by rarity config
- Rarity probabilities: Legendary 0.1%, Epic 1%, Rare 10%, Uncommon 20%, Common ~69%
- Price ranges: Common 10–25, Uncommon 25–50, Rare 50–100, Epic 150–500, Legendary 1000–2000

**Thematic stat pools per slot:**
- `weapon`: attack, strength, agility
- `head`: defense, intelligence, health
- `shoulder`: defense, strength, health
- `chest`: health, defense
- `hands`: attack, agility, strength
- `belt`: health, defense
- `legs`: speed, agility, health
- `boots`: speed, agility
- `ring`/`trinket`: all 7 stats (random)

---

### 6.6 Crafting (`src/js/craftingRecipes.js`)

6 recipes. Each has `id`, `name`, `output` (item subdocument), and `resources` array of `{ type, amount }`.

**Current recipes:** Copper Sword, Silver Dagger, Gold Helmet, Iron Axe, Bronze Boots, Platinum Shield.

**Important gap:** Crafted item outputs use the legacy `stat`/`statValue` format and do not have `slot` or `stats` (new format). Crafted items cannot currently be equipped on the character sheet.

---

### 6.7 Upgrades (`src/js/upgrades.js`)

5 account-wide upgrades (see §5.7). These modify `RegisterModel` stats, not character stats. The effect of these stats on actual mission/combat outcomes is **not yet implemented** — they are stored but not applied to any damage formula.

---

### 6.8 Transcendence

Requires `bossStage > 4` (all 4 boss missions completed). On confirm:
- `RegisterModel` reset: `coins = 10`, `adventureStage = 1`, `bossStage = 1`, `experience = 0`. `transcendenceCount += 1`. `transcendenceBonus = count * 10`.
- `ResourceModel` zeroed out.
- All active `MissionModel` documents deleted.
- Team members, inventory, upgrades, and talents are **not** reset.

The `transcendenceBonus` is stored but **not yet applied** to any game mechanic.

---

## 7. API Routes

All game routes require the `authUser` JWT middleware. Routes that render pages also call `attachUserData` (fetches coins + resources into `res.locals`).

### Page Routes (GET)

| Route | Layout | Key data passed |
|---|---|---|
| `GET /home` | game-layout | `activeMissions`, `adventureStage`, `MISSION_MAP`, `teamData` |
| `GET /mines` | game-layout | `resources`, `teamData` (with `image`), `gatheringByTier` |
| `GET /team` | game-layout | `teamMembers`, `lockedCharacters` |
| `GET /character/:id` | game-layout | `character`, `equipped` (map of slotId→item), `available` (unequipped items with slot), `bonuses`, `SLOT_LABELS` |
| `GET /shop` | game-layout | `items` (current shopStock), `nextRefresh` |
| `GET /inventory` | game-layout | `inventory`, `resources` |
| `GET /crafting` | game-layout | `recipes`, `resources` |
| `GET /upgrade` | game-layout | `upgrades` (with current levels + next cost) |
| `GET /blessings` | game-layout | `teamMembers`, `talentData`, `blessingRows` |
| `GET /transcendence` | game-layout | `eligible`, `transcendenceCount`, `transcendenceBonus`, `bossStage` |
| `GET /statistics` | game-layout | `statistics` |
| `GET /test-page` | game-layout | `coins`, `adventureStage`, `resources`, `teamMembers`, `unlockable` |

### Mission / Activity Routes (POST / DELETE)

| Route | Description |
|---|---|
| `POST /missions/start/:missionId` | Creates `MissionModel`, validates stage lock, validates character availability. Returns `{ missionDbId }`. |
| `POST /missions/complete/:missionId` | Marks mission inactive, distributes coin/resource rewards, increments `adventureStage`/`bossStage`, awards XP to character, triggers auto-unlocks. Returns full reward payload. |
| `DELETE /missions/remove/:missionId` | Hard-deletes the mission document. Called after reward is claimed or to cancel a gather. |
| `POST /gathering/start` | Body: `{ characterId, tier }`. Creates gather `MissionModel`. Returns `{ gatherDbId, duration, yield }`. |

### Shop Routes

| Route | Description |
|---|---|
| `POST /shop/buy` | Body: `{ itemIndex }`. Deducts coins, removes item from `shopStock`, pushes to `InventoryModel` with `slot` and `stats` fields. |

### Character Equipment Routes

| Route | Description |
|---|---|
| `POST /character/:id/equip` | Body: `{ itemId, equippedSlot }`. Validates item `slot` matches slot category. Auto-unequips anything currently in that slot. |
| `POST /character/:id/unequip` | Body: `{ equippedSlot }`. Clears `equippedBy` and `equippedSlot` on the item. |

### Team Routes

| Route | Description |
|---|---|
| `POST /team/recruit` | Body: `{ characterClass }`. Deducts coins, creates `TeamMemberModel` for a purchasable character. |

### Upgrade / Crafting Routes

| Route | Description |
|---|---|
| `POST /upgrade/:upgradeId` | Deducts coins, increments stat on `RegisterModel`, increments level in `UpgradeModel`. |
| `POST /crafting/craft/:recipeId` | Validates resource amounts, decrements resources, pushes crafted item to inventory. |

### Blessings / Transcendence Routes

| Route | Description |
|---|---|
| `POST /blessings/save` | Body: `{ characterId, talents }` (18-element array). Saves to `TalentModel`. |
| `POST /transcendence/confirm` | Validates eligibility, executes prestige reset. |

### Dev / Test Routes (remove before production)

| Route | Description |
|---|---|
| `GET /test-page` | Renders cheat page |
| `POST /test/coins` | `{ amount }` → `$inc coins` |
| `POST /test/resources` | `{ resource, amount }` → `$inc [resource]` |
| `POST /test/adventure-stage` | `{ stage }` → sets `adventureStage` directly |
| `POST /test/character/unlock` | `{ characterClass }` → force-creates character regardless of conditions |
| `POST /test/character/delete` | `{ characterId }` → hard-deletes character |

### Heartbeat

| Route | Description |
|---|---|
| `POST /ping` | Increments `timePlayed` by 60. Called by client `setInterval` every 60s. |

---

## 8. Frontend Architecture

### Layout System

All game pages use `src/views/layouts/game-layout.ejs`. Express-ejs-layouts with `extractStyles: true` and `extractScripts: true` hoists `<link rel="stylesheet">` tags from views into `<head>` and `<script src="...">` tags to the end of `<body>`.

**Convention:** Every game view starts with a `<link rel="stylesheet">` and ends with a `<script src="">`. Do **not** use inline `<style>` or `<script>` blocks — these conflict with the extractor.

### CSS Variables (`design-library.css`)

```css
--bg: #1e1e1e
--panel: #2a2a2a
--accent: #E6CC80        /* gold */
--text: #f0f0f0
--header-height: 56px
--spacing-sm: 8px
--spacing-md: 16px
--spacing-lg: 24px
```

Base `button` element has a crimson gradient style. Page-specific button overrides apply per-component.

### Header (`partials/header.ejs`)

Fixed at top, 56px tall. Contains:
- Navigation links (Game, Team, Mines, Blessings | Shop, Inventory, Crafting, Upgrade, Transcendence, Statistics)
- Active state via `res.locals.currentPath` set by `router.use((req,res,next) => { res.locals.currentPath = req.path; next() })`
- Resource chips: Cu, Ag, Au, Pt (ores) | Wd, Co, St, Br, Fe (materials) with live-update IDs `hdr-copper`, `hdr-silver`, etc.
- Coin balance `#coin-balance`
- Logout link

Resource values update client-side after mission/gather completion by calling `updateHeaderResources(data.resources)` in `dashboard-script.js`.

### Dashboard (`dashboard-script.js`)

- Reads `adventureStage` from `data-adventure-stage` on `#dashboard-container`.
- Hides all mission buttons where `data-stage-required > adventureStage`.
- Shows 4 map tabs; hides tabs with no visible missions.
- On mission button click: opens `#mission-modal`, user selects character, fires `fireMissionEvent`.
- `fireMissionEvent`: POSTs to `/missions/start/:missionId`, creates DOM element in `#missions` feed, starts countdown timer.
- On timer completion: element becomes clickable, click calls `showRewardModal` which POSTs to `/missions/complete/:dbId`, then DELETEs `/missions/remove/:dbId`.
- Server-rendered active missions are restored from `data-db-id`, `data-started-at`, `data-duration` attributes on pre-rendered `.mission-item` elements.
- `TEAM_DATA` is injected via `window.TEAM_DATA = <%- JSON.stringify(teamData) %>`.

### Mines (`mines.js`)

- 9 mine cards, each with `data-tier`, `data-yield`, `data-duration`.
- Idle card: button labeled "Gather" → opens character select overlay → POSTs `/gathering/start` → receives `{ gatherDbId, duration, yield }` → stores `card.dataset.gatherDbId` and `card.dataset.activeCharId` → calls `startCardTimer`.
- Active card: button labeled "Stop Gathering" → POSTs `DELETE /missions/remove/:dbId` → calls `resetCard`.
- `startCardTimer`: shows gatherer portrait + live `gathered/yield` counter (updated each second as `Math.floor(yield * elapsed / duration)`). On completion, re-wires button to "Gather".
- Page restore: `window.GATHERING_BY_TIER = <%- JSON.stringify(gatheringByTier) %>` contains active gathers keyed by tier. On load, each tier's card is restored with correct elapsed time.

### Character Sheet (`character-script.js`)

- All 14 slot cards are clickable.
- Empty slot click → modal shows available unequipped items matching slot category → click item → POSTs `/character/:id/equip` → `location.reload()`.
- Equipped slot click → modal shows item stats + "Unequip" button → POSTs `/character/:id/unequip` → `location.reload()`.
- `window.EQUIPPED` and `window.AVAILABLE` are injected as JSON from the server.

---

## 9. Complete Game Progression Flow

```
Register / Login
     │
     ▼
Dashboard (adventureStage = 1)
     │  Only "mission-one" visible
     │  Select a character → start mission (timer runs client-side)
     │  Mission completes → claim reward → coins + resources awarded
     │  adventureStage increments to 2 → "mission-two" unlocks
     │
     │  (repeat through 27 missions, 4 boss missions)
     │
     ├──► Mines (parallel)
     │        Send character to a mine → gather timer runs
     │        Claim via Dashboard activity feed
     │        Resources accumulate in ResourceModel
     │
     ├──► Shop (any time)
     │        Rotating stock of 4 items, refreshes every 8 hours
     │        Buy with coins → item added to InventoryModel with slot + stats
     │
     ├──► Inventory → Character Sheet
     │        Click item slot on character → equip item
     │        Equipped item stats added to character base stats
     │        Effective stats shown on character sheet
     │
     ├──► Crafting
     │        Consume resources → craft item → added to inventory
     │        (Note: crafted items use legacy stat format, cannot equip yet)
     │
     ├──► Upgrades
     │        Spend coins → permanently upgrade account-wide stats
     │        (Stats stored on RegisterModel, not yet applied to combat)
     │
     ├──► Blessings
     │        Allocate talent points per character
     │        6 rows × 3 talents, row gated by 5pts in previous row
     │        (Talent effects saved but not yet applied to gameplay)
     │
     └──► Transcendence (requires bossStage > 4)
              Hard reset: coins, resources, adventureStage, bossStage zeroed
              transcendenceBonus += 10% per reset (stored, not yet applied)
              Team, inventory, upgrades, talents survive
```

---

## 10. Known Gaps (Features Defined but Not Wired)

| Feature | Status |
|---|---|
| Upgrade stats affecting combat/missions | Stored in RegisterModel but no damage formula uses them |
| Blessing/talent effects applied to characters | Saved to TalentModel but not read back into stats |
| Transcendence bonus applied to rewards | Stored as `transcendenceBonus` but not multiplied anywhere |
| Crafted items equippable | Recipes produce legacy-format items without `slot`/`stats` fields |
| Character stats affecting mission outcomes | Characters have stats but missions have flat coin/resource rewards — no stat check |
| Resources decreasing (spending) | Resources only ever increase; no crafting or shop accepts resources directly for non-crafting items |
| bossStage vs adventureStage distinction | Both track progression but bossStage only increments on boss missions; currently the Transcendence gate uses bossStage > 4 |

---

## 11. Environment Variables

| Variable | Used by |
|---|---|
| `DB_CONNECTION_STRING` | `src/config/mongoose.js` — MongoDB connection URI |
| `JWT_SECRET` | `src/middleware/auth.js` — JWT signing/verification |
| `PORT` | `app.js` — `app.listen(process.env.PORT)` |

Set via `.env` file (loaded by nodemon `--env-file=.env`).

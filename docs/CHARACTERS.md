# CHARACTERS.md — the character creation guideline

How to author a new character so it is automatically comparable to the rest of the roster while
being clearly stronger and weaker at different things. The rules here are enforced in code
([`src/lib/characterBudget.ts`](../src/lib/characterBudget.ts)) and validated at authoring time in
the Sanity studio. Decision record: ADR-0031 in [`docs/DECISIONS.md`](./DECISIONS.md).

---

## The idea: a priced point budget

Every character spends a fixed budget of **points** — identity comes from *where* the points go,
never from having more of them. Two budgets per character, both set by **rarity**:

- the **base budget** — the level-1 stat spread
- the **growth budget** — spent *per level* (49 level-ups to the cap)

Stats have **prices**: +1 of a cheap stat costs less budget than +1 of a dangerous one. Prices
exist because the sim says stat points are not equal — 1 HP is worth far less than 1 Strength, and
1 Dodge nearly broke the game twice. The full table lives in `STAT_PRICE`
(`src/lib/characterBudget.ts`); summary:

| Family | Price per +1 | Notes |
|---|---|---|
| health | 0.15 | bulk pool — 1 point buys ~6–7 HP |
| primaries, attack, spellPower, healingPower, defense, resistance, armorPen | 1 | the reference unit |
| speed, haste, critDamage | 1.5 | action economy / burst — strong even after the ADR-0030 DR curve |
| block, healthRegen, healingCrit | 2 | percent procs & sustain |
| critChance | 2.5 | offense proc |
| dodge | 3 | full avoidance — and anything past ~20 total is wasted (25% cap, ADR-0029) |
| gatherSpeed, gatherYield, magicFind, luck | 0.5 | non-combat economy |

Prices are first-pass, calibrated over time by the balance harness (`docs/BALANCE.md`).

## Rarity

Rarity is the character's acquisition tier AND its budget tier. The band is deliberately tight —
a Legendary is ~25% richer in growth than a Common, meaningful but never a different game:

| Rarity | Base budget (L1) | Growth budget (per level) |
|---|---|---|
| Common | 80 | 8 |
| Uncommon | 85 | 8.5 |
| Rare | 90 | 9 |
| Epic | 95 | 9.5 |
| Legendary | 100 | 10 |

Tolerance: ±0.5 points on each budget (`BUDGET_TOLERANCE`).

## Authoring a character, step by step

1. **Pick the fantasy first.** Class, role, one sentence of identity: "drunk brawler who refuses
   to fall over." The budget turns that sentence into numbers honestly.
2. **Pick rarity** → that fixes both budgets.
3. **Spend the base budget** on the level-1 spread. Every character wants SOME health, speed, and
   a damage stat (the sim uses whichever attack routing is strongest — physical
   `attack+strength+agility` vs magic `spellPower+intelligence`).
4. **Spend the growth budget** as fractional `perLevel` values — `strength 2.5 / level` is legal
   and encouraged. Guidelines that keep characters healthy:
   - **≤ 6 growth lines.** Breadth was the original sin (pre-budget Mordrek had 9 lines and swept
     the entire tier ladder solo). Spend deep, not wide.
   - **Percent-stat growth is exceptional.** Dodge growth is nearly always wrong (cap). Block,
     crit, regen growth: small values (0.25–0.75/level), one of them, not three.
   - **Speed growth is a real choice now** (DR curve), but 1–1.5/level is plenty; 2+ is a
     speed-identity character spending a big budget share on it.
   - **Gatherers spend on gather stats** — they're cheap (0.5), so a gatherer can be genuinely
     great at gathering and honestly mediocre in a fight. That's the identity, not a bug.
5. **Milestones** are pre-paid spikes: a milestone costs `bonus × price`, amortized into the
   growth budget over the 49 level-ups. Use them for character moments ("finds his strength at
   level 10"), not as free stats.
6. **Check the budget.** The Sanity studio validates the sums against the rarity budgets as you
   type; `auditCharacter()` does the same in code.
7. **Verify in the sim.** Run the solo probe / sweep (docs/BALANCE.md). Acceptance band: a
   character's L50 solo ceiling should land within one tier of the roster median for its role
   family. Outliers = the budget prices are wrong OR the spend is degenerate — investigate before
   shipping either way.

## Worked example — Mordrek Graveborn (Epic: base 95 / growth 9.5)

Identity: unstoppable dead juggernaut. Slow, huge, keeps coming.

Growth spend: `health 10/lvl (1.5 pts, +30 milestone ≈ 0.09) · defense 2 (2) · strength 3
(3, +8 milestone ≈ 0.16) · attack 1 (1) · block 0.5 (1, +5 milestone ≈ 0.2) · healthRegen 0.25
(0.5)` → **9.45 / 9.5** ✓

What the budget REMOVED from his pre-budget draft: speed growth (a tank attacking 11× faster than
the other tank), dodge growth (dead past the cap), agility growth (why does a Death Knight grow
agility?), half his attack and regen growth. What it kept: everything that reads "juggernaut."

## Where the pieces live

- `src/lib/characterBudget.ts` — prices, budgets, `auditCharacter()` (single source of truth)
- `studio/schemaTypes/` — the `characterDef` rarity field + authoring-time validation (mirrors the
  price table; keep in sync when prices change)
- `scripts/balance/` — the sim harness that verifies the roster band after content changes
- Player-facing: rarity shows on the roster; the guide page (`/game-stats`) explains it in plain
  words

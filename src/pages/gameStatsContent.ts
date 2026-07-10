// Player-facing guide content for the Game Stats page — plain-language explanations of the
// character stats and the general workings of the game. NOT a technical document: numbers appear
// only where a player can act on them (caps, thresholds, curve feel).
//
// ⚠ KEEP IN SYNC WITH THE GAME RULES. When a stat, combat mechanic, reward formula, or gameplay
// system changes (src/lib/combat.ts, src/lib/stats.ts, docs/DECISIONS.md ADRs), update the
// affected entry here in the same change. The balance tuning loop (docs/BALANCE.md) lists this
// file as its final step.

export type GuideEntry = { name: string; icon?: string; body: string }
export type GuideSection = { title: string; intro?: string; entries?: GuideEntry[] }

export const GUIDE_SECTIONS: GuideSection[] = [
  {
    title: 'The Basics',
    intro:
      'You collect a roster of unique heroes, send them on missions, and grow them with levels, gear, ' +
      'and blessings. Missions resolve as automatic battles — your job is picking the right team and ' +
      'building it well, not clicking fast. Everything your heroes earn flows back into making the ' +
      'next fight easier: loot to equip, resources to spend, experience to level.',
  },
  {
    title: 'Roles',
    intro: 'Every hero has one role. It decides how they behave in a fight.',
    entries: [
      {
        name: 'Tank',
        icon: '🛡',
        body:
          'Draws enemy attacks onto themselves so the rest of the team stays safe. The tougher your ' +
          'tank (Defense and Health), the better they hold attention — a well-built tank soaks nearly ' +
          'every hit. A very overpowered damage dealer can still steal attention off a neglected tank.',
      },
      {
        name: 'Damage',
        icon: '⚔',
        body: 'Kills things. The faster enemies die, the less damage your team takes overall.',
      },
      {
        name: 'Healer',
        icon: '✚',
        body:
          'Fights alongside the team while everyone is healthy, and switches to healing when someone ' +
          'drops below about 70% health — then keeps healing until the team is topped up. Healers make ' +
          'long, grinding fights winnable.',
      },
      {
        name: 'Utility',
        icon: '✨',
        body:
          'A flexible all-rounder. Fights with whatever stats they have; their special support tricks ' +
          'are still being developed.',
      },
      {
        name: 'Gatherer',
        icon: '⛏',
        body:
          'Built for the Mines — gathering resources faster and in bigger yields. They can fight, but ' +
          'that is not where they shine.',
      },
    ],
  },
  {
    title: 'Attack Stats',
    intro:
      'Heroes attack with whichever is stronger: their physical power or their magic power. You do ' +
      'not have to choose — it happens automatically.',
    entries: [
      {
        name: 'Attack, Strength & Agility',
        body: 'Together these make up physical power. Every point adds to the damage of a physical hit.',
      },
      {
        name: 'Intelligence & Spell Power',
        body:
          'Together these make up magic power. Magic damage is resisted by an enemy’s Resistance ' +
          'instead of their armor — some enemies have plenty of one and none of the other.',
      },
      {
        name: 'Speed & Haste',
        body:
          'How often a hero acts. Speed 10 is the baseline (one action every 3 seconds); more speed = ' +
          'more actions. Speed above the baseline gives less and less per point — even an extremely ' +
          'fast hero tops out around 4× the baseline pace. Haste percentage stacks into the same curve.',
      },
      {
        name: 'Crit Chance & Crit Damage',
        body:
          'Chance for a hit to strike hard: a critical hit deals +50% damage, plus your Crit Damage ' +
          'percentage on top.',
      },
      {
        name: 'Armor Penetration',
        body: 'Ignores part of the enemy’s armor or resistance. Great against heavily armored targets.',
      },
    ],
  },
  {
    title: 'Defense Stats',
    entries: [
      {
        name: 'Health',
        body:
          'Your hit points. Damage taken on a mission PERSISTS — heroes do not heal between fights on ' +
          'their own. Wounded heroes recover in the Infirmary, or in the field if a Healer is along.',
      },
      {
        name: 'Defense & Resistance',
        body:
          'Defense reduces physical damage, Resistance reduces magic damage. Each point helps a little ' +
          'less than the one before it, so pure stacking has limits — but it never stops helping.',
      },
      {
        name: 'Dodge',
        body:
          'A chance to avoid a hit completely. Capped at 25% for your heroes — beyond that, extra ' +
          'dodge does nothing, so spread your defenses around.',
      },
      {
        name: 'Block',
        body: 'A chance to blunt a hit, cutting its damage in half. Not capped, but only ever halves.',
      },
      {
        name: 'Health Regen',
        body:
          'Recovers hit points steadily DURING combat (per 3 seconds of fight time). It does nothing ' +
          'outside of combat — that is what the Infirmary is for.',
      },
      {
        name: 'Healing Power & Healing Crit',
        body:
          'A Healer’s output. Healing Power (plus Intelligence) sets the size of each heal; ' +
          'Healing Crit is a chance for a heal to land double.',
      },
    ],
  },
  {
    title: 'How Combat Works',
    intro:
      'When you claim a finished mission, the fight plays out automatically: heroes and enemies act ' +
      'in speed order, tanks hold attention, healers react, and the battle runs until one side falls ' +
      '— or the combat clock (a few minutes of fight time) runs out. Running out the clock counts as ' +
      'a loss: an unkillable team still has to actually kill things. Lose, and nobody earns anything ' +
      '— and the damage taken stays. Heroes reduced to 0 HP are DOWNED and must be stabilized in the ' +
      'Infirmary before they can act again.',
  },
  {
    title: 'Rewards',
    intro: 'Winning a mission pays out its rewards, scaled up by a few bonuses that multiply together:',
    entries: [
      {
        name: 'Victory Margin',
        body:
          'The healthier your team at the end of the fight, the bigger the bonus — up to +50% for a ' +
          'flawless win. A bloody, barely-survived win pays close to the base amount.',
      },
      {
        name: 'Level Bonus',
        body: 'Your party’s average level adds a little on top — up to +20% at the level cap.',
      },
      {
        name: 'Party Bonus',
        body: 'Bigger parties earn more: +10% for each member beyond the first.',
      },
      {
        name: 'Loot',
        body:
          'Missions can also drop items. Each possible drop rolls separately, including its rarity — ' +
          'Magic Find improves how often you find items, Luck improves how much you find.',
      },
      {
        name: 'Experience',
        body:
          'Heroes level up ONLY through successful missions, and only survivors earn experience. ' +
          'The level cap is 50, and higher levels take noticeably more work.',
      },
    ],
  },
  {
    title: 'Getting Stronger',
    entries: [
      {
        name: 'Gear',
        body:
          'Equip items from your inventory on the Team page — 14 slots per hero. A rarer copy of an ' +
          'item is twice as strong per rarity step (Common → Uncommon → Rare → Epic → Legendary). ' +
          'Gear is locked while a hero is out on a mission or gathering.',
      },
      {
        name: 'Upgrading',
        body:
          'Five copies of the same item at the same rarity combine into one copy of the next rarity ' +
          'on the Upgrading page. Duplicates are never wasted.',
      },
      {
        name: 'Blessings',
        body:
          'Each hero has their own hand-crafted blessing tree — spend points earned from levels to ' +
          'deepen what makes that hero special.',
      },
      {
        name: 'The Mines',
        body:
          'Assign heroes to gather resources continuously — they keep working while you are away. ' +
          'Gather Speed makes a hero collect faster; Gather Yield makes each haul bigger.',
      },
      {
        name: 'The Infirmary',
        body:
          'A leveled building where wounded heroes recover over real time. More levels = more beds ' +
          'and faster healing. Downed heroes stabilize first, then heal.',
      },
    ],
  },
]

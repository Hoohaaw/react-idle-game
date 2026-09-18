import { describe, it, expect } from 'vitest'
import { formatEvent, type PlayerEvent } from './events'

function ev(type: PlayerEvent['type'], payload: Record<string, unknown>): PlayerEvent {
  return { id: 'x', type, payload, createdAt: '2026-09-18T00:00:00.000Z' }
}

describe('formatEvent', () => {
  it('mission_started', () => {
    expect(formatEvent(ev('mission_started', { missionName: 'Goblin Outpost' })))
      .toBe('Sent party to Goblin Outpost')
  })

  it('mission_claimed — win with full rewards', () => {
    expect(formatEvent(ev('mission_claimed', { missionName: 'Goblin Outpost', result: 'win', gold: 120, xp: 85, itemCount: 2 })))
      .toBe('Cleared Goblin Outpost — +120 gold, +85 XP, 2 items')
  })

  it('mission_claimed — party wiped', () => {
    expect(formatEvent(ev('mission_claimed', { missionName: 'Frozen Pass', result: 'party-wiped' })))
      .toBe('Frozen Pass ended in a party wipe')
  })

  it('mission_claimed — timeout', () => {
    expect(formatEvent(ev('mission_claimed', { missionName: 'Frozen Pass', result: 'timeout' })))
      .toBe('Frozen Pass ended in a timeout')
  })

  it('group_stage_started', () => {
    expect(formatEvent(ev('group_stage_started', { contentName: 'Emberdeep Vault', kind: 'dungeon', stageIndex: 3 })))
      .toBe('Started Emberdeep Vault (stage 4)')
  })

  it('group_stage_claimed — win', () => {
    expect(formatEvent(ev('group_stage_claimed', { contentName: 'Emberdeep Vault', kind: 'dungeon', stageIndex: 3, result: 'win', gold: 200, itemCount: 1 })))
      .toBe('Cleared Emberdeep Vault (stage 4) — +200 gold, 1 item')
  })

  it('group_stage_claimed — loss', () => {
    expect(formatEvent(ev('group_stage_claimed', { contentName: 'Duskmaw Reliquary', kind: 'raid', stageIndex: 0, result: 'loss' })))
      .toBe('Duskmaw Reliquary (stage 1) ended in a loss')
  })

  it('character_leveled', () => {
    expect(formatEvent(ev('character_leveled', { characterName: 'Sir Aldric', newLevel: 12 })))
      .toBe('Sir Aldric reached level 12')
  })

  it('character_recruited', () => {
    expect(formatEvent(ev('character_recruited', { characterName: 'Lyra Swift' })))
      .toBe('Recruited Lyra Swift')
  })

  it('character_downed', () => {
    expect(formatEvent(ev('character_downed', { characterName: 'Sir Aldric' })))
      .toBe('Sir Aldric was downed')
  })

  it('craft_started', () => {
    expect(formatEvent(ev('craft_started', { recipeName: 'Iron Band' })))
      .toBe('Started crafting Iron Band')
  })

  it('item_crafted', () => {
    expect(formatEvent(ev('item_crafted', { itemName: 'Iron Band', rarity: 'Uncommon' })))
      .toBe('Crafted Iron Band (Uncommon)')
  })

  it('item_upgraded — plural', () => {
    expect(formatEvent(ev('item_upgraded', { count: 3 }))).toBe('Upgraded 3 items')
  })

  it('item_upgraded — singular', () => {
    expect(formatEvent(ev('item_upgraded', { count: 1 }))).toBe('Upgraded 1 item')
  })

  it('gather_started', () => {
    expect(formatEvent(ev('gather_started', { resource: 'Copper', characterName: 'Lyra Swift' })))
      .toBe('Sent Lyra Swift to gather Copper')
  })

  it('gather_collected', () => {
    expect(formatEvent(ev('gather_collected', { resource: 'Copper', amount: 45 })))
      .toBe('Gathered 45 Copper')
  })

  it('skill_started', () => {
    expect(formatEvent(ev('skill_started', { skillName: 'Religion', characterName: 'Sir Aldric' })))
      .toBe('Sent Sir Aldric to train Religion')
  })

  it('skill_collected', () => {
    expect(formatEvent(ev('skill_collected', { skillName: 'Religion', xpGained: 120, stopped: false })))
      .toBe('Trained Religion — +120 XP')
  })

  it('blessing_chosen', () => {
    expect(formatEvent(ev('blessing_chosen', { characterName: 'Sir Aldric', choiceLabel: 'Cleave Mastery' })))
      .toBe('Sir Aldric chose a blessing: Cleave Mastery')
  })

  it('blessing_respec', () => {
    expect(formatEvent(ev('blessing_respec', { characterName: 'Sir Aldric' })))
      .toBe("Respecced Sir Aldric's blessing tree")
  })

  it('ascendant_purchased', () => {
    expect(formatEvent(ev('ascendant_purchased', { nodeLabel: 'Ascendant Haste' })))
      .toBe('Purchased Ascendant node: Ascendant Haste')
  })

  it('echo_purchased', () => {
    expect(formatEvent(ev('echo_purchased', { nodeLabel: 'Mission Speed' })))
      .toBe('Purchased Echo Shop node: Mission Speed')
  })

  it('infirmary_upgraded', () => {
    expect(formatEvent(ev('infirmary_upgraded', { newLevel: 4 })))
      .toBe('Upgraded the Infirmary to level 4')
  })

  it('infirmary_discharged — fully healed', () => {
    expect(formatEvent(ev('infirmary_discharged', { characterName: 'Sir Aldric', fullyHealed: true })))
      .toBe('Sir Aldric left the infirmary, fully healed')
  })

  it('infirmary_discharged — early', () => {
    expect(formatEvent(ev('infirmary_discharged', { characterName: 'Sir Aldric', fullyHealed: false })))
      .toBe('Sir Aldric left the infirmary early, partially healed')
  })

  it('player_reset — with award', () => {
    expect(formatEvent(ev('player_reset', { echoesAwarded: 340 })))
      .toBe('Reset — earned 340 Echoes')
  })

  it('player_reset — no payload', () => {
    expect(formatEvent(ev('player_reset', {}))).toBe('Reset')
  })

  it('player_transcended — with award', () => {
    expect(formatEvent(ev('player_transcended', { shardsAwarded: 12 })))
      .toBe('Transcended — earned 12 Ascendant Shards')
  })

  it('player_transcended — no payload', () => {
    expect(formatEvent(ev('player_transcended', {}))).toBe('Transcended')
  })

  it('falls back gracefully on a missing string field', () => {
    expect(formatEvent(ev('character_recruited', {}))).toBe('Recruited (unknown)')
  })
})

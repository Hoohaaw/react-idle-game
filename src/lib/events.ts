// The activity-log event-type registry (docs/superpowers/specs/2026-09-18-activity-log-design.md).
// Mirrors lifetimeStats.ts's registry style: one place that knows every event type, its payload
// shape, and how to render it as a single sentence. Payloads are read from a JSONB column filled in
// by 21 different Edge Functions (never by the client — ADR-0003), so every field is read
// defensively; a malformed/missing field falls back to a generic fragment rather than throwing.

export type EventType =
  | 'mission_started' | 'mission_claimed'
  | 'group_stage_started' | 'group_stage_claimed'
  | 'character_leveled' | 'character_recruited' | 'character_downed'
  | 'craft_started' | 'item_crafted' | 'item_upgraded'
  | 'gather_started' | 'gather_collected'
  | 'skill_started' | 'skill_collected'
  | 'blessing_chosen' | 'blessing_respec'
  | 'ascendant_purchased' | 'echo_purchased'
  | 'infirmary_upgraded' | 'infirmary_discharged'
  | 'player_reset' | 'player_transcended'

export type PlayerEvent = {
  id: string
  type: EventType
  payload: Record<string, unknown>
  createdAt: string
}

function str(payload: Record<string, unknown>, key: string, fallback = '(unknown)'): string {
  const v = payload[key]
  return typeof v === 'string' && v.length > 0 ? v : fallback
}

function num(payload: Record<string, unknown>, key: string): number | undefined {
  const v = payload[key]
  return typeof v === 'number' ? v : undefined
}

function bool(payload: Record<string, unknown>, key: string): boolean {
  return payload[key] === true
}

function rewardSuffix(payload: Record<string, unknown>): string {
  const parts: string[] = []
  const gold = num(payload, 'gold')
  if (gold) parts.push(`+${gold.toLocaleString()} gold`)
  const xp = num(payload, 'xp')
  if (xp) parts.push(`+${xp.toLocaleString()} XP`)
  const itemCount = num(payload, 'itemCount')
  if (itemCount) parts.push(`${itemCount} item${itemCount === 1 ? '' : 's'}`)
  return parts.length ? ` — ${parts.join(', ')}` : ''
}

const RESULT_LABEL: Record<string, string> = {
  timeout: ' ended in a timeout',
  loss: ' ended in a loss',
  'party-wiped': ' ended in a party wipe',
}

export function formatEvent(event: PlayerEvent): string {
  const p = event.payload
  switch (event.type) {
    case 'mission_started':
      return `Sent party to ${str(p, 'missionName')}`
    case 'mission_claimed': {
      const result = str(p, 'result', 'win')
      if (result === 'win') return `Cleared ${str(p, 'missionName')}${rewardSuffix(p)}`
      return `${str(p, 'missionName')}${RESULT_LABEL[result] ?? ' ended in a loss'}`
    }
    case 'group_stage_started': {
      const stageIndex = num(p, 'stageIndex') ?? 0
      return `Started ${str(p, 'contentName')} (stage ${stageIndex + 1})`
    }
    case 'group_stage_claimed': {
      const stageIndex = num(p, 'stageIndex') ?? 0
      const result = str(p, 'result', 'win')
      if (result === 'win') return `Cleared ${str(p, 'contentName')} (stage ${stageIndex + 1})${rewardSuffix(p)}`
      return `${str(p, 'contentName')} (stage ${stageIndex + 1})${RESULT_LABEL[result] ?? ' ended in a loss'}`
    }
    case 'character_leveled':
      return `${str(p, 'characterName')} reached level ${num(p, 'newLevel') ?? '?'}`
    case 'character_recruited':
      return `Recruited ${str(p, 'characterName')}`
    case 'character_downed':
      return `${str(p, 'characterName')} was downed`
    case 'craft_started':
      return `Started crafting ${str(p, 'recipeName')}`
    case 'item_crafted':
      return `Crafted ${str(p, 'itemName')} (${str(p, 'rarity', 'Common')})`
    case 'item_upgraded': {
      const count = num(p, 'count') ?? 0
      return `Upgraded ${count} item${count === 1 ? '' : 's'}`
    }
    case 'gather_started':
      return `Sent ${str(p, 'characterName')} to gather ${str(p, 'resource')}`
    case 'gather_collected':
      return `Gathered ${num(p, 'amount') ?? 0} ${str(p, 'resource')}`
    case 'skill_started':
      return `Sent ${str(p, 'characterName')} to train ${str(p, 'skillName')}`
    case 'skill_collected':
      return `Trained ${str(p, 'skillName')} — +${num(p, 'xpGained') ?? 0} XP`
    case 'blessing_chosen':
      return `${str(p, 'characterName')} chose a blessing: ${str(p, 'choiceLabel')}`
    case 'blessing_respec':
      return `Respecced ${str(p, 'characterName')}'s blessing tree`
    case 'ascendant_purchased':
      return `Purchased Ascendant node: ${str(p, 'nodeLabel')}`
    case 'echo_purchased':
      return `Purchased Echo Shop node: ${str(p, 'nodeLabel')}`
    case 'infirmary_upgraded':
      return `Upgraded the Infirmary to level ${num(p, 'newLevel') ?? '?'}`
    case 'infirmary_discharged':
      return bool(p, 'fullyHealed')
        ? `${str(p, 'characterName')} left the infirmary, fully healed`
        : `${str(p, 'characterName')} left the infirmary early, partially healed`
    case 'player_reset': {
      const echoes = num(p, 'echoesAwarded')
      return echoes ? `Reset — earned ${echoes.toLocaleString()} Echoes` : 'Reset'
    }
    case 'player_transcended': {
      const shards = num(p, 'shardsAwarded')
      return shards ? `Transcended — earned ${shards.toLocaleString()} Ascendant Shards` : 'Transcended'
    }
    default:
      return 'Something happened'
  }
}

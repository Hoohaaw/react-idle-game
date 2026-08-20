import { IconSlot } from '@/components/atoms/IconSlot'
import type { MissionMapView } from '@/services/missions'
import { isMapUnlocked, BOSS_STAGE } from '../mapProgress'

// The world-map toggle above the mission list (ADR-0034): one button per map in world
// order, showing cleared/7 progress. Locked maps (previous boss not beaten) are dimmed
// and unselectable with a hint naming what unlocks them.
export function MapSelector({ maps, progress, selected, onSelect }: {
  maps: MissionMapView[]
  progress: Record<string, number>
  selected: string | null
  onSelect: (mapKey: string) => void
}) {
  if (maps.length === 0) return null
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 18 }}>
      {maps.map((map, i) => {
        const unlocked = isMapUnlocked(maps, progress, map.mapKey)
        const cleared = Math.min(progress[map.mapKey] ?? 0, BOSS_STAGE)
        const active = map.mapKey === selected
        return (
          <button
            key={map.mapKey}
            type="button"
            disabled={!unlocked}
            onClick={() => onSelect(map.mapKey)}
            title={unlocked ? map.name : `Defeat the ${maps[i - 1]?.name ?? 'previous'} boss to unlock`}
            style={{
              display: 'flex', alignItems: 'center', gap: 9,
              padding: '9px 14px', borderRadius: 6, fontFamily: 'Georgia, serif',
              cursor: unlocked ? 'pointer' : 'not-allowed',
              border: `2px solid ${active ? 'var(--color-gold-mid)' : 'var(--color-gold-dark)'}`,
              background: active
                ? 'linear-gradient(180deg, #34161a 0%, #1e0a0c 100%)'
                : 'linear-gradient(180deg, #1a0a0c 0%, #100305 100%)',
              opacity: unlocked ? 1 : 0.45,
              boxShadow: active
                ? '0 0 0 1px #080101, 0 0 12px rgba(200,140,30,0.35), inset 0 1px 0 rgba(255,255,255,0.07)'
                : '0 0 0 1px #080101, inset 0 1px 0 rgba(255,255,255,0.05)',
              transition: 'border-color 0.15s, box-shadow 0.15s',
            }}
          >
            <IconSlot size={18} />
            <span style={{ textAlign: 'left' }}>
              <span style={{
                display: 'block', color: active ? 'var(--color-gold-light)' : 'var(--color-text-primary)',
                fontSize: 12, fontWeight: 'bold', letterSpacing: '0.5px', whiteSpace: 'nowrap',
              }}>{map.name}</span>
              <span style={{ display: 'block', color: 'var(--color-text-muted)', fontSize: 10, letterSpacing: '1px' }}>
                {unlocked ? `${cleared}/${BOSS_STAGE} cleared` : 'Locked'}
              </span>
            </span>
          </button>
        )
      })}
    </div>
  )
}

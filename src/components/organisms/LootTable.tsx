import { IconSlot } from '../atoms/IconSlot'
import { RarityChancePill } from '../molecules/RarityChancePill'
import type { MissionDrops } from '../../types/loot'

export function LootTable({ data }: { data: MissionDrops }) {
  return (
    <div style={{
      width: '340px',
      borderRadius: '8px',
      border: '3px solid var(--color-gold-mid)',
      background: 'linear-gradient(180deg, #1e0a0c 0%, #130406 100%)',
      boxShadow: [
        '0 0 0 1px #080101',
        'inset 0 1px 0 rgba(255,255,255,0.06)',
        'inset 0 2px 8px rgba(0,0,0,0.6)',
        '0 6px 20px rgba(0,0,0,0.8)',
      ].join(', '),
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '8px',
        padding: '10px 14px',
        borderBottom: '2px solid var(--color-gold-dark)',
        background: 'linear-gradient(180deg, rgba(200,145,42,0.15) 0%, rgba(200,145,42,0.04) 100%)',
      }}>
        <div>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '9px', letterSpacing: '2px', textTransform: 'uppercase' }}>Loot Table</p>
          <p style={{ color: 'var(--color-gold-light)', fontSize: '14px', fontWeight: 'bold', letterSpacing: '0.5px', textShadow: '0 0 10px rgba(240,208,96,0.4)' }}>{data.mission}</p>
        </div>
        <span style={{
          color: data.boss ? '#e08080' : 'var(--color-text-gold)',
          fontSize: '10px',
          letterSpacing: '1px',
          textTransform: 'uppercase',
          whiteSpace: 'nowrap',
          border: `1px solid ${data.boss ? '#6b1010' : 'var(--color-gold-dark)'}`,
          borderRadius: '3px',
          padding: '3px 7px',
        }}>{data.boss ? 'Boss' : `Stage ${data.stage}`}</span>
      </div>

      {/* Item rows — image on the left, details to the right */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px' }}>
        {data.pool.map(item => (
          <div key={item.name} className="atom-heavy" style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '10px 11px',
            borderRadius: '4px',
            border: '2px solid var(--color-gold-dark)',
            background: 'linear-gradient(180deg, #1a0a0c 0%, #100305 100%)',
          }}>
            <IconSlot size={48} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '8px' }}>
                <span style={{ color: 'var(--color-text-primary)', fontSize: '13px', flex: 1 }}>{item.name}</span>
                <span style={{ color: 'var(--color-text-muted)', fontSize: '9px', letterSpacing: '1px', textTransform: 'uppercase' }}>{item.slot}</span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                {item.chances.map(c => <RarityChancePill key={c.rarity} rarity={c.rarity} chance={c.chance} />)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

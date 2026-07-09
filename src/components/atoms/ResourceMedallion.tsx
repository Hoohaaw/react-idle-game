import { IconSlot } from './IconSlot'
import { RESOURCE_COLOR } from '../../lib/resources'

// A small carved medallion carrying a resource's identity: accent-ringed circular slot
// (icon art drops into the IconSlot later). Used by the mine/gather cards so each
// resource reads as a distinct "coin" rather than a text label.
export function ResourceMedallion({ resource, size = 34 }: { resource: string; size?: number }) {
  const c = RESOURCE_COLOR[resource] ?? '200,145,42'
  return (
    <div style={{
      width: size,
      height: size,
      flexShrink: 0,
      borderRadius: '50%',
      border: `2px solid rgba(${c},0.85)`,
      background: 'radial-gradient(circle at 35% 30%, #2a1210 0%, #120405 75%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      boxShadow: [
        '0 0 0 1px #080101',
        'inset 0 2px 4px rgba(0,0,0,0.7)',
        `0 0 10px rgba(${c},0.35)`,
      ].join(', '),
    }}>
      <IconSlot size={Math.round(size * 0.52)} />
    </div>
  )
}

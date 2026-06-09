import { IconSlot } from './IconSlot'

export function ResourceChip({ label, value }: { label: string; value: number }) {
  return (
    <div className="atom-heavy" style={{
      display: 'flex',
      alignItems: 'center',
      gap: '7px',
      padding: '5px 12px',
      borderRadius: '4px',
      border: '2px solid var(--color-gold-dark)',
      background: 'linear-gradient(180deg, #1e0a0c 0%, #130406 100%)',
    }}>
      <IconSlot />
      <span style={{
        color: 'var(--color-gold-mid)',
        fontSize: '11px',
        fontWeight: 'bold',
        letterSpacing: '1px',
        textTransform: 'uppercase',
        textShadow: '0 1px 2px rgba(0,0,0,0.8)',
      }}>{label}</span>
      <span style={{
        color: 'var(--color-text-primary)',
        fontSize: '13px',
        textShadow: '0 1px 2px rgba(0,0,0,0.8)',
      }}>{value}</span>
    </div>
  )
}

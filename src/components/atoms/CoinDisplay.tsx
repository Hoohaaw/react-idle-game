import { IconSlot } from './IconSlot'

export function CoinDisplay({ amount }: { amount: number }) {
  return (
    <div className="atom-heavy" style={{
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '6px 14px',
      borderRadius: '4px',
      border: '2px solid var(--color-gold-mid)',
      background: 'linear-gradient(180deg, #2a1a08 0%, #120a02 100%)',
      boxShadow: [
        '0 0 0 1px #080101',
        'inset 0 1px 0 rgba(255,255,255,0.07)',
        'inset 0 2px 6px rgba(0,0,0,0.55)',
        '0 0 12px rgba(200,140,30,0.2)',
        '0 3px 8px rgba(0,0,0,0.65)',
      ].join(', '),
    }}>
      <IconSlot size={18} />
      <span style={{
        color: 'var(--color-text-gold)',
        fontSize: '15px',
        fontWeight: 'bold',
        textShadow: '0 0 8px rgba(232,192,80,0.4), 0 1px 2px rgba(0,0,0,0.9)',
      }}>{amount.toLocaleString()}</span>
    </div>
  )
}

// Shows a character's gather bonus for the resource they're on (gather speed / yield).
// This is the UI surface for the future character gather-specialization system.
export function BonusTag({ label }: { label: string }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 7px', borderRadius: 3,
      border: '1px solid #2d6b45',
      background: 'linear-gradient(180deg, rgba(76,175,110,0.20) 0%, rgba(76,175,110,0.05) 100%)',
      color: '#8ee59c', fontSize: 9, letterSpacing: '0.5px', textTransform: 'uppercase', whiteSpace: 'nowrap',
      boxShadow: '0 0 6px rgba(76,175,110,0.2)',
    }}>⚡ {label}</span>
  )
}

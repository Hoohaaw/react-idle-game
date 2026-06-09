export function CountBadge({ count }: { count: number }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      minWidth: 26, height: 24, padding: '2px 10px', borderRadius: 13,
      background: 'linear-gradient(180deg, #b32020, #6b1010)', border: '2px solid #e08080',
      color: '#fff', fontSize: 12, fontWeight: 'bold', fontFamily: 'Georgia, serif',
      boxShadow: '0 0 0 1px #080101, 0 0 8px rgba(180,30,30,0.5)',
    }}>{count}</span>
  )
}

export function NotificationDot() {
  return <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: 'radial-gradient(circle at 40% 35%, #ff6a6a, #8c2020)', boxShadow: '0 0 8px rgba(180,30,30,0.7), 0 0 0 1px #080101' }} />
}

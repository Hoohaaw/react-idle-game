import { useActivity } from './hooks'
import { formatEvent } from '@/lib/events'

export default function ActivityPage() {
  const { data: events, isLoading } = useActivity()

  if (isLoading || !events) {
    return <p style={{ color: 'var(--color-text-muted)' }}>Loading…</p>
  }

  return (
    <div>
      <h2 style={{ color: 'var(--color-text-primary)', marginBottom: 16 }}>Activity</h2>
      {events.length === 0 ? (
        <p style={{ color: 'var(--color-text-muted)' }}>No activity yet — go play!</p>
      ) : (
        <div style={{
          borderRadius: 8,
          border: '1px solid var(--color-gold-dark)',
          background: 'linear-gradient(180deg, var(--color-bg-raised) 0%, var(--color-bg-panel) 100%)',
          overflow: 'hidden',
        }}>
          {events.map((event, i) => (
            <div
              key={event.id}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: 16,
                padding: '10px 16px',
                borderTop: i === 0 ? 'none' : '1px solid var(--color-bg-base)',
              }}
            >
              <span style={{ color: 'var(--color-text-primary)', fontSize: 13 }}>{formatEvent(event)}</span>
              <span style={{ color: 'var(--color-text-muted)', fontSize: 11, whiteSpace: 'nowrap' }}>
                {new Date(event.createdAt).toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

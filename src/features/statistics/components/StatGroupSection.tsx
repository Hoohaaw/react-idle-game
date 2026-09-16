// src/features/statistics/components/StatGroupSection.tsx
export function StatGroupSection({ title, rows }: {
  title: string
  rows: { key: string; label: string; value: string }[]
}) {
  if (rows.length === 0) return null

  return (
    <section style={{ marginBottom: 24 }}>
      <h3 style={{ color: 'var(--color-text-primary)', fontSize: 15, marginBottom: 8 }}>{title}</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {rows.map((r) => (
          <div
            key={r.key}
            className="atom-heavy"
            style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '8px 12px', borderRadius: 6 }}
          >
            <span style={{ color: 'var(--color-text-primary)' }}>{r.label}</span>
            <span style={{ color: 'var(--color-text-muted)' }}>{r.value}</span>
          </div>
        ))}
      </div>
    </section>
  )
}

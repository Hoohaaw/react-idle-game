export function ProgressBar({ value, label, color = '#8c2020' }: { value: number; label: string; color?: string }) {
  return (
    <div>
      <p style={{ color: 'var(--color-text-muted)', fontSize: '12px', marginBottom: '6px', letterSpacing: '0.5px' }}>{label}</p>
      <div className="progress-track">
        <div
          className="progress-fill"
          style={{
            width: `${value}%`,
            background: `linear-gradient(180deg, color-mix(in srgb, ${color} 70%, #f0d060) 0%, ${color} 60%, color-mix(in srgb, ${color} 80%, #000) 100%)`,
            boxShadow: `0 0 8px ${color}88`,
          }}
        />
      </div>
    </div>
  )
}

export default function DesignPage() {
  return (
    <div style={{ backgroundColor: 'var(--color-bg-deep)', minHeight: '100svh', padding: '40px 24px', fontFamily: 'Georgia, serif' }}>
      <h1 style={{ color: 'var(--color-gold-light)', fontSize: '28px', marginBottom: '8px', letterSpacing: '2px', textTransform: 'uppercase' }}>
        Design System
      </h1>
      <p style={{ color: 'var(--color-text-muted)', marginBottom: '48px' }}>Visual language reference — iterate here before building pages</p>

      {/* ── BUTTONS ───────────────────────────── */}
      <Section title="Buttons">
        <Row>
          <PrimaryButton>Start Mission</PrimaryButton>
          <PrimaryButton disabled>Locked</PrimaryButton>
          <SecondaryButton>Cancel</SecondaryButton>
          <DangerButton>Transcend</DangerButton>
          <GhostButton>View Details</GhostButton>
        </Row>
      </Section>

      {/* ── PANELS ────────────────────────────── */}
      <Section title="Panels">
        <Row>
          <Panel title="Mission Card">
            <p style={{ color: 'var(--color-text-muted)', fontSize: '14px' }}>Goblin Camp — Stage 3</p>
            <p style={{ color: 'var(--color-text-primary)', fontSize: '14px', marginTop: '8px' }}>Reward: 120 coins · 3:00</p>
          </Panel>
          <Panel title="Character">
            <p style={{ color: 'var(--color-text-muted)', fontSize: '14px' }}>Rogue · Level 7</p>
            <p style={{ color: 'var(--color-text-gold)', fontSize: '13px', marginTop: '8px' }}>ATK 45 · AGI 38</p>
          </Panel>
        </Row>
      </Section>

      {/* ── RESOURCE CHIPS ────────────────────── */}
      <Section title="Resource Chips">
        <Row>
          <ResourceChip label="Cu" value={142} />
          <ResourceChip label="Ag" value={28} />
          <ResourceChip label="Au" value={5} />
          <ResourceChip label="Pt" value={0} />
          <ResourceChip label="Wd" value={300} />
        </Row>
      </Section>

      {/* ── TYPOGRAPHY ────────────────────────── */}
      <Section title="Typography">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <p style={{ color: 'var(--color-gold-light)', fontSize: '24px', letterSpacing: '1px' }}>Heading — Gold Light</p>
          <p style={{ color: 'var(--color-text-primary)', fontSize: '16px' }}>Body text — Primary parchment tone</p>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '14px' }}>Muted text — Labels, descriptions</p>
          <p style={{ color: 'var(--color-text-gold)', fontSize: '14px' }}>Gold text — Rewards, coin values</p>
          <p style={{ color: 'var(--color-success)', fontSize: '14px' }}>Success — Level up, unlock</p>
          <p style={{ color: 'var(--color-danger)', fontSize: '14px' }}>Danger — Warnings, destructive actions</p>
        </div>
      </Section>

      {/* ── PROGRESS BAR ──────────────────────── */}
      <Section title="Progress / Timer Bar">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '400px' }}>
          <ProgressBar value={75} label="Mission timer" />
          <ProgressBar value={40} label="XP to level 8" color="var(--color-gold-mid)" />
          <ProgressBar value={10} label="Gather: copper" />
        </div>
      </Section>

      {/* ── INPUT FIELDS ─────────────────────── */}
      <Section title="Input Fields">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxWidth: '320px' }}>
          <input className="input-fantasy" type="text" placeholder="Character name…" />
          <input className="input-fantasy" type="number" placeholder="Amount" />
          <input className="input-fantasy" type="text" defaultValue="Alexandros Mograine" />
          <input className="input-fantasy" type="text" placeholder="Disabled" disabled />
        </div>
      </Section>

      {/* ── RADIO BUTTONS ────────────────────── */}
      <Section title="Radio Buttons">
        <div className="radio-group">
          <label className="radio-label">
            <input type="radio" name="demo" defaultChecked /> Start Mission
          </label>
          <label className="radio-label">
            <input type="radio" name="demo" /> Send to Gather
          </label>
          <label className="radio-label">
            <input type="radio" name="demo" /> Stay at Camp
          </label>
        </div>
      </Section>

      {/* ── RARITY BADGES ────────────────────── */}
      <Section title="Rarity Badges">
        <Row>
          <RarityBadge rarity="Common" />
          <RarityBadge rarity="Uncommon" />
          <RarityBadge rarity="Rare" />
          <RarityBadge rarity="Epic" />
          <RarityBadge rarity="Legendary" />
        </Row>
      </Section>

      {/* ── STAT ATOMS ───────────────────────── */}
      <Section title="Stat Atoms">
        <Row>
          <StatPill label="ATK" value={45} />
          <StatPill label="DEF" value={22} />
          <StatPill label="AGI" value={38} />
          <StatPill label="INT" value={15} />
          <StatPill label="STR" value={30} />
          <StatPill label="SPD" value={18} />
          <StatPill label="HP" value={340} />
        </Row>
      </Section>

      {/* ── LEVEL & COIN ATOMS ───────────────── */}
      <Section title="Level & Currency Atoms">
        <Row>
          <LevelBadge level={7} />
          <LevelBadge level={24} />
          <CoinDisplay amount={1420} />
          <CoinDisplay amount={50} />
        </Row>
      </Section>

      {/* ── DIVIDERS ─────────────────────────── */}
      <Section title="Dividers">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '480px' }}>
          <GoldDivider />
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <GoldDivider />
            <span style={{ color: 'var(--color-text-muted)', fontSize: '11px', letterSpacing: '2px', whiteSpace: 'nowrap', textTransform: 'uppercase' }}>Chapter I</span>
            <GoldDivider />
          </div>
        </div>
      </Section>

      {/* ── COLOR SWATCHES ────────────────────── */}
      <Section title="Color Palette">
        <Row>
          {[
            { name: 'bg-deep', value: 'var(--color-bg-deep)' },
            { name: 'bg-base', value: 'var(--color-bg-base)' },
            { name: 'bg-panel', value: 'var(--color-bg-panel)' },
            { name: 'bg-raised', value: 'var(--color-bg-raised)' },
            { name: 'gold-light', value: 'var(--color-gold-light)' },
            { name: 'gold-mid', value: 'var(--color-gold-mid)' },
            { name: 'gold-dark', value: 'var(--color-gold-dark)' },
          ].map(s => (
            <div key={s.name} style={{ textAlign: 'center' }}>
              <div style={{ width: '64px', height: '64px', backgroundColor: s.value, border: '1px solid var(--color-gold-dark)', borderRadius: '4px' }} />
              <p style={{ color: 'var(--color-text-muted)', fontSize: '11px', marginTop: '4px' }}>{s.name}</p>
            </div>
          ))}
        </Row>
      </Section>
    </div>
  )
}

/* ── Layout helpers ──────────────────────── */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '48px' }}>
      <h2 style={{
        color: 'var(--color-gold-mid)',
        fontSize: '11px',
        letterSpacing: '3px',
        textTransform: 'uppercase',
        marginBottom: '16px',
        borderBottom: '1px solid var(--color-gold-dark)',
        paddingBottom: '6px',
      }}>
        {title}
      </h2>
      {children}
    </div>
  )
}

function Row({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'flex-start' }}>{children}</div>
}

/* ── Atoms ───────────────────────────────── */

function PrimaryButton({ children, disabled }: { children: React.ReactNode; disabled?: boolean }) {
  return (
    <button
      disabled={disabled}
      className="btn btn-primary"
      style={{
        position: 'relative',
        padding: '10px 24px',
        fontFamily: 'Georgia, serif',
        fontSize: '14px',
        letterSpacing: '1px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.45 : 1,
        borderRadius: '5px',
        /* Layer 1: outer dark grounding edge + glow */
        /* Layer 2: main gold border (3px) */
        /* Layer 3: inner light gold highlight edge */
        border: disabled ? '3px solid var(--color-gold-dark)' : '3px solid var(--color-gold-mid)',
        boxShadow: disabled ? 'none' : [
          '0 0 0 1px #3a2008',                          /* outer dark edge */
          'inset 0 0 0 1px rgba(240,208,96,0.25)',       /* inner light edge */
          '0 0 14px rgba(200,140,30,0.4)',               /* outer glow */
          '0 2px 6px rgba(0,0,0,0.7)',                   /* drop shadow */
        ].join(', '),
        background: disabled
          ? 'var(--color-bg-raised)'
          : 'linear-gradient(180deg, #4a1010 0%, #2d0808 50%, #1e0505 100%)',
        color: disabled ? 'var(--color-text-muted)' : 'var(--color-text-primary)',
      }}
    >
      <span style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: '40%',
        background: 'linear-gradient(180deg, rgba(255,255,255,0.07) 0%, transparent 100%)',
        borderRadius: '5px 5px 0 0',
        pointerEvents: 'none',
      }} />
      {children}
    </button>
  )
}

function SecondaryButton({ children }: { children: React.ReactNode }) {
  return (
    <button className="btn btn-secondary" style={{
      padding: '10px 24px',
      fontFamily: 'Georgia, serif',
      fontSize: '14px',
      letterSpacing: '1px',
      cursor: 'pointer',
      borderRadius: '5px',
      border: '2px solid var(--color-gold-dark)',
      background: 'linear-gradient(180deg, #2a1a08 0%, #180e04 100%)',
      color: 'var(--color-text-gold)',
      boxShadow: '0 0 0 1px #1a0c02, 0 2px 4px rgba(0,0,0,0.5)',
    }}>
      {children}
    </button>
  )
}

function DangerButton({ children }: { children: React.ReactNode }) {
  return (
    <button className="btn btn-danger" style={{
      padding: '10px 24px',
      fontFamily: 'Georgia, serif',
      fontSize: '14px',
      letterSpacing: '1px',
      cursor: 'pointer',
      borderRadius: '5px',
      border: '2px solid #6b1010',
      background: 'linear-gradient(180deg, #3d0a0a 0%, #200505 100%)',
      color: '#e08080',
      boxShadow: '0 0 10px rgba(140,20,20,0.3), 0 2px 4px rgba(0,0,0,0.6)',
    }}>
      {children}
    </button>
  )
}

function GhostButton({ children }: { children: React.ReactNode }) {
  return (
    <button className="btn btn-ghost" style={{
      padding: '10px 24px',
      fontFamily: 'Georgia, serif',
      fontSize: '14px',
      letterSpacing: '1px',
      cursor: 'pointer',
      borderRadius: '5px',
      border: '1px solid rgba(200,145,42,0.3)',
      background: 'transparent',
      color: 'var(--color-text-muted)',
    }}>
      {children}
    </button>
  )
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{
      width: '220px',
      borderRadius: '8px',
      /* Gold gradient border via box-shadow layering */
      border: '1px solid var(--color-gold-dark)',
      boxShadow: '0 0 0 1px rgba(240,208,96,0.15), inset 0 1px 0 rgba(240,208,96,0.08), 0 4px 16px rgba(0,0,0,0.7)',
      background: 'linear-gradient(180deg, var(--color-bg-raised) 0%, var(--color-bg-panel) 100%)',
      overflow: 'hidden',
    }}>
      {/* Panel header bar */}
      <div style={{
        padding: '8px 14px',
        borderBottom: '1px solid var(--color-gold-dark)',
        background: 'linear-gradient(180deg, rgba(200,145,42,0.15) 0%, rgba(200,145,42,0.05) 100%)',
      }}>
        <p style={{ color: 'var(--color-gold-light)', fontSize: '12px', letterSpacing: '1px', textTransform: 'uppercase' }}>{title}</p>
      </div>
      <div style={{ padding: '14px' }}>
        {children}
      </div>
    </div>
  )
}

function ResourceChip({ label, value }: { label: string; value: number }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      padding: '4px 10px',
      borderRadius: '4px',
      border: '1px solid var(--color-gold-dark)',
      background: 'linear-gradient(180deg, var(--color-bg-raised) 0%, var(--color-bg-panel) 100%)',
      boxShadow: '0 1px 4px rgba(0,0,0,0.5)',
    }}>
      <span style={{ color: 'var(--color-gold-mid)', fontSize: '11px', fontWeight: 'bold', letterSpacing: '0.5px' }}>{label}</span>
      <span style={{ color: 'var(--color-text-primary)', fontSize: '13px' }}>{value}</span>
    </div>
  )
}

function ProgressBar({ value, label, color = 'var(--color-danger)' }: { value: number; label: string; color?: string }) {
  return (
    <div>
      <p style={{ color: 'var(--color-text-muted)', fontSize: '12px', marginBottom: '5px' }}>{label}</p>
      <div style={{
        height: '10px',
        borderRadius: '5px',
        background: 'var(--color-bg-raised)',
        border: '1px solid var(--color-gold-dark)',
        overflow: 'hidden',
      }}>
        <div style={{
          height: '100%',
          width: `${value}%`,
          background: `linear-gradient(90deg, ${color} 0%, color-mix(in srgb, ${color} 70%, #f0d060) 100%)`,
          boxShadow: `0 0 6px ${color}`,
          transition: 'width 0.3s ease',
        }} />
      </div>
    </div>
  )
}

const RARITY_STYLES: Record<string, { color: string; border: string; glow: string }> = {
  Common:    { color: '#a0a0a0', border: '#555',    glow: 'transparent' },
  Uncommon:  { color: '#4caf6e', border: '#2d6b45', glow: 'rgba(76,175,110,0.3)' },
  Rare:      { color: '#5b9bd5', border: '#2a5a8a', glow: 'rgba(91,155,213,0.35)' },
  Epic:      { color: '#b06fd4', border: '#6a3580', glow: 'rgba(176,111,212,0.4)' },
  Legendary: { color: '#f0a030', border: '#8a5010', glow: 'rgba(240,160,48,0.5)' },
}

function RarityBadge({ rarity }: { rarity: string }) {
  const s = RARITY_STYLES[rarity] ?? RARITY_STYLES.Common
  return (
    <span style={{
      padding: '3px 10px',
      borderRadius: '3px',
      fontSize: '11px',
      letterSpacing: '1.5px',
      textTransform: 'uppercase',
      fontFamily: 'Georgia, serif',
      color: s.color,
      border: `1px solid ${s.border}`,
      background: 'var(--color-bg-panel)',
      boxShadow: `0 0 8px ${s.glow}`,
    }}>
      {rarity}
    </span>
  )
}

function StatPill({ label, value }: { label: string; value: number }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '5px',
      padding: '4px 10px',
      borderRadius: '4px',
      border: '1px solid var(--color-gold-dark)',
      background: 'linear-gradient(180deg, var(--color-bg-raised) 0%, var(--color-bg-panel) 100%)',
      boxShadow: '0 0 0 1px #1a0c02',
    }}>
      <span style={{ color: 'var(--color-text-muted)', fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase' }}>{label}</span>
      <span style={{ color: 'var(--color-text-gold)', fontSize: '13px', fontWeight: 'bold' }}>{value}</span>
    </div>
  )
}

function LevelBadge({ level }: { level: number }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '4px',
      padding: '4px 10px',
      borderRadius: '4px',
      border: '2px solid var(--color-gold-dark)',
      background: 'linear-gradient(180deg, #2a1a08 0%, #180e04 100%)',
      boxShadow: '0 0 0 1px #1a0c02',
    }}>
      <span style={{ color: 'var(--color-text-muted)', fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase' }}>Lv</span>
      <span style={{ color: 'var(--color-gold-light)', fontSize: '14px', fontWeight: 'bold' }}>{level}</span>
    </div>
  )
}

function CoinDisplay({ amount }: { amount: number }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      padding: '4px 12px',
      borderRadius: '4px',
      border: '2px solid var(--color-gold-dark)',
      background: 'linear-gradient(180deg, #2a1a08 0%, #180e04 100%)',
      boxShadow: '0 0 0 1px #1a0c02, 0 0 8px rgba(200,140,30,0.15)',
    }}>
      <span style={{ fontSize: '14px' }}>🪙</span>
      <span style={{ color: 'var(--color-text-gold)', fontSize: '14px', fontWeight: 'bold' }}>{amount.toLocaleString()}</span>
    </div>
  )
}

function GoldDivider() {
  return (
    <div style={{
      flex: 1,
      height: '1px',
      background: 'linear-gradient(90deg, transparent 0%, var(--color-gold-dark) 30%, var(--color-gold-mid) 50%, var(--color-gold-dark) 70%, transparent 100%)',
    }} />
  )
}

import { useState } from 'react'

export default function DesignPage() {
  return (
    <div style={{ backgroundColor: 'var(--color-bg-deep)', minHeight: '100svh', padding: '40px 24px', fontFamily: 'Georgia, serif' }}>
      <h1 style={{ color: 'var(--color-gold-light)', fontSize: '28px', marginBottom: '8px', letterSpacing: '2px', textTransform: 'uppercase' }}>
        Design System
      </h1>
      <p style={{ color: 'var(--color-text-muted)', marginBottom: '48px' }}>Visual language reference — iterate here before building pages</p>

      {/* ── AUTH (LOGIN / REGISTER) ───────────── */}
      <Section title="Login / Register">
        <AuthShowcase />
      </Section>

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

      {/* ── CHARACTER CARD ───────────────────── */}
      <Section title="Character Card">
        <CharacterCard />
      </Section>

      {/* ── INPUT FIELDS ─────────────────────── */}
      <Section title="Input Fields">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxWidth: '320px' }}>
          <input className="input-fantasy" type="text" placeholder="Character name…" />
          <NumberStepper />
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

/* ── Auth (Login / Register) ─────────────── */

function AuthShowcase() {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  return mode === 'login'
    ? <LoginForm onSwitch={() => setMode('register')} />
    : <RegisterForm onSwitch={() => setMode('login')} />
}

function AuthCard({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div style={{
      width: '100%',
      maxWidth: '380px',
      borderRadius: '8px',
      border: '3px solid var(--color-gold-mid)',
      background: 'linear-gradient(180deg, #1e0a0c 0%, #130406 100%)',
      boxShadow: [
        '0 0 0 1px #080101',
        'inset 0 1px 0 rgba(255,255,255,0.06)',
        'inset 0 2px 8px rgba(0,0,0,0.6)',
        '0 0 24px rgba(200,140,30,0.12)',
        '0 6px 20px rgba(0,0,0,0.8)',
      ].join(', '),
      padding: '28px 26px',
    }}>
      <h2 style={{
        color: 'var(--color-gold-light)',
        fontSize: '22px',
        letterSpacing: '1.5px',
        textAlign: 'center',
        textShadow: '0 0 12px rgba(240,208,96,0.45), 0 2px 4px rgba(0,0,0,0.8)',
      }}>{title}</h2>
      <p style={{
        color: 'var(--color-text-muted)',
        fontSize: '12px',
        textAlign: 'center',
        marginTop: '6px',
        fontStyle: 'italic',
      }}>{subtitle}</p>

      <div style={{ margin: '18px 0' }}><GoldDivider /></div>

      {children}
    </div>
  )
}

function Field({ label, type = 'text', placeholder }: { label: string; type?: string; placeholder?: string }) {
  return (
    <div style={{ marginBottom: '14px' }}>
      <label style={{
        display: 'block',
        color: 'var(--color-text-muted)',
        fontSize: '10px',
        letterSpacing: '1.5px',
        textTransform: 'uppercase',
        marginBottom: '6px',
      }}>{label}</label>
      <input className="input-fantasy" type={type} placeholder={placeholder} />
    </div>
  )
}

function AuthSwitchLink({ prompt, action, onSwitch }: { prompt: string; action: string; onSwitch: () => void }) {
  return (
    <p style={{ textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '12px', marginTop: '16px' }}>
      {prompt}{' '}
      <button
        type="button"
        onClick={onSwitch}
        style={{
          background: 'none',
          border: 'none',
          color: 'var(--color-text-gold)',
          fontFamily: 'Georgia, serif',
          fontSize: '12px',
          cursor: 'pointer',
          textDecoration: 'underline',
          textUnderlineOffset: '2px',
          padding: 0,
        }}
      >{action}</button>
    </p>
  )
}

function LoginForm({ onSwitch }: { onSwitch: () => void }) {
  return (
    <AuthCard title="Enter the Realm" subtitle="Sign in to continue your conquest">
      <Field label="Username" placeholder="Your hero name…" />
      <Field label="Password" type="password" placeholder="••••••••" />
      <div style={{ marginTop: '20px' }}>
        <PrimaryButton fullWidth type="submit">Sign In</PrimaryButton>
      </div>
      <AuthSwitchLink prompt="No account yet?" action="Forge one" onSwitch={onSwitch} />
    </AuthCard>
  )
}

function RegisterForm({ onSwitch }: { onSwitch: () => void }) {
  return (
    <AuthCard title="Forge Your Legend" subtitle="Create an account to begin">
      <Field label="Username" placeholder="Choose a hero name…" />
      <Field label="Password" type="password" placeholder="••••••••" />
      <Field label="Confirm Password" type="password" placeholder="••••••••" />
      <div style={{ marginTop: '20px' }}>
        <PrimaryButton fullWidth type="submit">Create Account</PrimaryButton>
      </div>
      <AuthSwitchLink prompt="Already have an account?" action="Sign in" onSwitch={onSwitch} />
    </AuthCard>
  )
}

/* ── Atoms ───────────────────────────────── */

function PrimaryButton({ children, disabled, fullWidth, onClick, type }: { children: React.ReactNode; disabled?: boolean; fullWidth?: boolean; onClick?: () => void; type?: 'button' | 'submit' }) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      type={type ?? 'button'}
      className="btn btn-primary"
      style={{
        position: 'relative',
        width: fullWidth ? '100%' : undefined,
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
    <div className="atom-heavy" style={{
      display: 'flex',
      alignItems: 'center',
      gap: '7px',
      padding: '5px 12px',
      borderRadius: '4px',
      border: '2px solid var(--color-gold-dark)',
      background: 'linear-gradient(180deg, #1e0a0c 0%, #130406 100%)',
    }}>
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

function ProgressBar({ value, label, color = '#8c2020' }: { value: number; label: string; color?: string }) {
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
    <span className="atom-heavy" style={{
      display: 'inline-block',
      padding: '5px 14px',
      borderRadius: '4px',
      fontSize: '11px',
      letterSpacing: '2px',
      textTransform: 'uppercase',
      fontFamily: 'Georgia, serif',
      color: s.color,
      border: `2px solid ${s.border}`,
      background: `linear-gradient(180deg, color-mix(in srgb, ${s.border} 30%, #0f0203) 0%, #0f0203 100%)`,
      /* Override atom-heavy glow with rarity-specific glow */
      boxShadow: [
        '0 0 0 1px #080101',
        'inset 0 1px 0 rgba(255,255,255,0.07)',
        'inset 0 2px 5px rgba(0,0,0,0.55)',
        `0 0 10px ${s.glow}`,
        '0 3px 8px rgba(0,0,0,0.65)',
      ].join(', '),
    }}>
      {rarity}
    </span>
  )
}

function StatPill({ label, value }: { label: string; value: number }) {
  return (
    <div className="atom-heavy" style={{
      display: 'flex',
      alignItems: 'center',
      gap: '7px',
      padding: '6px 12px',
      borderRadius: '4px',
      border: '2px solid var(--color-gold-dark)',
      background: 'linear-gradient(180deg, #1e0a0c 0%, #130406 100%)',
    }}>
      <span style={{
        color: 'var(--color-text-muted)',
        fontSize: '10px',
        letterSpacing: '1.5px',
        textTransform: 'uppercase',
        textShadow: '0 1px 2px rgba(0,0,0,0.8)',
      }}>{label}</span>
      <span style={{
        color: 'var(--color-text-gold)',
        fontSize: '15px',
        fontWeight: 'bold',
        textShadow: '0 0 6px rgba(232,192,80,0.4), 0 1px 2px rgba(0,0,0,0.9)',
      }}>{value}</span>
    </div>
  )
}

function LevelBadge({ level }: { level: number }) {
  return (
    <div className="atom-heavy" style={{
      display: 'flex',
      alignItems: 'center',
      gap: '5px',
      padding: '6px 14px',
      borderRadius: '4px',
      border: '2px solid var(--color-gold-mid)',
      background: 'linear-gradient(180deg, #2a1a08 0%, #120a02 100%)',
    }}>
      <span style={{
        color: 'var(--color-text-muted)',
        fontSize: '10px',
        letterSpacing: '2px',
        textTransform: 'uppercase',
      }}>LV</span>
      <span style={{
        color: 'var(--color-gold-light)',
        fontSize: '16px',
        fontWeight: 'bold',
        textShadow: '0 0 8px rgba(240,208,96,0.5), 0 1px 3px rgba(0,0,0,0.9)',
      }}>{level}</span>
    </div>
  )
}

function CoinDisplay({ amount }: { amount: number }) {
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
      <span style={{ fontSize: '15px', lineHeight: 1 }}>🪙</span>
      <span style={{
        color: 'var(--color-text-gold)',
        fontSize: '15px',
        fontWeight: 'bold',
        textShadow: '0 0 8px rgba(232,192,80,0.4), 0 1px 2px rgba(0,0,0,0.9)',
      }}>{amount.toLocaleString()}</span>
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

/* ── Number Stepper ──────────────────────────────────── */

function NumberStepper({ min = 0, step = 1, initial = 1 }: { min?: number; step?: number; initial?: number }) {
  const [value, setValue] = useState(initial)
  const inc = () => setValue(v => v + step)
  const dec = () => setValue(v => Math.max(min, v - step))

  return (
    <div className="atom-heavy" style={{
      display: 'flex',
      alignItems: 'stretch',
      borderRadius: '4px',
      border: '2px solid var(--color-gold-dark)',
      background: 'linear-gradient(180deg, #0e0203 0%, var(--color-bg-panel) 100%)',
      overflow: 'hidden',
    }}>
      <input
        className="input-fantasy input-number"
        type="number"
        value={value}
        onChange={e => {
          const n = Number(e.target.value)
          setValue(Number.isNaN(n) ? min : Math.max(min, n))
        }}
        style={{
          flex: 1,
          border: 'none',
          borderRadius: 0,
          boxShadow: 'none',
          background: 'transparent',
        }}
      />
      <div style={{ display: 'flex', flexDirection: 'column', width: '30px' }}>
        <button type="button" className="stepper-btn" onClick={inc} aria-label="Increase">▲</button>
        <button type="button" className="stepper-btn" onClick={dec} aria-label="Decrease">▼</button>
      </div>
    </div>
  )
}

/* ── Tooltip ─────────────────────────────────────────── */

function Tooltip({ children, content }: { children: React.ReactNode; content: React.ReactNode }) {
  const [visible, setVisible] = useState(false)
  return (
    <div
      className="tooltip-wrap"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      {children}
      {visible && <div className="tooltip-box">{content}</div>}
    </div>
  )
}

/* ── Character Card ──────────────────────────────────── */

type CharTab = 'equipped' | 'talents' | 'stats'

const MOCK_EQUIPPED: Record<string, { name: string; rarity: string } | null> = {
  HEAD:     { name: 'Helm of the Fallen', rarity: 'Rare' },
  SHOULDER: { name: 'Pauldrons of Dread', rarity: 'Epic' },
  CHEST:    { name: 'Breastplate of Valor', rarity: 'Uncommon' },
  HANDS:    null,
  BELT:     { name: 'Girdle of Shadows', rarity: 'Common' },
  LEGS:     null,
  BOOTS:    { name: 'Sabatons of Might', rarity: 'Legendary' },
  WEAPON:   { name: 'Ashbringer', rarity: 'Legendary' },
  'RING 1':  { name: 'Band of Annihilation', rarity: 'Rare' },
  'RING 2':  null,
  'RING 3':  { name: 'Seal of the Lich King', rarity: 'Epic' },
  'RING 4':  null,
  'TRINKET 1': null,
  'TRINKET 2': { name: 'Eye of the Lich', rarity: 'Epic' },
}

const MOCK_BLESSINGS = [
  { row: 1, unlocked: true,  slots: [{ name: 'Blade Mastery', pts: 3, max: 5 }, { name: 'Iron Skin', pts: 5, max: 5 }, { name: 'Battle Cry', pts: 0, max: 3 }] },
  { row: 2, unlocked: true,  slots: [{ name: 'Death Grip',    pts: 2, max: 5 }, { name: 'Dark Pact', pts: 1, max: 5 }, { name: 'Soul Drain', pts: 0, max: 3 }] },
  { row: 3, unlocked: false, slots: [{ name: 'Unholy Ground', pts: 0, max: 5 }, { name: 'Blood Boil', pts: 0, max: 5 }, { name: 'Bone Shield', pts: 0, max: 3 }] },
  { row: 4, unlocked: false, slots: [{ name: 'Army of Dead',  pts: 0, max: 3 }, { name: 'Lich Form',  pts: 0, max: 3 }, { name: 'Soul Storm',  pts: 0, max: 3 }] },
  { row: 5, unlocked: false, slots: [{ name: 'Death March',   pts: 0, max: 5 }, { name: 'Plague Aura', pts: 0, max: 5 }, { name: 'Death Pact', pts: 0, max: 5 }] },
  { row: 6, unlocked: false, slots: [{ name: 'Apocalypse',    pts: 0, max: 1 }, { name: 'Soul Reaper', pts: 0, max: 1 }, { name: 'Oblivion',   pts: 0, max: 1 }] },
]

type StatBreakdown = { label: string; base: number; items: number; blessings: number; upgrades: number }

const MOCK_STATS: { offensive: StatBreakdown[]; defensive: StatBreakdown[] } = {
  offensive: [
    { label: 'ATK', base: 45, items: 28, blessings: 9,  upgrades: 0 },
    { label: 'STR', base: 40, items: 24, blessings: 0,  upgrades: 0 },
    { label: 'AGI', base: 30, items: 5,  blessings: 0,  upgrades: 3 },
    { label: 'INT', base: 18, items: 0,  blessings: 0,  upgrades: 0 },
    { label: 'SPD', base: 18, items: 0,  blessings: 0,  upgrades: 6 },
  ],
  defensive: [
    { label: 'DEF', base: 25, items: 20, blessings: 10, upgrades: 0 },
    { label: 'HP',  base: 800, items: 440, blessings: 0, upgrades: 0 },
  ],
}

function CharacterCard() {
  const [tab, setTab] = useState<CharTab>('equipped')

  return (
    <div style={{
      display: 'flex',
      maxWidth: '760px',
      borderRadius: '8px',
      border: '3px solid var(--color-gold-mid)',
      background: 'linear-gradient(180deg, #1e0a0c 0%, #130406 100%)',
      boxShadow: [
        '0 0 0 1px #080101',
        'inset 0 1px 0 rgba(255,255,255,0.06)',
        'inset 0 2px 8px rgba(0,0,0,0.6)',
        '0 0 24px rgba(200,140,30,0.12)',
        '0 6px 20px rgba(0,0,0,0.8)',
      ].join(', '),
    }}>
      {/* ── Left: Portrait column ── */}
      <div style={{
        width: '180px',
        flexShrink: 0,
        borderRight: '2px solid var(--color-gold-dark)',
        background: 'linear-gradient(180deg, #150608 0%, #0f0305 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '20px 12px 16px',
        gap: '12px',
        boxShadow: 'inset -4px 0 12px rgba(0,0,0,0.5)',
      }}>
        {/* Portrait frame */}
        <div className="atom-heavy" style={{
          width: '156px',
          height: '220px',
          border: '3px solid var(--color-gold-mid)',
          borderRadius: '4px',
          background: 'linear-gradient(180deg, #1a0608 0%, #0d0304 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}>
          <span style={{ color: 'var(--color-text-muted)', fontSize: '12px', letterSpacing: '1px', textTransform: 'uppercase' }}>Portrait</span>
        </div>

        {/* Name */}
        <div style={{ textAlign: 'center' }}>
          <p style={{
            color: 'var(--color-gold-light)',
            fontSize: '13px',
            fontWeight: 'bold',
            letterSpacing: '0.5px',
            textShadow: '0 0 8px rgba(240,208,96,0.4)',
            lineHeight: 1.3,
          }}>Alexandros Mograine</p>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '11px', marginTop: '3px', letterSpacing: '1px' }}>Death Knight</p>
        </div>

        <LevelBadge level={24} />

        {/* XP bar */}
        <div style={{ width: '100%' }}>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '10px', letterSpacing: '1px', marginBottom: '5px', textTransform: 'uppercase' }}>Experience</p>
          <ProgressBar value={62} label="" color="#7c2dbe" />
        </div>
      </div>

      {/* ── Right: Tabs column ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Tab nav */}
        <div style={{
          display: 'flex',
          borderBottom: '2px solid var(--color-gold-dark)',
          background: 'linear-gradient(180deg, #180608 0%, #110405 100%)',
        }}>
          {(['equipped', 'talents', 'stats'] as CharTab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                flex: 1,
                padding: '11px 8px',
                fontFamily: 'Georgia, serif',
                fontSize: '11px',
                letterSpacing: '2px',
                textTransform: 'uppercase',
                cursor: 'pointer',
                border: 'none',
                borderBottom: tab === t ? '2px solid var(--color-gold-mid)' : '2px solid transparent',
                marginBottom: '-2px',
                background: tab === t
                  ? 'linear-gradient(180deg, #2a0f12 0%, #1e0a0c 100%)'
                  : 'transparent',
                color: tab === t ? 'var(--color-gold-light)' : 'var(--color-text-muted)',
                transition: 'color 0.15s, background 0.15s',
                textShadow: tab === t ? '0 0 8px rgba(240,208,96,0.4)' : 'none',
              }}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div style={{ flex: 1, padding: '16px' }}>
          {tab === 'equipped' && <EquippedTab />}
          {tab === 'talents'  && <TalentsTab />}
          {tab === 'stats'    && <StatsTab />}
        </div>
      </div>
    </div>
  )
}

function EquippedTab() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
      {Object.entries(MOCK_EQUIPPED).map(([slot, item]) => (
        <Tooltip
          key={slot}
          content={
            item ? (
              <div>
                <p style={{ color: RARITY_STYLES[item.rarity]?.color ?? 'var(--color-text-primary)', fontSize: '13px', fontWeight: 'bold', marginBottom: '4px' }}>{item.name}</p>
                <RarityBadge rarity={item.rarity} />
                <p style={{ color: 'var(--color-text-muted)', fontSize: '12px', marginTop: '8px', lineHeight: 1.5 }}>
                  Lorem ipsum dolor sit amet, consectetur adipiscing elit. Fortis arma bellum gloria.
                </p>
              </div>
            ) : (
              <p style={{ color: 'var(--color-text-muted)', fontSize: '12px', fontStyle: 'italic' }}>This slot is empty.</p>
            )
          }
        >
          <div className="atom-heavy" style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '3px',
            padding: '8px 10px',
            borderRadius: '4px',
            border: `2px solid ${item ? 'var(--color-gold-dark)' : '#2a0d10'}`,
            background: item
              ? 'linear-gradient(180deg, #1e0a0c 0%, #130406 100%)'
              : 'linear-gradient(180deg, #110305 0%, #0a0203 100%)',
            opacity: item ? 1 : 0.55,
            cursor: item ? 'pointer' : 'default',
          }}>
            <span style={{ color: 'var(--color-text-muted)', fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase' }}>{slot}</span>
            {item ? (
              <span style={{
                color: RARITY_STYLES[item.rarity]?.color ?? 'var(--color-text-primary)',
                fontSize: '12px',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                textShadow: `0 0 6px ${RARITY_STYLES[item.rarity]?.glow ?? 'transparent'}`,
              }}>{item.name}</span>
            ) : (
              <span style={{ color: '#3a1218', fontSize: '12px', fontStyle: 'italic' }}>Empty</span>
            )}
          </div>
        </Tooltip>
      ))}
    </div>
  )
}

function TalentsTab() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {MOCK_BLESSINGS.map(row => (
        <div key={row.row} style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          gap: '6px',
          opacity: row.unlocked ? 1 : 0.35,
        }}>
          {row.slots.map(slot => (
            <Tooltip
              key={slot.name}
              content={
                <div>
                  <p style={{ color: 'var(--color-gold-light)', fontSize: '13px', fontWeight: 'bold', marginBottom: '4px' }}>{slot.name}</p>
                  <p style={{ color: 'var(--color-text-muted)', fontSize: '11px', marginBottom: '8px' }}>
                    {row.unlocked ? `Rank ${slot.pts} / ${slot.max}` : 'Locked — spend 5 points in previous row'}
                  </p>
                  <p style={{ color: 'var(--color-text-primary)', fontSize: '12px', lineHeight: 1.5 }}>
                    Lorem ipsum dolor sit amet, consectetur adipiscing elit. Virtus et gloria per arma crescit.
                  </p>
                </div>
              }
            >
              <div className="atom-heavy" style={{
                padding: '8px 10px',
                borderRadius: '4px',
                border: `2px solid ${row.unlocked ? 'var(--color-gold-dark)' : '#2a0d10'}`,
                background: 'linear-gradient(180deg, #1a0a0c 0%, #100305 100%)',
                cursor: row.unlocked ? 'pointer' : 'not-allowed',
              }}>
                <p style={{ color: 'var(--color-text-primary)', fontSize: '11px', marginBottom: '6px', letterSpacing: '0.3px' }}>{slot.name}</p>
                <div style={{ display: 'flex', gap: '3px', alignItems: 'center' }}>
                  {Array.from({ length: slot.max }).map((_, i) => (
                    <div key={i} style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      border: '1px solid var(--color-gold-dark)',
                      background: i < slot.pts
                        ? 'radial-gradient(circle at 40% 35%, #f0d060, #7a4f10)'
                        : 'linear-gradient(180deg, #1a0608, #0d0304)',
                      boxShadow: i < slot.pts ? '0 0 4px rgba(200,140,30,0.6)' : 'none',
                    }} />
                  ))}
                  {slot.pts > 0 && (
                    <span style={{ color: 'var(--color-text-muted)', fontSize: '9px', marginLeft: '3px' }}>{slot.pts}/{slot.max}</span>
                  )}
                </div>
              </div>
            </Tooltip>
          ))}
        </div>
      ))}
      {!MOCK_BLESSINGS[0].unlocked && (
        <p style={{ color: 'var(--color-text-muted)', fontSize: '12px', textAlign: 'center', marginTop: '8px' }}>Spend 5 points in the previous row to unlock</p>
      )}
    </div>
  )
}

function StatBreakdownTooltip({ stat }: { stat: StatBreakdown }) {
  const total = stat.base + stat.items + stat.blessings + stat.upgrades
  const sources = [
    { label: 'Base',      value: stat.base,      color: 'var(--color-text-primary)' },
    { label: 'Items',     value: stat.items,      color: '#5b9bd5' },
    { label: 'Blessings', value: stat.blessings,  color: '#b06fd4' },
    { label: 'Upgrades',  value: stat.upgrades,   color: '#4caf6e' },
  ].filter(s => s.value > 0)

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '10px' }}>
        <span style={{ color: 'var(--color-text-muted)', fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase' }}>{stat.label}</span>
        <span style={{ color: 'var(--color-gold-light)', fontSize: '22px', fontWeight: 'bold', textShadow: '0 0 10px rgba(240,208,96,0.5)' }}>{total}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
        {sources.map(s => (
          <div key={s.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '24px' }}>
            <span style={{ color: 'var(--color-text-muted)', fontSize: '11px', letterSpacing: '0.5px' }}>{s.label}</span>
            <span style={{ color: s.color, fontSize: '13px', fontWeight: 'bold' }}>
              {s.label === 'Base' ? s.value : `+${s.value}`}
            </span>
          </div>
        ))}
      </div>
      {/* Divider + total row */}
      <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid var(--color-gold-dark)', display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ color: 'var(--color-text-muted)', fontSize: '11px', letterSpacing: '0.5px' }}>Total</span>
        <span style={{ color: 'var(--color-text-gold)', fontSize: '13px', fontWeight: 'bold' }}>{total}</span>
      </div>
    </div>
  )
}

function StatsTab() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {(['offensive', 'defensive'] as const).map(group => (
        <div key={group}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
            <span style={{ color: 'var(--color-text-muted)', fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{group}</span>
            <GoldDivider />
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {MOCK_STATS[group].map(s => (
              <Tooltip key={s.label} content={<StatBreakdownTooltip stat={s} />}>
                <StatPill label={s.label} value={s.base + s.items + s.blessings + s.upgrades} />
              </Tooltip>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { RARITY_STYLES } from '../lib/rarity'
import { PrimaryButton, SecondaryButton, DangerButton, GhostButton } from '../components/atoms/Button'
import { Panel } from '../components/atoms/Panel'
import { IconSlot } from '../components/atoms/IconSlot'
import { ResourceChip } from '../components/atoms/ResourceChip'
import { ProgressBar } from '../components/atoms/ProgressBar'
import { RarityBadge } from '../components/atoms/RarityBadge'

export default function DesignPage() {
  const [modal, setModal] = useState<null | 'claim' | 'dispatch'>(null)
  return (
    <div style={{ backgroundColor: 'var(--color-bg-deep)', minHeight: '100svh', padding: '40px 24px', fontFamily: 'Georgia, serif' }}>
      {/* Full-bleed header preview (sticky in-app) */}
      <div style={{ margin: '-40px -24px 8px' }}>
        <GameHeader />
      </div>
      <p style={{ color: 'var(--color-text-muted)', fontSize: '11px', marginBottom: '40px', fontStyle: 'italic' }}>↑ Global header — present and sticky on every game page</p>

      <h1 style={{ color: 'var(--color-gold-light)', fontSize: '28px', marginBottom: '8px', letterSpacing: '2px', textTransform: 'uppercase' }}>
        Design System
      </h1>
      <p style={{ color: 'var(--color-text-muted)', marginBottom: '48px' }}>Visual language reference — iterate here before building pages</p>

      <GroupHeading>Atoms</GroupHeading>

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

      {/* ── ICON BUTTONS ─────────────────────── */}
      <Section title="Icon Buttons">
        <Row>
          <IconButton label="Close">✕</IconButton>
          <IconButton label="Settings">⚙</IconButton>
          <IconButton label="Add">+</IconButton>
          <IconButton label="Info">ℹ</IconButton>
          <IconButton size={42} label="Close large">✕</IconButton>
          <IconButton variant="danger" label="Delete">✕</IconButton>
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

      {/* ── COUNTDOWN TIMER ──────────────────── */}
      <Section title="Countdown Timer">
        <Row>
          <CountdownTimer durationSec={45} />
          <CountdownTimer durationSec={285} />
          <CountdownTimer durationSec={7800} />
          <CountdownTimer durationSec={30} startedSecAgo={30} />
        </Row>
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

      {/* ── CHECKBOX / RADIO / TOGGLE ────────── */}
      <Section title="Checkbox · Radio · Toggle">
        <div style={{ display: 'flex', gap: '48px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <label className="radio-label"><input type="checkbox" className="checkbox-fantasy" defaultChecked /> Auto-claim rewards</label>
            <label className="radio-label"><input type="checkbox" className="checkbox-fantasy" /> Show advanced stats</label>
          </div>
          <div className="radio-group">
            <label className="radio-label"><input type="radio" name="demo" defaultChecked /> Start Mission</label>
            <label className="radio-label"><input type="radio" name="demo" /> Send to Gather</label>
            <label className="radio-label"><input type="radio" name="demo" /> Stay at Camp</label>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <label className="radio-label"><input type="checkbox" className="toggle-fantasy" defaultChecked /> Sound</label>
            <label className="radio-label"><input type="checkbox" className="toggle-fantasy" /> Notifications</label>
          </div>
        </div>
      </Section>

      {/* ── SELECT / TABS / FILTERS ──────────── */}
      <Section title="Select · Tabs · Filters">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <CustomSelect
            options={[
              { value: 'rarity', label: 'Sort: Rarity' },
              { value: 'name', label: 'Sort: Name' },
              { value: 'recent', label: 'Sort: Recently acquired' },
              { value: 'value', label: 'Sort: Value' },
            ]}
          />
          <Tabs tabs={['Equipped', 'Talents', 'Stats']} />
          <SegmentedControl options={['All', 'Weapons', 'Armor', 'Trinkets']} />
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

      {/* ── COUNT BADGE & NOTIFICATION ───────── */}
      <Section title="Count Badge & Notification">
        <Row>
          <CountBadge count={3} />
          <CountBadge count={42} />
          <CountBadge count={128} />
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: 'var(--color-text-muted)', fontSize: '13px' }}>
            <NotificationDot /> unclaimed reward
          </span>
        </Row>
      </Section>

      {/* ── STATUS TAG ───────────────────────── */}
      <Section title="Status Tag">
        <Row>
          <StatusTag tone="ready">Ready</StatusTag>
          <StatusTag tone="busy">On Mission</StatusTag>
          <StatusTag tone="locked">Locked</StatusTag>
          <StatusTag tone="neutral">Stage 3</StatusTag>
          <StatusTag tone="danger">Failed</StatusTag>
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

      {/* ── AVATAR / PORTRAIT ────────────────── */}
      <Section title="Avatar / Portrait">
        <div style={{ display: 'flex', alignItems: 'flex-end', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
          <Avatar size={36} level={5} />
          <Avatar size={48} level={9} />
          <Avatar size={56} level={12} />
          <Avatar size={72} level={18} />
          <Avatar size={96} level={24} />
          <Avatar size={120} level={30} />
        </div>
        <Row>
          <Avatar size={56} state="available" level={12} />
          <Avatar size={56} state="busy" level={12} />
          <Avatar size={56} state="locked" />
        </Row>
      </Section>

      {/* ── SPINNER ──────────────────────────── */}
      <Section title="Spinner / Loading">
        <Row>
          <Spinner size={20} />
          <Spinner size={28} />
          <Spinner size={40} />
        </Row>
      </Section>

      {/* ── INLINE ALERTS ────────────────────── */}
      <Section title="Inline Alerts">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <Alert variant="success">Mission complete — rewards claimed.</Alert>
          <Alert variant="error">Not enough coins to recruit this character.</Alert>
          <Alert variant="warning">Your inventory is almost full.</Alert>
          <Alert variant="info">Shop restocks in 2h 14m.</Alert>
        </div>
      </Section>

      {/* ── ICON PLACEHOLDER ─────────────────── */}
      <Section title="Icon Placeholder (IconSlot)">
        <Row>
          <IconSlot size={16} />
          <IconSlot size={24} />
          <IconSlot size={40} />
          <IconSlot size={56} />
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

      <GroupHeading>Components</GroupHeading>

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

      {/* ── AUTH (LOGIN / REGISTER) ───────────── */}
      <Section title="Login / Register">
        <AuthShowcase />
      </Section>

      {/* ── CHARACTER CARD ───────────────────── */}
      <Section title="Character Card">
        <CharacterCard />
      </Section>

      {/* ── LOOT TABLE ───────────────────────── */}
      <Section title="Loot Table">
        <Row>
          {LOOT_TABLES.map(d => <LootTable key={d.mission} data={d} />)}
        </Row>
      </Section>

      {/* ── MISSION DISPATCH ─────────────────── */}
      <Section title="Mission Dispatch (Send Party)">
        <MissionDispatch />
      </Section>

      {/* ── CLAIM REWARD ─────────────────────── */}
      <Section title="Claim Reward (Mission Complete)">
        <ClaimReward />
      </Section>

      {/* ── MISSION CARDS ────────────────────── */}
      <Section title="Mission Cards (Dashboard)">
        <Row>
          <MissionCard name="Goblin Outpost" stage={3} coins={100} duration="3:00" dropCount={3} onSend={() => setModal('dispatch')} />
          <ActiveMissionCard name="Frozen Pass" partySize={2} durationSec={90} startedSecAgo={45} />
          <ActiveMissionCard name="Goblin Outpost" partySize={3} durationSec={30} startedSecAgo={30} onClaim={() => setModal('claim')} />
        </Row>
      </Section>

      {/* ── MODAL / OVERLAY ──────────────────── */}
      <Section title="Modal / Overlay">
        <Row>
          <PrimaryButton onClick={() => setModal('dispatch')}>Open Dispatch</PrimaryButton>
          <PrimaryButton onClick={() => setModal('claim')}>Open Claim</PrimaryButton>
        </Row>
      </Section>

      <Modal open={modal !== null} onClose={() => setModal(null)}>
        {modal === 'claim' ? <ClaimReward /> : modal === 'dispatch' ? <MissionDispatch /> : null}
      </Modal>
    </div>
  )
}

/* ── Layout helpers ──────────────────────── */

function GroupHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{
      color: 'var(--color-gold-light)',
      fontSize: '20px',
      letterSpacing: '4px',
      textTransform: 'uppercase',
      margin: '8px 0 28px',
      paddingBottom: '10px',
      borderBottom: '2px solid var(--color-gold-mid)',
      textShadow: '0 0 12px rgba(240,208,96,0.4)',
    }}>{children}</h2>
  )
}

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

/* ── Game Header (top nav) ───────────────── */

const NAV_ITEMS = ['Missions', 'Team', 'Mines', 'Crafting', 'Shop', 'Inventory', 'Upgrades', 'Blessings', 'Transcendence', 'Statistics']

const HEADER_ORES = [
  { label: 'Cu', value: 142 }, { label: 'Ag', value: 28 }, { label: 'Au', value: 5 }, { label: 'Pt', value: 0 },
]
const HEADER_MATERIALS = [
  { label: 'Wd', value: 300 }, { label: 'Co', value: 64 }, { label: 'St', value: 120 }, { label: 'Br', value: 12 }, { label: 'Fe', value: 88 },
]

function HeaderDivider() {
  return <div style={{ width: '2px', alignSelf: 'stretch', margin: '6px 4px', background: 'linear-gradient(180deg, transparent, var(--color-gold-dark), transparent)' }} />
}

function GameHeader() {
  const [active, setActive] = useState('Missions')
  return (
    <header style={{
      display: 'flex',
      flexDirection: 'column',
      borderBottom: '3px solid var(--color-gold-mid)',
      boxShadow: [
        '0 0 0 1px #080101',
        'inset 0 1px 0 rgba(255,255,255,0.06)',
        '0 4px 14px rgba(0,0,0,0.7)',
      ].join(', '),
    }}>
      {/* ── Tier 1: navigation ── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '14px',
        flexWrap: 'wrap',
        padding: '10px 18px',
        background: 'linear-gradient(180deg, #2a0d10 0%, #1a0608 100%)',
      }}>
        <span style={{
          color: 'var(--color-gold-light)',
          fontSize: '15px',
          fontWeight: 'bold',
          letterSpacing: '1.5px',
          textTransform: 'uppercase',
          textShadow: '0 0 12px rgba(240,208,96,0.5), 0 2px 3px rgba(0,0,0,0.9)',
          whiteSpace: 'nowrap',
        }}>⚔ The Idle Game</span>
        <nav style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center' }}>
          {NAV_ITEMS.map(item => (
            <button
              key={item}
              onClick={() => setActive(item)}
              className={active === item ? 'nav-link nav-link--active' : 'nav-link'}
            >{item}</button>
          ))}
        </nav>
      </div>

      {/* ── Tier 2: resources + currency (sunken strip, always shown) ── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-start',
        gap: '6px',
        flexWrap: 'wrap',
        padding: '8px 18px',
        borderTop: '2px solid var(--color-gold-dark)',
        background: 'linear-gradient(180deg, #0c0203 0%, #140405 100%)',
        boxShadow: 'inset 0 3px 8px rgba(0,0,0,0.6)',
      }}>
        {HEADER_ORES.map(r => <ResourceChip key={r.label} label={r.label} value={r.value} />)}
        <HeaderDivider />
        {HEADER_MATERIALS.map(r => <ResourceChip key={r.label} label={r.label} value={r.value} />)}
        <HeaderDivider />
        <CoinDisplay amount={1420} />
      </div>
    </header>
  )
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

/* ── Loot Table ──────────────────────────── */

type RarityChance = { rarity: string; chance: number }
type DropItem = { name: string; slot: string; chances: RarityChance[] }
type MissionDrops = { mission: string; stage: number; boss?: boolean; pool: DropItem[] }

// Independent per-(item, rarity) chances — they do NOT sum to 100.
const LOOT_TABLES: MissionDrops[] = [
  {
    mission: 'Goblin Outpost', stage: 1, pool: [
      { name: 'Coif', slot: 'Head', chances: [{ rarity: 'Common', chance: 90 }, { rarity: 'Uncommon', chance: 15 }] },
      { name: 'Tattered Cloak', slot: 'Chest', chances: [{ rarity: 'Common', chance: 80 }, { rarity: 'Uncommon', chance: 10 }] },
      { name: 'Bent Dagger', slot: 'Weapon', chances: [{ rarity: 'Common', chance: 70 }, { rarity: 'Uncommon', chance: 6 }] },
    ],
  },
  {
    mission: 'Ragefire Warren', stage: 7, boss: true, pool: [
      { name: 'Ragefire Crown', slot: 'Head', chances: [{ rarity: 'Uncommon', chance: 70 }, { rarity: 'Rare', chance: 35 }, { rarity: 'Epic', chance: 6 }, { rarity: 'Legendary', chance: 0.8 }] },
      { name: 'Emberforged Blade', slot: 'Weapon', chances: [{ rarity: 'Uncommon', chance: 60 }, { rarity: 'Rare', chance: 30 }, { rarity: 'Epic', chance: 5 }, { rarity: 'Legendary', chance: 0.5 }] },
      { name: 'Cinderhide Belt', slot: 'Belt', chances: [{ rarity: 'Rare', chance: 40 }, { rarity: 'Epic', chance: 8 }] },
    ],
  },
]

function RarityChancePill({ rarity, chance }: RarityChance) {
  const s = RARITY_STYLES[rarity] ?? RARITY_STYLES.Common
  return (
    <span className="atom-heavy" style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px',
      padding: '3px 9px',
      borderRadius: '3px',
      fontSize: '11px',
      fontFamily: 'Georgia, serif',
      border: `2px solid ${s.border}`,
      background: `linear-gradient(180deg, color-mix(in srgb, ${s.border} 25%, #0f0203) 0%, #0f0203 100%)`,
    }}>
      <span style={{ color: s.color, letterSpacing: '0.5px', textShadow: `0 0 6px ${s.glow}` }}>{rarity}</span>
      <span style={{ color: 'var(--color-text-primary)', fontWeight: 'bold' }}>{chance}%</span>
    </span>
  )
}

function LootTable({ data }: { data: MissionDrops }) {
  return (
    <div style={{
      width: '340px',
      borderRadius: '8px',
      border: '3px solid var(--color-gold-mid)',
      background: 'linear-gradient(180deg, #1e0a0c 0%, #130406 100%)',
      boxShadow: [
        '0 0 0 1px #080101',
        'inset 0 1px 0 rgba(255,255,255,0.06)',
        'inset 0 2px 8px rgba(0,0,0,0.6)',
        '0 6px 20px rgba(0,0,0,0.8)',
      ].join(', '),
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '8px',
        padding: '10px 14px',
        borderBottom: '2px solid var(--color-gold-dark)',
        background: 'linear-gradient(180deg, rgba(200,145,42,0.15) 0%, rgba(200,145,42,0.04) 100%)',
      }}>
        <div>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '9px', letterSpacing: '2px', textTransform: 'uppercase' }}>Loot Table</p>
          <p style={{ color: 'var(--color-gold-light)', fontSize: '14px', fontWeight: 'bold', letterSpacing: '0.5px', textShadow: '0 0 10px rgba(240,208,96,0.4)' }}>{data.mission}</p>
        </div>
        <span style={{
          color: data.boss ? '#e08080' : 'var(--color-text-gold)',
          fontSize: '10px',
          letterSpacing: '1px',
          textTransform: 'uppercase',
          whiteSpace: 'nowrap',
          border: `1px solid ${data.boss ? '#6b1010' : 'var(--color-gold-dark)'}`,
          borderRadius: '3px',
          padding: '3px 7px',
        }}>{data.boss ? 'Boss' : `Stage ${data.stage}`}</span>
      </div>

      {/* Item rows — image on the left, details to the right */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px' }}>
        {data.pool.map(item => (
          <div key={item.name} className="atom-heavy" style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '10px 11px',
            borderRadius: '4px',
            border: '2px solid var(--color-gold-dark)',
            background: 'linear-gradient(180deg, #1a0a0c 0%, #100305 100%)',
          }}>
            <IconSlot size={48} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '8px' }}>
                <span style={{ color: 'var(--color-text-primary)', fontSize: '13px', flex: 1 }}>{item.name}</span>
                <span style={{ color: 'var(--color-text-muted)', fontSize: '9px', letterSpacing: '1px', textTransform: 'uppercase' }}>{item.slot}</span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                {item.chances.map(c => <RarityChancePill key={c.rarity} rarity={c.rarity} chance={c.chance} />)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── Mission Dispatch (send a party to a mission) ── */

const DISPATCH_MISSION: { name: string; stage: number; description: string; duration: string; xpPerChar: number; loot: DropItem[] } = {
  name: 'Goblin Outpost',
  stage: 3,
  description: 'A ramshackle camp of goblin raiders harassing the eastern road. Clear them out and claim whatever they have hoarded away.',
  duration: '3:00',
  xpPerChar: 120,
  loot: [
    { name: 'Coif', slot: 'Head', chances: [{ rarity: 'Common', chance: 90 }, { rarity: 'Uncommon', chance: 15 }] },
    { name: 'Tattered Cloak', slot: 'Chest', chances: [{ rarity: 'Common', chance: 80 }, { rarity: 'Uncommon', chance: 10 }] },
    { name: 'Bent Dagger', slot: 'Weapon', chances: [{ rarity: 'Common', chance: 70 }, { rarity: 'Uncommon', chance: 6 }] },
  ],
}

type RosterChar = { id: string; name: string; class: string; level: number; statTotal: number; busy?: boolean }
const DISPATCH_ROSTER: RosterChar[] = [
  { id: 'r1', name: 'Lyra Swift', class: 'Rogue', level: 12, statTotal: 95 },
  { id: 'r2', name: 'Alexandros Mograine', class: 'Death Knight', level: 24, statTotal: 180 },
  { id: 'r3', name: 'Fandral Staghelm', class: 'Druid', level: 9, statTotal: 70, busy: true },
  { id: 'r4', name: 'Sally Whitemane', class: 'Priest', level: 15, statTotal: 120 },
]
const MAX_PARTY = 3

function DispatchLabel({ children }: { children: React.ReactNode }) {
  return <p style={{ color: 'var(--color-text-muted)', fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '8px' }}>{children}</p>
}

function InfoStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="atom-heavy" style={{
      flex: 1, padding: '8px 12px', borderRadius: '4px',
      border: '2px solid var(--color-gold-dark)',
      background: 'linear-gradient(180deg, #1a0a0c 0%, #100305 100%)',
    }}>
      <p style={{ color: 'var(--color-text-muted)', fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase' }}>{label}</p>
      <p style={{ color: 'var(--color-text-gold)', fontSize: '15px', fontWeight: 'bold', textShadow: '0 0 6px rgba(232,192,80,0.3)' }}>{value}</p>
    </div>
  )
}

function CharacterTile({ char, selected, disabled, onToggle }: { char: RosterChar; selected: boolean; disabled?: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      style={{
        display: 'flex', alignItems: 'center', gap: '10px', textAlign: 'left', width: '100%',
        padding: '8px 10px', borderRadius: '5px', cursor: disabled ? 'not-allowed' : 'pointer',
        fontFamily: 'Georgia, serif',
        border: `2px solid ${selected ? 'var(--color-gold-mid)' : 'var(--color-gold-dark)'}`,
        background: selected ? 'linear-gradient(180deg, #34161a 0%, #1e0a0c 100%)' : 'linear-gradient(180deg, #1a0a0c 0%, #100305 100%)',
        opacity: disabled ? 0.45 : 1,
        boxShadow: selected
          ? '0 0 0 1px #080101, 0 0 12px rgba(200,140,30,0.35), inset 0 1px 0 rgba(255,255,255,0.07)'
          : '0 0 0 1px #080101, inset 0 1px 0 rgba(255,255,255,0.05)',
        transition: 'border-color 0.15s, box-shadow 0.15s',
      }}
    >
      <div style={{
        width: 38, height: 46, flexShrink: 0, borderRadius: '3px',
        border: '2px solid var(--color-gold-dark)',
        background: 'linear-gradient(180deg, #1a0608 0%, #0d0304 100%)',
        boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.6)',
      }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ color: 'var(--color-text-primary)', fontSize: '12px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{char.name}</p>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '10px', letterSpacing: '0.5px' }}>
          {char.class} · Lv {char.level}{char.busy ? ' · On mission' : ` · ${char.statTotal} pts`}
        </p>
      </div>
      <span style={{
        width: 18, height: 18, flexShrink: 0, borderRadius: '50%',
        border: `2px solid ${selected ? 'var(--color-gold-mid)' : 'var(--color-gold-dark)'}`,
        background: selected ? 'radial-gradient(circle at 40% 35%, #f0d060, #7a4f10)' : 'transparent',
        boxShadow: selected ? '0 0 6px rgba(200,140,30,0.6)' : 'none',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#1a0608', fontSize: '11px', fontWeight: 'bold',
      }}>{selected ? '✓' : ''}</span>
    </button>
  )
}

function MissionDispatch() {
  const [selected, setSelected] = useState<string[]>(['r2'])
  const toggle = (id: string) =>
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : (prev.length >= MAX_PARTY ? prev : [...prev, id]))

  const party = DISPATCH_ROSTER.filter(c => selected.includes(c.id))
  const combinedStat = party.reduce((sum, c) => sum + c.statTotal, 0)
  const statBonus = combinedStat * 0.1                    // % from summed stat points (0.1%/pt)
  const partyBonus = Math.max(0, party.length - 1) * 10   // % from party size (+10% per extra char)
  // Multiplicative: each bonus is its own independent multiplier.
  const totalPct = ((1 + statBonus / 100) * (1 + partyBonus / 100) - 1) * 100

  return (
    <div style={{
      width: 420, borderRadius: 8, border: '3px solid var(--color-gold-mid)',
      background: 'linear-gradient(180deg, #1e0a0c 0%, #130406 100%)',
      boxShadow: ['0 0 0 1px #080101', 'inset 0 1px 0 rgba(255,255,255,0.06)', 'inset 0 2px 8px rgba(0,0,0,0.6)', '0 6px 20px rgba(0,0,0,0.8)'].join(', '),
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px',
        padding: '12px 16px', borderBottom: '2px solid var(--color-gold-dark)',
        background: 'linear-gradient(180deg, rgba(200,145,42,0.15) 0%, rgba(200,145,42,0.04) 100%)',
      }}>
        <p style={{ color: 'var(--color-gold-light)', fontSize: '17px', fontWeight: 'bold', letterSpacing: '0.5px', textShadow: '0 0 12px rgba(240,208,96,0.4)' }}>{DISPATCH_MISSION.name}</p>
        <span style={{
          color: 'var(--color-text-gold)', fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase',
          whiteSpace: 'nowrap', border: '1px solid var(--color-gold-dark)', borderRadius: '3px', padding: '3px 7px',
        }}>Stage {DISPATCH_MISSION.stage}</span>
      </div>

      <div style={{ padding: '16px' }}>
        {/* Description */}
        <p style={{ color: 'var(--color-text-muted)', fontSize: '12px', lineHeight: 1.5, fontStyle: 'italic', marginBottom: '16px' }}>{DISPATCH_MISSION.description}</p>

        {/* Time + XP */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '18px' }}>
          <InfoStat label="Duration" value={DISPATCH_MISSION.duration} />
          <InfoStat label="XP each" value={`~${DISPATCH_MISSION.xpPerChar}`} />
        </div>

        {/* Potential loot */}
        <DispatchLabel>Potential Loot</DispatchLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '18px' }}>
          {DISPATCH_MISSION.loot.map(item => (
            <div key={item.name} className="atom-heavy" style={{
              display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', borderRadius: '4px',
              border: '2px solid var(--color-gold-dark)', background: 'linear-gradient(180deg, #1a0a0c 0%, #100305 100%)',
            }}>
              <IconSlot size={40} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '6px' }}>
                  <span style={{ color: 'var(--color-text-primary)', fontSize: '12px', flex: 1 }}>{item.name}</span>
                  <span style={{ color: 'var(--color-text-muted)', fontSize: '9px', letterSpacing: '1px', textTransform: 'uppercase' }}>{item.slot}</span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                  {item.chances.map(c => <RarityChancePill key={c.rarity} rarity={c.rarity} chance={c.chance} />)}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Party selection */}
        <DispatchLabel>Select Party — {selected.length}/{MAX_PARTY}</DispatchLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '16px' }}>
          {DISPATCH_ROSTER.map(c => {
            const isSelected = selected.includes(c.id)
            return (
              <CharacterTile
                key={c.id}
                char={c}
                selected={isSelected}
                disabled={c.busy || (!isSelected && selected.length >= MAX_PARTY)}
                onToggle={() => toggle(c.id)}
              />
            )
          })}
        </div>

        <div style={{ margin: '0 0 14px' }}><GoldDivider /></div>

        {/* Reward breakdown (multiplicative) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--color-text-muted)', fontSize: '11px', letterSpacing: '0.5px' }}>Stat bonus</span>
            <span style={{ color: 'var(--color-text-gold)', fontSize: '12px', fontWeight: 'bold' }}>+{statBonus.toFixed(1)}%</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--color-text-muted)', fontSize: '11px', letterSpacing: '0.5px' }}>
              Party size{party.length > 0 ? ` (×${party.length})` : ''}
            </span>
            <span style={{ color: 'var(--color-text-gold)', fontSize: '12px', fontWeight: 'bold' }}>+{partyBonus.toFixed(1)}%</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '7px', borderTop: '1px solid var(--color-gold-dark)' }}>
            <span style={{ color: 'var(--color-text-muted)', fontSize: '11px', letterSpacing: '0.5px' }}>Total rewards</span>
            <span style={{ color: 'var(--color-success)', fontSize: '16px', fontWeight: 'bold', textShadow: '0 0 8px rgba(74,140,63,0.4)' }}>+{totalPct.toFixed(1)}%</span>
          </div>
        </div>
        <PrimaryButton fullWidth disabled={selected.length === 0}>
          {selected.length === 0 ? 'Select a character' : `Send Party (${selected.length})`}
        </PrimaryButton>
      </div>
    </div>
  )
}

/* ── Claim Reward (mission complete) ── */

const CLAIM = {
  stageName: 'Goblin Outpost',
  stage: 3,
  elapsed: '3:00',
  baseCoins: 100,
  baseXp: 120,
  party: [
    { name: 'Lyra Swift', class: 'Rogue', level: 12 },
    { name: 'Alexandros Mograine', class: 'Death Knight', level: 24 },
  ],
  resources: [{ label: 'Cu', value: 20 }, { label: 'Wd', value: 13 }, { label: 'St', value: 8 }],
  items: [
    { name: 'Coif', slot: 'Head', rarity: 'Uncommon' },
    { name: 'Coif', slot: 'Head', rarity: 'Common' },
    { name: 'Bent Dagger', slot: 'Weapon', rarity: 'Common' },
  ],
  bonuses: [
    { label: 'Stat bonus', detail: '275 pts', pct: 27.5 },
    { label: 'Party size', detail: '×2', pct: 10 },
    { label: 'Transcendence', detail: '×2', pct: 20 },
  ],
}

function ClaimReward() {
  // Multiplicative chain — running value after each bonus is applied
  let running = CLAIM.baseCoins
  const coinSteps = CLAIM.bonuses.map(b => { running = running * (1 + b.pct / 100); return { ...b, value: Math.round(running) } })
  const multiplier = CLAIM.bonuses.reduce((m, b) => m * (1 + b.pct / 100), 1)
  const finalCoins = Math.round(CLAIM.baseCoins * multiplier)
  const xpEach = Math.round(CLAIM.baseXp * multiplier)

  const labelStyle: React.CSSProperties = { color: 'var(--color-text-muted)', fontSize: '11px', letterSpacing: '0.5px' }

  return (
    <div style={{
      width: 440, borderRadius: 8, border: '3px solid var(--color-gold-mid)',
      background: 'linear-gradient(180deg, #1e0a0c 0%, #130406 100%)',
      boxShadow: ['0 0 0 1px #080101', 'inset 0 1px 0 rgba(255,255,255,0.06)', 'inset 0 2px 8px rgba(0,0,0,0.6)', '0 6px 20px rgba(0,0,0,0.8)'].join(', '),
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        textAlign: 'center', padding: '16px', borderBottom: '2px solid var(--color-gold-dark)',
        background: 'linear-gradient(180deg, rgba(200,145,42,0.18) 0%, rgba(200,145,42,0.04) 100%)',
      }}>
        <p style={{ color: 'var(--color-gold-light)', fontSize: '18px', fontWeight: 'bold', letterSpacing: '2px', textTransform: 'uppercase', textShadow: '0 0 14px rgba(240,208,96,0.55), 0 2px 4px rgba(0,0,0,0.9)' }}>Mission Complete</p>
        <p style={{ color: 'var(--color-text-primary)', fontSize: '13px', marginTop: '4px' }}>{CLAIM.stageName} · Stage {CLAIM.stage}</p>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '11px', marginTop: '3px', fontStyle: 'italic' }}>Completed in {CLAIM.elapsed}</p>
      </div>

      <div style={{ padding: '16px' }}>
        {/* Party */}
        <DispatchLabel>Party</DispatchLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '16px' }}>
          {CLAIM.party.map(c => (
            <div key={c.name} className="atom-heavy" style={{
              display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 10px', borderRadius: '4px',
              border: '2px solid var(--color-gold-dark)', background: 'linear-gradient(180deg, #1a0a0c 0%, #100305 100%)',
            }}>
              <div style={{ width: 30, height: 36, flexShrink: 0, borderRadius: '3px', border: '2px solid var(--color-gold-dark)', background: 'linear-gradient(180deg, #1a0608 0%, #0d0304 100%)', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.6)' }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ color: 'var(--color-text-primary)', fontSize: '12px' }}>{c.name}</p>
                <p style={{ color: 'var(--color-text-muted)', fontSize: '10px' }}>{c.class} · Lv {c.level}</p>
              </div>
              <span style={{ color: 'var(--color-xp)', fontSize: '12px', fontWeight: 'bold', textShadow: '0 0 8px rgba(124,45,190,0.5)' }}>+{xpEach} XP</span>
            </div>
          ))}
        </div>

        <div style={{ margin: '0 0 16px' }}><GoldDivider /></div>

        {/* Rewards */}
        <DispatchLabel>Rewards</DispatchLabel>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
          <IconSlot size={18} />
          <span style={{ color: 'var(--color-text-gold)', fontSize: '18px', fontWeight: 'bold', textShadow: '0 0 8px rgba(232,192,80,0.4)' }}>+{finalCoins}</span>
          <span style={{ color: 'var(--color-text-muted)', fontSize: '11px' }}>coins</span>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
          {CLAIM.resources.map(r => <ResourceChip key={r.label} label={r.label} value={r.value} />)}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {CLAIM.items.map((item, i) => (
            <div key={i} className="atom-heavy" style={{
              display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 10px', borderRadius: '4px',
              border: '2px solid var(--color-gold-dark)', background: 'linear-gradient(180deg, #1a0a0c 0%, #100305 100%)',
            }}>
              <IconSlot size={34} />
              <span style={{ color: 'var(--color-text-primary)', fontSize: '12px', flex: 1 }}>{item.name}</span>
              <span style={{ color: 'var(--color-text-muted)', fontSize: '9px', letterSpacing: '1px', textTransform: 'uppercase' }}>{item.slot}</span>
              <RarityBadge rarity={item.rarity} />
            </div>
          ))}
        </div>

        <div style={{ margin: '16px 0' }}><GoldDivider /></div>

        {/* Transparency: how it was calculated */}
        <DispatchLabel>How it was calculated</DispatchLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={labelStyle}>Base coins</span>
            <span style={{ color: 'var(--color-text-primary)', fontSize: '12px' }}>{CLAIM.baseCoins}</span>
          </div>
          {coinSteps.map(s => (
            <div key={s.label} style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={labelStyle}>× {s.label} ({s.detail}) <span style={{ color: 'var(--color-success)' }}>+{s.pct}%</span></span>
              <span style={{ color: 'var(--color-text-muted)', fontSize: '12px' }}>→ {s.value}</span>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '6px', borderTop: '1px solid var(--color-gold-dark)' }}>
            <span style={labelStyle}>Total coins (×{multiplier.toFixed(2)})</span>
            <span style={{ color: 'var(--color-text-gold)', fontSize: '14px', fontWeight: 'bold' }}>{finalCoins}</span>
          </div>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '10px', fontStyle: 'italic', marginTop: '4px' }}>
            Resources and XP use the same ×{multiplier.toFixed(2)} multiplier. Loot rolled once per character.
          </p>
        </div>

        <div style={{ margin: '16px 0 12px' }}><GoldDivider /></div>

        <PrimaryButton fullWidth>Claim Rewards</PrimaryButton>
      </div>
    </div>
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

function GoldDivider() {
  return (
    <div style={{
      flex: 1,
      height: '1px',
      background: 'linear-gradient(90deg, transparent 0%, var(--color-gold-dark) 30%, var(--color-gold-mid) 50%, var(--color-gold-dark) 70%, transparent 100%)',
    }} />
  )
}

/* ── New atoms ───────────────────────────── */

function IconButton({ children, size = 34, label, variant = 'default', onClick }: { children: React.ReactNode; size?: number; label?: string; variant?: 'default' | 'danger'; onClick?: () => void }) {
  return (
    <button
      type="button"
      className="icon-btn"
      aria-label={label}
      onClick={onClick}
      style={{
        width: size, height: size, fontSize: Math.round(size * 0.42),
        ...(variant === 'danger' ? { borderColor: '#6b1010', color: '#e08080' } : {}),
      }}
    >{children}</button>
  )
}

// size = width in px; height is derived at a fixed 4:5 portrait ratio.
function Avatar({ size = 56, level, state = 'available' }: { size?: number; level?: number; state?: 'available' | 'busy' | 'locked' }) {
  const width = size
  const height = Math.round(size * 1.25)
  const ringColor = state === 'busy' ? 'var(--color-warning)' : state === 'locked' ? '#444' : 'var(--color-gold-mid)'
  return (
    <div style={{ position: 'relative', width, height, flexShrink: 0 }}>
      <div style={{
        width: '100%', height: '100%', borderRadius: 4, overflow: 'hidden',
        border: `2px solid ${ringColor}`,
        background: 'linear-gradient(180deg, #1a0608 0%, #0d0304 100%)',
        boxShadow: state === 'available'
          ? '0 0 0 1px #080101, inset 0 2px 6px rgba(0,0,0,0.6), 0 0 10px rgba(200,140,30,0.2)'
          : '0 0 0 1px #080101, inset 0 2px 6px rgba(0,0,0,0.6)',
        opacity: state === 'locked' ? 0.5 : 1,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{ color: 'var(--color-text-muted)', fontSize: 10, letterSpacing: 1, textTransform: 'uppercase' }}>{state === 'locked' ? '🔒' : 'IMG'}</span>
      </div>
      {level !== undefined && (
        <span style={{
          position: 'absolute', bottom: -7, left: '50%', transform: 'translateX(-50%)',
          background: 'linear-gradient(180deg, #2a1a08, #120a02)', border: '2px solid var(--color-gold-mid)',
          borderRadius: 10, padding: '1px 7px', fontSize: 10, fontWeight: 'bold', color: 'var(--color-gold-light)',
          boxShadow: '0 0 0 1px #080101, 0 1px 3px rgba(0,0,0,0.7)', whiteSpace: 'nowrap',
        }}>Lv {level}</span>
      )}
      {state === 'busy' && (
        <span style={{ position: 'absolute', top: -5, right: -5, width: 13, height: 13, borderRadius: '50%', background: 'var(--color-warning)', border: '2px solid #0d0304', boxShadow: '0 0 6px rgba(140,96,32,0.8)' }} />
      )}
    </div>
  )
}

function CountBadge({ count }: { count: number }) {
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

function NotificationDot() {
  return <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: 'radial-gradient(circle at 40% 35%, #ff6a6a, #8c2020)', boxShadow: '0 0 8px rgba(180,30,30,0.7), 0 0 0 1px #080101' }} />
}

function Spinner({ size = 28 }: { size?: number }) {
  return <span className="spinner-fantasy" style={{ width: size, height: size }} />
}

const ALERT_STYLES: Record<string, { border: string; bg: string; accent: string; glow: string; icon: string }> = {
  success: { border: '#4a8c3f', bg: 'rgba(74,140,63,0.18)',  accent: '#8ee59c', glow: 'rgba(74,140,63,0.3)',  icon: '✓' },
  error:   { border: '#d83232', bg: 'rgba(200,40,40,0.22)',  accent: '#ff9090', glow: 'rgba(200,40,40,0.4)',  icon: '✕' },
  warning: { border: '#c8962a', bg: 'rgba(200,150,42,0.18)', accent: '#f0d060', glow: 'rgba(200,150,42,0.3)', icon: '⚠' },
  info:    { border: '#3a86d8', bg: 'rgba(58,134,216,0.22)', accent: '#a8d2f5', glow: 'rgba(58,134,216,0.4)', icon: 'ℹ' },
}

function Alert({ variant, children }: { variant: 'success' | 'error' | 'warning' | 'info'; children: React.ReactNode }) {
  const s = ALERT_STYLES[variant]
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 11, padding: '11px 14px', borderRadius: 5, maxWidth: 440,
      border: `2px solid ${s.border}`,
      background: s.bg,
      boxShadow: `0 0 0 1px #080101, inset 0 1px 0 rgba(255,255,255,0.05), 0 0 14px ${s.glow}`,
    }}>
      <span style={{ color: s.accent, fontSize: 16, fontWeight: 'bold', textShadow: `0 0 8px ${s.glow}` }}>{s.icon}</span>
      <span style={{ color: 'var(--color-text-primary)', fontSize: 13.5 }}>{children}</span>
    </div>
  )
}

function Tabs({ tabs }: { tabs: string[] }) {
  const [active, setActive] = useState(tabs[0])
  return (
    <div style={{ display: 'flex', borderBottom: '2px solid var(--color-gold-dark)' }}>
      {tabs.map(t => (
        <button key={t} onClick={() => setActive(t)} className={active === t ? 'tab tab--active' : 'tab'}>{t}</button>
      ))}
    </div>
  )
}

function SegmentedControl({ options }: { options: string[] }) {
  const [active, setActive] = useState(options[0])
  return (
    <div className="segmented">
      {options.map(o => (
        <button key={o} onClick={() => setActive(o)} className={active === o ? 'is-active' : ''}>{o}</button>
      ))}
    </div>
  )
}

// Custom dropdown — fully styled list (native <select> can't restyle its open menu).
function CustomSelect({ options, initial }: { options: { value: string; label: string }[]; initial?: string }) {
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState(initial ?? options[0].value)
  const current = options.find(o => o.value === value) ?? options[0]
  return (
    <div style={{ position: 'relative', maxWidth: 240 }}>
      <button
        type="button"
        className="select-fantasy"
        onClick={() => setOpen(o => !o)}
        style={{ width: '100%', textAlign: 'left' }}
      >{current.label}</button>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 50 }} />
          <ul className="select-list" style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 51 }}>
            {options.map(o => (
              <li key={o.value}>
                <button
                  type="button"
                  className={o.value === value ? 'select-option is-selected' : 'select-option'}
                  onClick={() => { setValue(o.value); setOpen(false) }}
                >{o.label}</button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

function formatRemaining(ms: number): string {
  if (ms <= 0) return 'Ready'
  const totalSec = Math.floor(ms / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  if (h > 0) return `${h}h ${m}m`
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

// Ticks the current time every second and re-syncs on tab focus/visibility,
// so anything derived from it (countdowns, progress) never drifts while a
// background tab is throttled. Remaining time is always computed from the
// real clock — never decremented.
function useNow(): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const tick = () => setNow(Date.now())
    const id = setInterval(tick, 1000)
    const onFocus = () => tick()
    document.addEventListener('visibilitychange', onFocus)
    window.addEventListener('focus', onFocus)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', onFocus)
      window.removeEventListener('focus', onFocus)
    }
  }, [])
  return now
}

function CountdownTimer({ durationSec, startedSecAgo = 0 }: { durationSec: number; startedSecAgo?: number }) {
  const [endsAt] = useState(() => Date.now() + (durationSec - startedSecAgo) * 1000)
  const now = useNow()
  const done = endsAt - now <= 0
  return (
    <span className="atom-heavy" style={{
      display: 'inline-flex', alignItems: 'center', gap: 7, padding: '5px 12px', borderRadius: 4,
      border: `2px solid ${done ? 'var(--color-success)' : 'var(--color-gold-dark)'}`,
      background: 'linear-gradient(180deg, #1a0a0c 0%, #100305 100%)',
      fontFamily: 'Georgia, serif', fontSize: 13,
      color: done ? '#8ee59c' : 'var(--color-text-gold)',
      textShadow: done ? '0 0 8px rgba(74,140,63,0.4)' : '0 0 6px rgba(232,192,80,0.3)',
    }}>
      <span style={{ fontSize: 12 }}>{done ? '✓' : '⏱'}</span>
      <span style={{
        // Monospace so each digit is fixed-width — the readout never reflows as it ticks.
        fontFamily: done ? 'Georgia, serif' : '"Consolas", "SF Mono", ui-monospace, monospace',
        fontVariantNumeric: 'tabular-nums',
        letterSpacing: '0.5px',
      }}>{done ? 'Ready' : formatRemaining(endsAt - now)}</span>
    </span>
  )
}

const STATUS_TONES: Record<string, { color: string; border: string; dot: string }> = {
  ready:   { color: '#8ee59c', border: '#4a8c3f', dot: '#6fd98a' },
  busy:    { color: '#e8c050', border: '#8c6020', dot: '#e8c050' },
  locked:  { color: '#9a8a78', border: '#555',    dot: '#777' },
  neutral: { color: 'var(--color-text-gold)', border: 'var(--color-gold-dark)', dot: 'var(--color-gold-mid)' },
  danger:  { color: '#ff9090', border: '#8c2020', dot: '#d83232' },
}

function StatusTag({ tone = 'neutral', children }: { tone?: keyof typeof STATUS_TONES; children: React.ReactNode }) {
  const s = STATUS_TONES[tone]
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 3,
      border: `2px solid ${s.border}`, background: 'linear-gradient(180deg, #1a0a0c 0%, #100305 100%)',
      fontFamily: 'Georgia, serif', fontSize: 11, letterSpacing: 1, textTransform: 'uppercase',
      color: s.color, boxShadow: '0 0 0 1px #080101',
    }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: s.dot, boxShadow: `0 0 5px ${s.dot}`, flexShrink: 0 }} />
      {children}
    </span>
  )
}

/* ── Modal / overlay shell (Framer Motion) ── */

function Modal({ open, onClose, children }: { open: boolean; onClose: () => void; children: React.ReactNode }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
          onClick={onClose}
          style={{
            position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(2px)',
            display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '40px 20px', overflowY: 'auto',
          }}
        >
          <motion.div
            initial={{ opacity: 0, y: 18, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 18, scale: 0.97 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            onClick={e => e.stopPropagation()}
            style={{ position: 'relative', maxWidth: '100%' }}
          >
            <div style={{ position: 'absolute', top: -12, right: -12, zIndex: 1 }}>
              <IconButton label="Close" onClick={onClose}>✕</IconButton>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/* ── Mission cards (dashboard molecules) ──── */

function MissionCard({ name, stage, coins, duration, dropCount, onSend }: { name: string; stage: number; coins: number; duration: string; dropCount: number; onSend?: () => void }) {
  return (
    <div style={{
      width: 250, borderRadius: 8, border: '3px solid var(--color-gold-mid)',
      background: 'linear-gradient(180deg, #1e0a0c 0%, #130406 100%)',
      boxShadow: ['0 0 0 1px #080101', 'inset 0 1px 0 rgba(255,255,255,0.06)', 'inset 0 2px 8px rgba(0,0,0,0.6)', '0 6px 18px rgba(0,0,0,0.75)'].join(', '),
      overflow: 'hidden',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
        padding: '10px 12px', borderBottom: '2px solid var(--color-gold-dark)',
        background: 'linear-gradient(180deg, rgba(200,145,42,0.15) 0%, rgba(200,145,42,0.04) 100%)',
      }}>
        <span style={{ color: 'var(--color-gold-light)', fontSize: 14, fontWeight: 'bold', textShadow: '0 0 10px rgba(240,208,96,0.4)' }}>{name}</span>
        <StatusTag tone="neutral">Stage {stage}</StatusTag>
      </div>
      <div style={{ padding: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 10 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <IconSlot size={16} /><span style={{ color: 'var(--color-text-gold)', fontSize: 13, fontWeight: 'bold' }}>{coins}</span>
          </span>
          <span style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>⏱ {duration}</span>
        </div>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 11, marginBottom: 12, fontStyle: 'italic' }}>{dropCount} possible drops</p>
        <PrimaryButton fullWidth onClick={onSend}>Send Party</PrimaryButton>
      </div>
    </div>
  )
}

function ActiveMissionCard({ name, partySize, durationSec, startedSecAgo, onClaim }: { name: string; partySize: number; durationSec: number; startedSecAgo: number; onClaim?: () => void }) {
  const [endsAt] = useState(() => Date.now() + (durationSec - startedSecAgo) * 1000)
  const [startAt] = useState(() => Date.now() - startedSecAgo * 1000)
  const now = useNow()
  const remaining = Math.max(0, endsAt - now)
  const done = remaining <= 0
  const pct = Math.min(100, Math.max(0, ((now - startAt) / (durationSec * 1000)) * 100))
  return (
    <div style={{
      width: 250, borderRadius: 8, border: `3px solid ${done ? 'var(--color-success)' : 'var(--color-gold-mid)'}`,
      background: 'linear-gradient(180deg, #1e0a0c 0%, #130406 100%)',
      boxShadow: ['0 0 0 1px #080101', 'inset 0 1px 0 rgba(255,255,255,0.06)', 'inset 0 2px 8px rgba(0,0,0,0.6)', '0 6px 18px rgba(0,0,0,0.75)'].join(', '),
      overflow: 'hidden',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
        padding: '10px 12px', borderBottom: '2px solid var(--color-gold-dark)',
        background: 'linear-gradient(180deg, rgba(200,145,42,0.12) 0%, rgba(200,145,42,0.03) 100%)',
      }}>
        <span style={{ color: 'var(--color-gold-light)', fontSize: 14, fontWeight: 'bold' }}>{name}</span>
        <div style={{ display: 'flex', gap: 3 }}>
          {Array.from({ length: partySize }).map((_, i) => <Avatar key={i} size={26} />)}
        </div>
      </div>
      <div style={{ padding: 12 }}>
        <div style={{ marginBottom: 10 }}>
          <ProgressBar value={pct} label="" color={done ? 'var(--color-success)' : '#8c2020'} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{
            fontFamily: '"Consolas", ui-monospace, monospace', fontVariantNumeric: 'tabular-nums', fontSize: 13,
            color: done ? '#8ee59c' : 'var(--color-text-gold)',
          }}>{done ? '✓ Ready' : `⏱ ${formatRemaining(remaining)}`}</span>
          {done
            ? <span style={{ width: 130 }}><PrimaryButton fullWidth onClick={onClaim}>Claim</PrimaryButton></span>
            : <span style={{ color: 'var(--color-text-muted)', fontSize: 11, fontStyle: 'italic' }}>In progress…</span>}
        </div>
      </div>
    </div>
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

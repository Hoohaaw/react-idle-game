import { useState, useRef } from 'react'
import { PrimaryButton, SecondaryButton, DangerButton, GhostButton } from '../components/atoms/Button'
import { Panel } from '../components/atoms/Panel'
import { IconSlot } from '../components/atoms/IconSlot'
import { ResourceChip } from '../components/atoms/ResourceChip'
import { ProgressBar } from '../components/atoms/ProgressBar'
import { RarityBadge } from '../components/atoms/RarityBadge'
import { StatPill } from '../components/atoms/StatPill'
import { LevelBadge } from '../components/atoms/LevelBadge'
import { CoinDisplay } from '../components/atoms/CoinDisplay'
import { GoldDivider } from '../components/atoms/GoldDivider'
import { IconButton } from '../components/atoms/IconButton'
import { Avatar } from '../components/atoms/Avatar'
import { CountBadge, NotificationDot } from '../components/atoms/CountBadge'
import { Spinner } from '../components/atoms/Spinner'
import { Alert } from '../components/atoms/Alert'
import { Tabs } from '../components/atoms/Tabs'
import { SegmentedControl } from '../components/atoms/SegmentedControl'
import { CustomSelect } from '../components/atoms/CustomSelect'
import { CountdownTimer } from '../components/atoms/CountdownTimer'
import { StatusTag } from '../components/atoms/StatusTag'
import { RoleBadge } from '../components/atoms/RoleBadge'
import { ClassBadge } from '../components/atoms/ClassBadge'
import { GameHeader } from '../components/organisms/GameHeader'
import type { MissionDrops } from '../types/loot'
import { LootTable } from '../components/organisms/LootTable'
import { MissionDispatch } from '../components/organisms/MissionDispatch'
import { ClaimReward } from '../components/organisms/ClaimReward'
import { Modal } from '../components/organisms/Modal'
import { MissionCard } from '../components/molecules/MissionCard'
import { ActiveMissionCard } from '../components/molecules/ActiveMissionCard'
import { MineCard } from '../components/molecules/MineCard'
import { ActiveGatherCard } from '../components/molecules/ActiveGatherCard'
import { CharacterCard } from '../components/organisms/CharacterCard'
import { useNow } from '../hooks/useNow'
import { formatRemaining } from '../lib/time'
import { resourceHeaderStyle } from '../lib/resources'

export default function DesignPage() {
  const [modal, setModal] = useState<null | 'claim' | 'dispatch'>(null)
  const [abandonTarget, setAbandonTarget] = useState<string | null>(null)
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
        {(['sm', 'md', 'lg'] as const).map(size => (
          <div key={size} style={{ marginBottom: '14px' }}>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '8px' }}>
              {size === 'sm' ? 'Small' : size === 'md' ? 'Medium' : 'Large'}
            </p>
            <Row>
              <RarityBadge rarity="Common" size={size} />
              <RarityBadge rarity="Uncommon" size={size} />
              <RarityBadge rarity="Rare" size={size} />
              <RarityBadge rarity="Epic" size={size} />
              <RarityBadge rarity="Legendary" size={size} />
            </Row>
          </div>
        ))}
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

      {/* ── ROLE BADGES ──────────────────────── */}
      <Section title="Role Badges">
        {(['md', 'sm'] as const).map(size => (
          <div key={size} style={{ marginBottom: '14px' }}>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '8px' }}>
              {size === 'md' ? 'Medium' : 'Small'}
            </p>
            <Row>
              <RoleBadge role="tank" size={size} />
              <RoleBadge role="damage" size={size} />
              <RoleBadge role="healer" size={size} />
              <RoleBadge role="utility" size={size} />
              <RoleBadge role="gatherer" size={size} />
            </Row>
          </div>
        ))}
      </Section>

      {/* ── CLASS BADGES ─────────────────────── */}
      <Section title="Class & Role Badges">
        <p style={{ color: 'var(--color-text-muted)', fontSize: '11px', lineHeight: 1.5, marginBottom: '12px' }}>
          ClassBadge (neutral gold = <em>who they are</em>) sits beside the colour-coded RoleBadge
          (<em>what they do</em>). Shown together as the character's identity line.
        </p>
        {(['md', 'sm'] as const).map(size => (
          <div key={size} style={{ marginBottom: '14px' }}>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '8px' }}>
              {size === 'md' ? 'Medium' : 'Small'}
            </p>
            <Row>
              <ClassBadge charClass="Death Knight" size={size} />
              <ClassBadge charClass="Mage" size={size} />
              <ClassBadge charClass="Rogue" size={size} />
              <ClassBadge charClass="Priest" size={size} />
            </Row>
          </div>
        ))}
        <p style={{ color: 'var(--color-text-muted)', fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', margin: '4px 0 8px' }}>
          Identity line (both together)
        </p>
        <Row>
          <ClassBadge charClass="Death Knight" />
          <RoleBadge role="damage" />
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
        <CharacterCard name="Alexandros Mograine" charClass="Death Knight" level={24} xpCurrent={620} xpNeeded={1000} />
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

      {/* ── ACTIVE GATHERING FEED ────────────── */}
      <Section title="Active Gathering (Collector)">
        <Row>
          <ActiveGatherCard resource="Copper" gatherer="Lyra Swift" intervalSec={30} yieldPerTick={5} assignedSecAgo={18} bonus="+10% gather speed" />
          <ActiveGatherCard resource="Gold" gatherer="Alexandros" intervalSec={300} yieldPerTick={25} assignedSecAgo={140} bonus="+20% yield" />
          <ActiveGatherCard resource="Platinum" gatherer="Sally Whitemane" intervalSec={900} yieldPerTick={75} assignedSecAgo={600} />
        </Row>
      </Section>

      {/* ── MINE CARDS ───────────────────────── */}
      <Section title="Mine Cards (Mines)">
        <Row>
          <MineCard resource="Copper" tier="Ore" intervalSec={30} yieldPerTick={5} />
          <MineCard resource="Copper" tier="Ore" intervalSec={30} yieldPerTick={5} gatherer="Lyra Swift" assignedSecAgo={18} bonus="+10% gather speed" />
          <MineCard resource="Gold" tier="Ore" intervalSec={300} yieldPerTick={25} gatherer="Alexandros" assignedSecAgo={140} bonus="+20% yield" />
          <MineCard resource="Wood" tier="Material" intervalSec={20} yieldPerTick={4} />
          <MineCard resource="Platinum" tier="Ore" intervalSec={900} yieldPerTick={75} gatherer="Sally Whitemane" assignedSecAgo={600} />
        </Row>
      </Section>

      {/* ── PARTY ROSTER (DRAFT) ─────────────── */}
      <Section title="Party Roster (draft)">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 300 }}>
          <RosterCard name="Sally Whitemane" charClass="Priest" level={15} activity="idle" />
          <RosterCard name="Fandral Staghelm" charClass="Druid" level={9} activity="idle" />
          <RosterCard name="Alexandros Mograine" charClass="Death Knight" level={24} activity="mission" detail="Frozen Pass" durationSec={600} startedSecAgo={140} onAbandon={setAbandonTarget} />
          <RosterCard name="Lyra Swift" charClass="Rogue" level={12} activity="gather" detail="Copper" intervalSec={30} yieldPerTick={5} assignedSecAgo={18} />
          <RosterCard name="Tyra Oakheart" charClass="Hunter" level={9} activity="gather" detail="Wood" intervalSec={20} yieldPerTick={4} assignedSecAgo={35} />
        </div>
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

      {/* Abandon-mission confirmation (per the confirm-required abandon rule) */}
      <Modal open={abandonTarget !== null} onClose={() => setAbandonTarget(null)}>
        <div style={{
          width: 340, borderRadius: 8, border: '3px solid var(--color-gold-mid)', overflow: 'hidden',
          background: 'linear-gradient(180deg, #1e0a0c 0%, #130406 100%)',
          boxShadow: ['0 0 0 1px #080101', 'inset 0 1px 0 rgba(255,255,255,0.06)', '0 8px 24px rgba(0,0,0,0.85)'].join(', '),
          fontFamily: 'Georgia, serif',
        }}>
          <div style={{ padding: '12px 16px', borderBottom: '2px solid #6b1010', background: 'linear-gradient(180deg, rgba(140,32,32,0.18) 0%, rgba(140,32,32,0.04) 100%)' }}>
            <p style={{ color: '#e08080', fontSize: 16, fontWeight: 'bold', letterSpacing: 0.5 }}>Abandon Mission?</p>
          </div>
          <div style={{ padding: 16 }}>
            <p style={{ color: 'var(--color-text-primary)', fontSize: 13, lineHeight: 1.55, marginBottom: 16 }}>
              Abandon <span style={{ color: 'var(--color-gold-light)', fontWeight: 'bold' }}>{abandonTarget}</span>? The party will be freed, but <span style={{ color: '#e08080' }}>all rewards from this mission will be lost</span>.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <SecondaryButton onClick={() => setAbandonTarget(null)}>Cancel</SecondaryButton>
              <DangerButton onClick={() => setAbandonTarget(null)}>Abandon</DangerButton>
            </div>
          </div>
        </div>
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

/* ── Party roster card (draft) ───────────── */
// One character in the roster: portrait + name/class/level + current status.
// Free characters read as selectable; busy ones are dimmed and, on hover, reveal an
// interactive popup with activity details + an Abandon (mission) / Stop (gather) action.
// Reused across Team / Mines / mission dispatch.
function PopupRow({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
      <span style={{ color: 'var(--color-text-muted)', fontSize: 11, letterSpacing: 0.5 }}>{label}</span>
      <span style={{ color: valueColor ?? 'var(--color-text-gold)', fontSize: 12, fontWeight: 'bold', fontFamily: '"Consolas", ui-monospace, monospace', fontVariantNumeric: 'tabular-nums' }}>{value}</span>
    </div>
  )
}

function RosterCard({ name, charClass, level, activity, detail, durationSec, startedSecAgo, intervalSec, yieldPerTick, assignedSecAgo, onAbandon }: {
  name: string; charClass: string; level: number
  activity: 'idle' | 'mission' | 'gather'; detail?: string
  durationSec?: number; startedSecAgo?: number
  intervalSec?: number; yieldPerTick?: number; assignedSecAgo?: number
  onAbandon?: (mission: string) => void
}) {
  const free = activity === 'idle'
  const status = free ? 'Available' : activity === 'mission' ? 'On Mission' : 'Gathering'
  const detailIcon = activity === 'mission' ? '⚔' : activity === 'gather' ? '⛏' : ''

  // Interactive hover popup — kept open while hovering the card or the popup itself
  // (a short close-delay bridges the gap between them so the action stays clickable).
  const [open, setOpen] = useState(false)
  const closeTimer = useRef<number | undefined>(undefined)
  const showPopup = () => { if (closeTimer.current) window.clearTimeout(closeTimer.current); setOpen(true) }
  const hidePopup = () => { closeTimer.current = window.setTimeout(() => setOpen(false), 120) }

  const now = useNow()
  const [anchorTs] = useState(() => Date.now() - (startedSecAgo ?? assignedSecAgo ?? 0) * 1000)
  const missionRemMs = Math.max(0, (durationSec ?? 0) * 1000 - (now - anchorTs))
  const gIntervalMs = (intervalSec ?? 1) * 1000
  const gElapsed = now - anchorTs
  const gBanked = Math.floor(gElapsed / gIntervalMs) * (yieldPerTick ?? 0)
  const gNextMs = gIntervalMs - (gElapsed % gIntervalMs)

  return (
    <div
      style={{ position: 'relative', width: '100%' }}
      onMouseEnter={free ? undefined : showPopup}
      onMouseLeave={free ? undefined : hidePopup}
    >
      <div style={{
        width: '100%', borderRadius: 8,
        border: `2px solid ${free ? 'var(--color-gold-mid)' : 'var(--color-gold-dark)'}`,
        background: 'linear-gradient(180deg, #1e0a0c 0%, #130406 100%)',
        boxShadow: free
          ? ['0 0 0 1px #080101', 'inset 0 1px 0 rgba(255,255,255,0.06)', '0 0 12px rgba(200,140,30,0.28)', '0 4px 12px rgba(0,0,0,0.7)'].join(', ')
          : ['0 0 0 1px #080101', 'inset 0 1px 0 rgba(255,255,255,0.05)', '0 4px 12px rgba(0,0,0,0.7)'].join(', '),
        opacity: free ? 1 : 0.82,
        padding: 12, display: 'flex', gap: 11,
        cursor: free ? 'default' : 'help',
      }}>
        <Avatar size={62} state={free ? 'available' : 'busy'} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ color: 'var(--color-gold-light)', fontSize: 14, fontWeight: 'bold', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textShadow: '0 0 8px rgba(240,208,96,0.3)' }}>{name}</p>
          <p style={{ color: 'var(--color-text-muted)', fontSize: 11, marginBottom: 8 }}>{charClass} · Lv {level}</p>
          <StatusTag tone={free ? 'ready' : 'busy'}>{status}</StatusTag>
          {detail && <p style={{ color: 'var(--color-text-muted)', fontSize: 11, fontStyle: 'italic', marginTop: 6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{detailIcon} {detail}</p>}
          {free && <p style={{ color: '#8ee59c', fontSize: 11, marginTop: 6 }}>Ready to send</p>}
        </div>
      </div>

      {/* Hover popup: activity details + abandon/stop action */}
      {open && !free && (
        <div
          onMouseEnter={showPopup}
          onMouseLeave={hidePopup}
          style={{
            position: 'absolute', left: '100%', top: 0, marginLeft: 8, width: 220, zIndex: 50,
            borderRadius: 8, overflow: 'hidden', fontFamily: 'Georgia, serif',
            border: '2px solid var(--color-gold-mid)',
            background: 'linear-gradient(180deg, #2a0f12 0%, #120407 100%)',
            boxShadow: ['0 0 0 1px #080101', 'inset 0 1px 0 rgba(255,255,255,0.07)', '0 8px 24px rgba(0,0,0,0.85)'].join(', '),
          }}
        >
          {/* Header */}
          <div style={{
            padding: '10px 12px', borderBottom: '2px solid var(--color-gold-dark)',
            ...(activity === 'gather'
              ? resourceHeaderStyle(detail ?? '')
              : { background: 'linear-gradient(180deg, rgba(200,145,42,0.16) 0%, rgba(200,145,42,0.03) 100%)' }),
          }}>
            <p style={{ color: 'var(--color-text-muted)', fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase' }}>{status}</p>
            <p style={{ color: 'var(--color-gold-light)', fontSize: 14, fontWeight: 'bold', textShadow: '0 0 10px rgba(240,208,96,0.35)' }}>{detailIcon} {detail}</p>
          </div>

          {/* Body */}
          <div style={{ padding: '11px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {activity === 'mission' ? (
              <>
                <PopupRow label="Time left" value={`⏱ ${formatRemaining(missionRemMs)}`} />
                <p style={{ color: 'var(--color-text-muted)', fontSize: 10, fontStyle: 'italic', marginTop: 2 }}>Rewards are lost if abandoned.</p>
              </>
            ) : (
              <>
                <PopupRow label="Banked" value={`+${gBanked}`} valueColor="var(--color-success)" />
                <PopupRow label={`Next +${yieldPerTick ?? 0}`} value={`⏱ ${formatRemaining(gNextMs)}`} />
              </>
            )}
          </div>

          {/* Action */}
          <div style={{ padding: 12, borderTop: '1px solid var(--color-gold-dark)' }}>
            <DangerButton onClick={activity === 'mission' ? () => onAbandon?.(detail ?? '') : undefined}>
              {activity === 'mission' ? 'Abandon Mission' : 'Stop Gathering'}
            </DangerButton>
          </div>
        </div>
      )}
    </div>
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

// Demo loot tables for the showcase (independent per-(item, rarity) chances — they do NOT sum to 100).
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


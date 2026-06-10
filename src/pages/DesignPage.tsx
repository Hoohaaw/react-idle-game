import { useState, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { RARITY_STYLES } from '../lib/rarity'
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
import { Tooltip } from '../components/atoms/Tooltip'
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
import { useNow } from '../hooks/useNow'
import { formatRemaining } from '../lib/time'
import { resourceHeaderStyle, RESOURCE_COLOR } from '../lib/resources'
import { ItemTile } from '../components/molecules/ItemTile'
import { ItemTooltip } from '../components/organisms/ItemTooltip'
import { MOCK_INVENTORY } from '../lib/mockInventory'
import type { Item } from '../types/item'

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

      {/* ── CRAFTING CIRCLE (PROTOTYPE) ──────── */}
      <Section title="Crafting Circle (prototype)">
        <CraftingPrototype />
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

/* ── Crafting circle (prototype) ─────────── */

// A decorative ring of the crafting circle.
function Ring({ d, faint = false }: { d: number; faint?: boolean }) {
  return (
    <div style={{
      position: 'absolute', left: '50%', top: '50%', width: d, height: d, transform: 'translate(-50%,-50%)',
      borderRadius: '50%', pointerEvents: 'none',
      border: `1px solid rgba(200,145,42,${faint ? 0.18 : 0.4})`,
      boxShadow: faint ? 'none' : '0 0 14px rgba(200,145,42,0.12), inset 0 0 14px rgba(200,145,42,0.08)',
    }} />
  )
}

// One slot in the circle: empty placeholder, a filled reagent, or the center result.
function CraftSlot({ item, size, result = false, onClick }: { item: Item | null; size: number; result?: boolean; onClick?: () => void }) {
  const s = item ? (RARITY_STYLES[item.rarity] ?? RARITY_STYLES.Common) : null
  return (
    <div
      onClick={onClick}
      title={item ? `${item.name} — click to remove` : undefined}
      style={{
        width: size, height: size, borderRadius: 8,
        border: `${result ? 3 : 2}px solid ${s ? s.border : result ? 'var(--color-gold-mid)' : 'var(--color-gold-dark)'}`,
        background: item ? 'linear-gradient(180deg, #1a0a0c 0%, #100305 100%)' : 'radial-gradient(circle at 50% 40%, #1a0608 0%, #0c0203 100%)',
        boxShadow: [
          '0 0 0 1px #080101',
          'inset 0 1px 0 rgba(255,255,255,0.05)',
          item && s ? `0 0 12px ${s.glow}` : result ? '0 0 18px rgba(240,208,96,0.35)' : 'inset 0 2px 8px rgba(0,0,0,0.6)',
          '0 3px 8px rgba(0,0,0,0.6)',
        ].join(', '),
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: onClick ? 'pointer' : 'default',
      }}
    >
      {item
        ? <IconSlot size={Math.round(size * 0.52)} />
        : <span style={{ color: result ? 'var(--color-gold-mid)' : 'var(--color-text-muted)', fontSize: result ? 11 : 22, letterSpacing: result ? 1.5 : 0, fontWeight: result ? 'bold' : 'normal', textTransform: 'uppercase' }}>{result ? 'Result' : '+'}</span>}
    </div>
  )
}

// Lays out the crafting circle (+ inventory) beside the recipe book, with the book
// openable/closable via a smooth Framer Motion slide + fade (not an instant pop).
function CraftingPrototype() {
  const [bookOpen, setBookOpen] = useState(true)
  return (
    <div style={{ display: 'flex', gap: 32, alignItems: 'flex-start', flexWrap: 'wrap' }}>
      <CraftingCircle />
      <AnimatePresence mode="wait" initial={false}>
        {bookOpen ? (
          <motion.div
            key="book"
            initial={{ opacity: 0, x: 24, scale: 0.98 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 24, scale: 0.98 }}
            transition={{ duration: 0.17, ease: 'easeOut' }}
            style={{ flex: '1 1 280px', minWidth: 280 }}
          >
            <RecipeBook recipes={RECIPES} onClose={() => setBookOpen(false)} />
          </motion.div>
        ) : (
          <motion.div key="opener" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.11 }}>
            <SecondaryButton onClick={() => setBookOpen(true)}>📖 Show Recipe Book</SecondaryButton>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// Six reagent slots arranged on a ring around a central result slot. Clicking an
// inventory item drops it into the next open reagent slot; clicking a filled slot
// clears it. The center is the (future) crafted output — no recipe logic yet.
function CraftingCircle() {
  const COUNT = 6
  const [reagents, setReagents] = useState<(Item | null)[]>(Array(COUNT).fill(null))

  const place = (item: Item) => setReagents(prev => {
    const idx = prev.findIndex(r => r === null)
    if (idx === -1) return prev
    const next = [...prev]; next[idx] = item; return next
  })
  const removeAt = (i: number) => setReagents(prev => prev.map((r, idx) => idx === i ? null : r))
  const clearAll = () => setReagents(Array(COUNT).fill(null))
  const filled = reagents.filter(Boolean).length

  const SIZE = 300, RADIUS = 110, SLOT = 58, CENTER = 88

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, width: 340, flexShrink: 0 }}>
      {/* The crafting circle */}
      <div style={{ position: 'relative', width: SIZE, height: SIZE }}>
        <Ring d={RADIUS * 2} />
        <Ring d={CENTER + 30} faint />
        <div style={{ position: 'absolute', left: '50%', top: '50%', width: 150, height: 150, transform: 'translate(-50%,-50%)', borderRadius: '50%', background: 'radial-gradient(circle, rgba(240,208,96,0.10) 0%, transparent 70%)', pointerEvents: 'none' }} />

        {/* reagent slots, evenly spaced (one at top) */}
        {reagents.map((item, i) => {
          const a = (-90 + i * 60) * Math.PI / 180
          const x = SIZE / 2 + RADIUS * Math.cos(a)
          const y = SIZE / 2 + RADIUS * Math.sin(a)
          return (
            <div key={i} style={{ position: 'absolute', left: x, top: y, transform: 'translate(-50%,-50%)' }}>
              <CraftSlot item={item} size={SLOT} onClick={item ? () => removeAt(i) : undefined} />
            </div>
          )
        })}

        {/* center result slot */}
        <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)' }}>
          <CraftSlot item={null} size={CENTER} result />
        </div>
      </div>

      {/* actions */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 10 }}>
        <SecondaryButton onClick={clearAll}>Clear</SecondaryButton>
        <PrimaryButton disabled={filled === 0}>Craft</PrimaryButton>
      </div>

      {/* Inventory — below the circle (column); click an item to drop it in */}
      <div style={{ width: '100%' }}>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 }}>
          Inventory — click to add a reagent <span style={{ color: 'var(--color-text-gold)' }}>({filled}/{COUNT})</span>
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(76px, 1fr))', gap: 10 }}>
          {MOCK_INVENTORY.map(item => (
            <ItemTooltip key={`${item.name}-${item.rarity}`} item={item}>
              <ItemTile item={item} onClick={() => place(item)} />
            </ItemTooltip>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ── Recipe book (prototype) ─────────────── */

type Recipe = {
  id: string
  name: string
  kind: 'enhance' | 'create'
  result: string
  resources: { resource: string; qty: number }[]
  discovered: boolean
}

// A small fixed recipe set (Both: enhance + create). Hybrid reveal: name + result are
// always visible; the exact resources stay hidden until the recipe is discovered/crafted.
const RECIPES: Recipe[] = [
  { id: 'str', name: 'Strength Infusion', kind: 'enhance', result: '+5 Strength to an item', resources: [{ resource: 'Iron', qty: 3 }, { resource: 'Bronze', qty: 2 }], discovered: true },
  { id: 'helm', name: 'Ironforged Helm', kind: 'create', result: 'Ironforged Helm (Head)', resources: [{ resource: 'Iron', qty: 5 }, { resource: 'Coal', qty: 2 }], discovered: true },
  { id: 'agi', name: 'Agility Etching', kind: 'enhance', result: '+5 Agility to an item', resources: [{ resource: 'Silver', qty: 2 }, { resource: 'Wood', qty: 4 }], discovered: false },
  { id: 'vigor', name: 'Vigor Tempering', kind: 'enhance', result: '+30 Health to an item', resources: [{ resource: 'Stone', qty: 5 }, { resource: 'Coal', qty: 3 }], discovered: false },
  { id: 'ring', name: 'Silvered Band', kind: 'create', result: 'Silvered Band (Ring)', resources: [{ resource: 'Silver', qty: 4 }, { resource: 'Gold', qty: 1 }], discovered: false },
  { id: 'blade', name: 'Platinum Greatblade', kind: 'create', result: 'Platinum Greatblade (Weapon)', resources: [{ resource: 'Platinum', qty: 3 }, { resource: 'Iron', qty: 6 }, { resource: 'Coal', qty: 4 }], discovered: false },
]

function RecipeBook({ recipes, onClose }: { recipes: Recipe[]; onClose?: () => void }) {
  const found = recipes.filter(r => r.discovered).length
  return (
    <div style={{
      width: '100%', borderRadius: 8, overflow: 'hidden',
      border: '2px solid var(--color-gold-mid)',
      background: 'linear-gradient(180deg, #1e0a0c 0%, #130406 100%)',
      boxShadow: ['0 0 0 1px #080101', 'inset 0 1px 0 rgba(255,255,255,0.06)', '0 6px 18px rgba(0,0,0,0.75)'].join(', '),
    }}>
      <div style={{ padding: '10px 14px', borderBottom: '2px solid var(--color-gold-dark)', background: 'linear-gradient(180deg, rgba(200,145,42,0.16) 0%, rgba(200,145,42,0.03) 100%)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ color: 'var(--color-gold-light)', fontSize: 14, fontWeight: 'bold', letterSpacing: 0.5, textShadow: '0 0 10px rgba(240,208,96,0.35)' }}>📖 Recipe Book</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ color: 'var(--color-text-muted)', fontSize: 11 }}>{found}/{recipes.length} discovered</span>
          {onClose && <IconButton label="Close recipe book" onClick={onClose}>✕</IconButton>}
        </span>
      </div>
      <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {recipes.map(r => <RecipeRow key={r.id} recipe={r} />)}
      </div>
    </div>
  )
}

function RecipeRow({ recipe }: { recipe: Recipe }) {
  const { discovered, kind, name, result, resources } = recipe
  return (
    <div style={{
      borderRadius: 6, padding: 10,
      border: `1px solid ${discovered ? 'var(--color-gold-dark)' : '#3a2a14'}`,
      background: discovered ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.25)',
      opacity: discovered ? 1 : 0.9,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <TypeBadge kind={kind} />
          <span style={{ color: 'var(--color-text-primary)', fontSize: 13, fontWeight: 'bold', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</span>
        </div>
        {!discovered && <span title="Undiscovered" style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>🔒</span>}
      </div>

      <p style={{ color: kind === 'enhance' ? '#f0a030' : '#5b9bd5', fontSize: 11, marginTop: 4 }}>
        {kind === 'enhance' ? '⚒ ' : '✦ '}{result}
      </p>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8, alignItems: 'center' }}>
        {discovered
          ? resources.map(res => <ResourceReq key={res.resource} resource={res.resource} qty={res.qty} />)
          : (
            <>
              {resources.map((_, i) => <LockedReq key={i} />)}
              <span style={{ color: 'var(--color-text-muted)', fontSize: 10, fontStyle: 'italic', marginLeft: 2 }}>craft to discover</span>
            </>
          )}
      </div>
    </div>
  )
}

function TypeBadge({ kind }: { kind: 'enhance' | 'create' }) {
  const enhance = kind === 'enhance'
  return (
    <span style={{
      padding: '1px 7px', borderRadius: 3, fontSize: 9, fontWeight: 'bold', letterSpacing: 1, textTransform: 'uppercase', flexShrink: 0,
      border: `1px solid ${enhance ? '#8a5010' : '#2a5a8a'}`,
      color: enhance ? '#f0a030' : '#5b9bd5',
      background: enhance ? 'rgba(240,160,48,0.10)' : 'rgba(91,155,213,0.12)',
    }}>{enhance ? 'Enhance' : 'Create'}</span>
  )
}

function ResourceReq({ resource, qty }: { resource: string; qty: number }) {
  const c = RESOURCE_COLOR[resource] ?? '200,145,42'
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '2px 8px', borderRadius: 4, fontSize: 11, border: `1px solid rgba(${c},0.5)`, background: `rgba(${c},0.12)`, color: 'var(--color-text-primary)' }}>
      <span style={{ width: 8, height: 8, borderRadius: 2, background: `rgb(${c})` }} />
      {resource} <span style={{ color: 'var(--color-text-gold)', fontWeight: 'bold' }}>×{qty}</span>
    </span>
  )
}

function LockedReq() {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, borderRadius: 4, border: '1px dashed var(--color-gold-dark)', color: 'var(--color-text-muted)', fontSize: 13, background: 'rgba(0,0,0,0.25)' }}>?</span>
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

import { useState } from 'react'
import { Avatar } from '../components/atoms/Avatar'
import { ProgressBar } from '../components/atoms/ProgressBar'
import { Modal } from '../components/organisms/Modal'
import { CharacterCard } from '../components/organisms/CharacterCard'

// Mock party (replaced by characters-table data later). XP is current/needed-to-level.
type PartyMember = { id: string; name: string; charClass: string; level: number; xpCurrent: number; xpNeeded: number }

const PARTY: PartyMember[] = [
  { id: 'c1', name: 'Lyra Swift',        charClass: 'Rogue',       level: 12, xpCurrent: 340, xpNeeded: 520 },
  { id: 'c2', name: 'Tyra Oakheart',     charClass: 'Hunter',      level: 9,  xpCurrent: 180, xpNeeded: 360 },
  { id: 'c3', name: 'Alexandros Mograine', charClass: 'Death Knight', level: 24, xpCurrent: 620, xpNeeded: 1000 },
  { id: 'c4', name: 'Sally Whitemane',   charClass: 'Priest',      level: 15, xpCurrent: 95,  xpNeeded: 640 },
  { id: 'c5', name: 'Fandral Staghelm',  charClass: 'Druid',       level: 9,  xpCurrent: 250, xpNeeded: 360 },
  { id: 'c6', name: 'Bron Stormhammer',  charClass: 'Warrior',     level: 18, xpCurrent: 720, xpNeeded: 820 },
]

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{
      color: 'var(--color-gold-mid)', fontSize: '12px', letterSpacing: '3px', textTransform: 'uppercase',
      marginBottom: '14px', paddingBottom: '6px', borderBottom: '1px solid var(--color-gold-dark)',
    }}>{children}</h2>
  )
}

export default function TeamPage() {
  const [openId, setOpenId] = useState<string | null>(null)
  const openMember = PARTY.find(m => m.id === openId) ?? null

  return (
    <div>
      <SectionTitle>Your Party</SectionTitle>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px' }}>
        {PARTY.map(m => (
          <PartyMemberCard key={m.id} member={m} onOpen={() => setOpenId(m.id)} />
        ))}
      </div>

      {/* Click a member → full character sheet */}
      <Modal open={openId !== null} onClose={() => setOpenId(null)}>
        {openMember && (
          <CharacterCard
            name={openMember.name}
            charClass={openMember.charClass}
            level={openMember.level}
            xpCurrent={openMember.xpCurrent}
            xpNeeded={openMember.xpNeeded}
          />
        )}
      </Modal>
    </div>
  )
}

function PartyMemberCard({ member, onOpen }: { member: PartyMember; onOpen: () => void }) {
  const [hover, setHover] = useState(false)
  const xpPct = Math.round((member.xpCurrent / member.xpNeeded) * 100)

  return (
    <div
      onClick={onOpen}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        cursor: 'pointer',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px',
        padding: '18px 16px',
        borderRadius: '8px',
        border: `2px solid ${hover ? 'var(--color-gold-light)' : 'var(--color-gold-mid)'}`,
        background: 'linear-gradient(180deg, #1e0a0c 0%, #130406 100%)',
        boxShadow: (hover
          ? ['0 0 0 1px #080101', 'inset 0 1px 0 rgba(255,255,255,0.07)', '0 0 18px rgba(240,208,96,0.4)', '0 6px 16px rgba(0,0,0,0.75)']
          : ['0 0 0 1px #080101', 'inset 0 1px 0 rgba(255,255,255,0.06)', '0 0 12px rgba(200,140,30,0.18)', '0 4px 12px rgba(0,0,0,0.7)']
        ).join(', '),
        transform: hover ? 'translateY(-2px)' : 'none',
        transition: 'transform 0.15s, box-shadow 0.15s, border-color 0.15s',
      }}
    >
      <div style={{ marginBottom: '6px' }}>
        <Avatar size={120} level={member.level} />
      </div>
      <div style={{ textAlign: 'center' }}>
        <p style={{ color: 'var(--color-gold-light)', fontSize: '15px', fontWeight: 'bold', textShadow: '0 0 8px rgba(240,208,96,0.35)' }}>{member.name}</p>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '12px', marginTop: '2px', letterSpacing: '0.5px' }}>{member.charClass}</p>
      </div>
      <div style={{ width: '100%' }}>
        <ProgressBar value={xpPct} label={`${member.xpCurrent} / ${member.xpNeeded} XP`} color="#7c2dbe" />
      </div>
    </div>
  )
}

import { useState, type CSSProperties, type ReactNode } from 'react'
import { Avatar } from '../components/atoms/Avatar'
import { RoleBadge } from '../components/atoms/RoleBadge'
import { ClassBadge } from '../components/atoms/ClassBadge'
import { resolveRole } from '../lib/roles'
import { Modal } from '../components/organisms/Modal'
import { CharacterCard } from '../components/organisms/CharacterCard'
import { useCharacters } from '../hooks/useCharacters'
import type { GameCharacter } from '../services/characters'

// Team page — reads the real authored roster from Sanity (replaces the old mock party). There is no
// per-player instance yet (level/xp live in Supabase, a later step), so the card shows a PREVIEW
// level the player can change to inspect the computed baselines across the growth curve.

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2 style={{
      color: 'var(--color-gold-mid)', fontSize: '12px', letterSpacing: '3px', textTransform: 'uppercase',
      marginBottom: '14px', paddingBottom: '6px', borderBottom: '1px solid var(--color-gold-dark)',
    }}>{children}</h2>
  )
}

const muted: CSSProperties = { color: 'var(--color-text-muted)', fontSize: '13px', fontStyle: 'italic' }

export default function TeamPage() {
  const { data: characters, isLoading, isError, error } = useCharacters()
  const [openKey, setOpenKey] = useState<string | null>(null)
  // No per-player instance yet → preview the def's computed baselines at a chosen level.
  const [previewLevel, setPreviewLevel] = useState(1)
  const openMember = characters?.find(c => c.charKey === openKey) ?? null

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
        <SectionTitle>Your Party</SectionTitle>
        <PreviewLevel level={previewLevel} onChange={setPreviewLevel} />
      </div>

      {isLoading && <p style={muted}>Loading roster…</p>}
      {isError && (
        <p style={{ ...muted, color: '#e0635c' }}>
          Couldn’t load characters: {error instanceof Error ? error.message : 'unknown error'}. Is VITE_SANITY_READ_TOKEN set?
        </p>
      )}
      {characters && characters.length === 0 && (
        <p style={muted}>No characters authored yet — add one in the Sanity Studio.</p>
      )}

      {characters && characters.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '16px' }}>
          {characters.map(c => (
            <PartyMemberCard key={c.charKey} member={c} level={previewLevel} onOpen={() => setOpenKey(c.charKey)} />
          ))}
        </div>
      )}

      {/* Click a member → full character sheet (Stats tab = real computed baselines) */}
      <Modal open={openKey !== null} onClose={() => setOpenKey(null)}>
        {openMember && (
          <CharacterCard
            name={openMember.name}
            charClass={openMember.charClass}
            level={previewLevel}
            role={openMember.role}
            baseStats={openMember.baseStats}
            growth={openMember.growth}
          />
        )}
      </Modal>
    </div>
  )
}

// Preview-level control — temporary affordance until per-player level comes from Supabase.
function PreviewLevel({ level, onChange }: { level: number; onChange: (n: number) => void }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-text-muted)', fontSize: '10px', letterSpacing: '1.5px', textTransform: 'uppercase' }}>
      Preview level
      <input
        type="number" min={1} max={50} value={level}
        onChange={e => onChange(Math.max(1, Math.min(50, Number(e.target.value) || 1)))}
        style={{
          width: '58px', padding: '5px 8px', textAlign: 'center',
          fontFamily: 'Georgia, serif', fontSize: '13px', fontWeight: 'bold',
          color: 'var(--color-text-gold)', background: 'linear-gradient(180deg, #1a0a0c 0%, #100305 100%)',
          border: '2px solid var(--color-gold-dark)', borderRadius: '4px',
        }}
      />
    </label>
  )
}

function PartyMemberCard({ member, level, onOpen }: { member: GameCharacter; level: number; onOpen: () => void }) {
  const [hover, setHover] = useState(false)

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
        <Avatar size={120} level={level} />
      </div>
      <div style={{ textAlign: 'center' }}>
        <p style={{ color: 'var(--color-gold-light)', fontSize: '15px', fontWeight: 'bold', textShadow: '0 0 8px rgba(240,208,96,0.35)' }}>{member.name}</p>
      </div>
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'center' }}>
        <ClassBadge charClass={member.charClass} size="sm" />
        <RoleBadge role={resolveRole(member.charClass, member.role)} size="sm" />
      </div>
    </div>
  )
}

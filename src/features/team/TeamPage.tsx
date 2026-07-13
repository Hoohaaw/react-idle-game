import { useState, type CSSProperties, type ReactNode } from 'react'
import { Avatar } from '@/components/atoms/Avatar'
import { RoleBadge } from '@/components/atoms/RoleBadge'
import { ClassBadge } from '@/components/atoms/ClassBadge'
import { SchoolBadge } from '@/components/atoms/SchoolBadge'
import { TraitChips } from '@/components/molecules/TraitChips'
import { Modal } from '@/components/organisms/Modal'
import { CharacterCard } from '@/components/organisms/CharacterCard'
import { useCharacters } from '@/hooks/useCharacters'
import { useRoster, useItemDefs, type RosterMember } from '@/hooks/useRoster'
import { xpToNext } from '@/lib/leveling'
import { effectiveStatBreakdown } from '@/lib/stats'
import type { GearSlotKey } from '@/lib/equipment'
import { resolveGearSlots } from './lib'
import { SlotPickerModal } from './components/SlotPickerModal'

const BUSY_REASON: Record<NonNullable<RosterMember['busy']>, string> = {
  mission: 'Gear is locked while on a mission.',
  gathering: 'Gear is locked while gathering.',
  infirmary: 'Gear is locked while in the infirmary.',
}

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
  const { roster, isLoading, error } = useRoster()
  const { data: defs } = useCharacters()
  const itemDefs = useItemDefs()
  const [openId, setOpenId] = useState<string | null>(null)
  const [pickerSlot, setPickerSlot] = useState<GearSlotKey | null>(null)

  const openMember = roster.find(m => m.id === openId) ?? null
  const openDef = openMember ? defs?.find(d => d.charKey === openMember.characterDefId) ?? null : null

  return (
    <div>
      <SectionTitle>Your Party</SectionTitle>

      {isLoading && <p style={muted}>Loading roster...</p>}
      {error && (
        <p style={{ ...muted, color: '#e0635c' }}>
          Couldn't load roster: {error instanceof Error ? error.message : 'unknown error'}
        </p>
      )}
      {!isLoading && !error && roster.length === 0 && (
        <p style={muted}>No characters recruited yet.</p>
      )}

      {roster.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '16px' }}>
          {roster.map(m => (
            <PartyMemberCard key={m.id} member={m} onOpen={() => setOpenId(m.id)} />
          ))}
        </div>
      )}

      <Modal open={openId !== null} onClose={() => setOpenId(null)}>
        {openMember && openDef && (
          <CharacterCard
            name={openDef.name}
            charClass={openDef.charClass}
            level={openMember.level}
            xpCurrent={openMember.xp}
            xpNeeded={xpToNext(openMember.level)}
            role={openDef.role}
            damageSchool={openDef.damageSchool}
            traits={openDef.traits}
            baseStats={openDef.baseStats}
            growth={openDef.growth}
            gear={{
              slots: resolveGearSlots(openMember.equipped, itemDefs.data),
              onSlotClick: setPickerSlot,
              disabledReason: openMember.busy ? BUSY_REASON[openMember.busy] : null,
            }}
            statBreakdown={effectiveStatBreakdown({
              level: openMember.level,
              baseStats: openDef.baseStats,
              growth: openDef.growth,
              blessingAllocations: openMember.blessings,
              blessingNodes: openDef.blessingNodes,
              equipped: openMember.equipped,
              itemDefs: itemDefs.data ?? {},
            })}
          />
        )}
      </Modal>

      {openMember && (
        <SlotPickerModal member={openMember} slotKey={pickerSlot} onClose={() => setPickerSlot(null)} />
      )}
    </div>
  )
}

function PartyMemberCard({ member, onOpen }: { member: RosterMember; onOpen: () => void }) {
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
        <Avatar size={120} level={member.level} />
      </div>
      <div style={{ textAlign: 'center' }}>
        <p style={{ color: 'var(--color-gold-light)', fontSize: '15px', fontWeight: 'bold', textShadow: '0 0 8px rgba(240,208,96,0.35)' }}>{member.name}</p>
      </div>
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'center' }}>
        <ClassBadge charClass={member.charClass} size="sm" />
        <RoleBadge role={member.role} size="sm" />
        {member.damageSchool && <SchoolBadge school={member.damageSchool} size="sm" />}
      </div>
      {member.traits.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <TraitChips traits={member.traits} />
        </div>
      )}
    </div>
  )
}

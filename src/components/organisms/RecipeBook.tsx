import { useState } from 'react'
import { IconButton } from '../atoms/IconButton'
import { IconSlot } from '../atoms/IconSlot'
import { SegmentedControl } from '../atoms/SegmentedControl'
import { ResourceTooltip } from './ResourceTooltip'
import { RESOURCE_COLOR } from '../../lib/resources'
import type { Recipe } from '../../types/recipe'

// The recipe collection panel. Only discovered recipes are shown — locked ones stay hidden
// until found in-game. An All / Infusions / Creations filter narrows by kind. See
// [[project-crafting]].
export function RecipeBook({ recipes, onClose }: { recipes: Recipe[]; onClose?: () => void }) {
  const [filter, setFilter] = useState('All')
  const discovered = recipes.filter(r => r.discovered)
  const shown = filter === 'All'
    ? discovered
    : discovered.filter(r => r.kind === (filter === 'Infusions' ? 'infuse' : 'create'))
  return (
    <div style={{
      width: '100%', borderRadius: 8, overflow: 'hidden',
      border: '2px solid var(--color-gold-mid)',
      background: 'linear-gradient(180deg, #1e0a0c 0%, #130406 100%)',
      boxShadow: ['0 0 0 1px #080101', 'inset 0 1px 0 rgba(255,255,255,0.06)', '0 6px 18px rgba(0,0,0,0.75)'].join(', '),
    }}>
      <div style={{ padding: '10px 14px', borderBottom: '2px solid var(--color-gold-dark)', background: 'linear-gradient(180deg, rgba(200,145,42,0.16) 0%, rgba(200,145,42,0.03) 100%)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, color: 'var(--color-gold-light)', fontSize: 14, fontWeight: 'bold', letterSpacing: 0.5, textShadow: '0 0 10px rgba(240,208,96,0.35)' }}>
          <IconSlot size={14} />Recipe Book
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ color: 'var(--color-text-muted)', fontSize: 11 }}>{discovered.length} discovered</span>
          {onClose && <IconButton label="Close recipe book" onClick={onClose}>✕</IconButton>}
        </span>
      </div>
      {/* Filter by recipe kind */}
      <div style={{ padding: '10px 12px 0' }}>
        <SegmentedControl options={['All', 'Infusions', 'Creations']} value={filter} onChange={setFilter} />
      </div>
      <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {discovered.length === 0
          ? <p style={{ color: 'var(--color-text-muted)', fontSize: 12, fontStyle: 'italic', textAlign: 'center', padding: '12px 0' }}>No recipes discovered yet — explore and craft to unlock them.</p>
          : shown.length === 0
            ? <p style={{ color: 'var(--color-text-muted)', fontSize: 12, fontStyle: 'italic', textAlign: 'center', padding: '12px 0' }}>No {filter.toLowerCase()} discovered yet.</p>
            : shown.map(r => <RecipeRow key={r.id} recipe={r} />)}
      </div>
    </div>
  )
}

function RecipeRow({ recipe }: { recipe: Recipe }) {
  const { kind, name, result, resources } = recipe
  return (
    <div style={{
      borderRadius: 6, padding: 10,
      border: '1px solid var(--color-gold-dark)',
      background: 'rgba(255,255,255,0.02)',
    }}>
      {/* Headline with the type badge to its right */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
        <span style={{ color: 'var(--color-text-primary)', fontSize: 13, fontWeight: 'bold', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</span>
        <TypeBadge kind={kind} />
      </div>

      <p style={{ color: kind === 'infuse' ? '#b06fd4' : '#5b9bd5', fontSize: 11, marginTop: 4 }}>
        {result}
      </p>

      {/* Required materials — hover a chip to see where to obtain it */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8, alignItems: 'center' }}>
        {resources.map(res => (
          <ResourceTooltip key={res.resource} resource={res.resource}>
            <ResourceReq resource={res.resource} qty={res.qty} />
          </ResourceTooltip>
        ))}
      </div>
    </div>
  )
}

function TypeBadge({ kind }: { kind: 'infuse' | 'create' }) {
  const infuse = kind === 'infuse'
  return (
    <span style={{
      padding: '1px 7px', borderRadius: 3, fontSize: 9, fontWeight: 'bold', letterSpacing: 1, textTransform: 'uppercase', flexShrink: 0,
      border: `1px solid ${infuse ? '#6a3a8a' : '#2a5a8a'}`,
      color: infuse ? '#b06fd4' : '#5b9bd5',
      background: infuse ? 'rgba(176,111,212,0.12)' : 'rgba(91,155,213,0.12)',
    }}>{infuse ? 'Infuse' : 'Create'}</span>
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

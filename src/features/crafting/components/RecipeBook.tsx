import { IconButton } from '@/components/atoms/IconButton'
import { IconSlot } from '@/components/atoms/IconSlot'
import { RarityChancePill } from '@/components/molecules/RarityChancePill'
import { ResourceTooltip } from '@/components/organisms/ResourceTooltip'
import { RESOURCE_COLOR } from '@/lib/resources'
import { rarityChances } from '@/lib/crafting'
import { formatRemaining } from '@/lib/time'
import type { RecipeView } from '@/services/crafting'

// The recipe collection panel. Every recipeDef is shown (no discovery gating in v1, spec §3);
// selecting a row is what fills the crafting circle's reagent slots.
export function RecipeBook({ recipes, selectedKey, onSelect, onClose }: {
  recipes: RecipeView[]
  selectedKey: string | null
  onSelect: (recipeKey: string) => void
  onClose?: () => void
}) {
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
          <span style={{ color: 'var(--color-text-muted)', fontSize: 11 }}>{recipes.length} recipes</span>
          {onClose && <IconButton label="Close recipe book" onClick={onClose}>✕</IconButton>}
        </span>
      </div>
      <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {recipes.length === 0
          ? <p style={{ color: 'var(--color-text-muted)', fontSize: 12, fontStyle: 'italic', textAlign: 'center', padding: '12px 0' }}>No recipes authored yet.</p>
          : recipes.map((r) => (
            <RecipeRow key={r.recipeKey} recipe={r} selected={r.recipeKey === selectedKey} onSelect={() => onSelect(r.recipeKey)} />
          ))}
      </div>
    </div>
  )
}

function RecipeRow({ recipe, selected, onSelect }: { recipe: RecipeView; selected: boolean; onSelect: () => void }) {
  return (
    <button type="button" onClick={onSelect} style={{
      textAlign: 'left', width: '100%', borderRadius: 6, padding: 10, cursor: 'pointer', fontFamily: 'Georgia, serif',
      border: `1px solid ${selected ? 'var(--color-gold-mid)' : 'var(--color-gold-dark)'}`,
      background: selected ? 'rgba(200,145,42,0.12)' : 'rgba(255,255,255,0.02)',
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, minWidth: 0 }}>
        <span style={{ color: 'var(--color-text-primary)', fontSize: 13, fontWeight: 'bold', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>{recipe.name}</span>
        <span style={{ color: 'var(--color-text-muted)', fontSize: 10, whiteSpace: 'nowrap' }}>{formatRemaining(recipe.durationSeconds * 1000)}</span>
      </div>
      <p style={{ color: '#5b9bd5', fontSize: 11, marginTop: 4 }}>{recipe.result.name} <span style={{ color: 'var(--color-text-muted)' }}>({recipe.result.slot})</span></p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
        {rarityChances(recipe.resultRarityWeights).map((c) => <RarityChancePill key={c.rarity} rarity={c.rarity} chance={c.chance} />)}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8, alignItems: 'center' }}>
        {recipe.reagents.map((line, i) => line.kind === 'resource'
          ? (
            <ResourceTooltip key={i} resource={line.resource}>
              <ReagentChip label={line.resource} qty={line.quantity} color={RESOURCE_COLOR[line.resource] ?? '200,145,42'} />
            </ResourceTooltip>
          )
          : <ReagentChip key={i} label={recipe.reagentNames[line.itemKey] ?? line.itemKey} qty={line.quantity} color="176,111,212" />)}
      </div>
    </button>
  )
}

function ReagentChip({ label, qty, color }: { label: string; qty: number; color: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '2px 8px', borderRadius: 4, fontSize: 11, border: `1px solid rgba(${color},0.5)`, background: `rgba(${color},0.12)`, color: 'var(--color-text-primary)' }}>
      <span style={{ width: 8, height: 8, borderRadius: 2, background: `rgb(${color})` }} />
      {label} <span style={{ color: 'var(--color-text-gold)', fontWeight: 'bold' }}>×{qty}</span>
    </span>
  )
}

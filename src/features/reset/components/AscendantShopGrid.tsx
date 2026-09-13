// src/features/reset/components/AscendantShopGrid.tsx
import { Alert } from '@/components/atoms/Alert'
import { PrimaryButton } from '@/components/atoms/Button'
import { FLAT_ASCENDANT_NODES, flatNodeCost, charNodeKey, charNodeCost } from '@/lib/ascendantShop'
import { useCharacterDefs } from '@/hooks/useRoster'
import { usePurchaseAscendantShopNode } from '../hooks'

export function AscendantShopGrid({ ascendantShards, ascendantShop }: { ascendantShards: number; ascendantShop: Record<string, number> }) {
  const purchase = usePurchaseAscendantShopNode()
  const characterDefs = useCharacterDefs()
  const flatNodes = Object.values(FLAT_ASCENDANT_NODES)

  return (
    <div>
      <p style={{ color: 'var(--color-text-muted)', fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 }}>
        Ascendant Shop — {ascendantShards.toLocaleString()} Ascendant Shards
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
        {flatNodes.map((node) => {
          const level = ascendantShop[node.key] ?? 0
          const cost = flatNodeCost(node, level)
          const canAfford = ascendantShards >= cost
          return (
            <div key={node.key} className="atom-heavy" style={{
              borderRadius: 8, border: '2px solid var(--color-gold-dark)', padding: 14,
              display: 'flex', flexDirection: 'column', gap: 8,
              background: 'linear-gradient(180deg, #1c080a 0%, #110305 100%)',
            }}>
              <p style={{ color: 'var(--color-gold-light)', fontSize: 13, fontWeight: 'bold' }}>{node.label}</p>
              <p style={{ color: 'var(--color-text-muted)', fontSize: 11 }}>{node.description}</p>
              <p style={{ color: 'var(--color-text-primary)', fontSize: 12 }}>Level {level}</p>
              <PrimaryButton disabled={!canAfford || purchase.isPending} onClick={() => purchase.mutate(node.key)}>
                {purchase.isPending ? 'Buying...' : `Buy — ${cost.toLocaleString()} Shards`}
              </PrimaryButton>
            </div>
          )
        })}
      </div>

      <p style={{ color: 'var(--color-text-muted)', fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', margin: '20px 0 10px' }}>
        Character Power
      </p>
      {characterDefs.isLoading && <p style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>Loading roster...</p>}
      {characterDefs.error && <Alert variant="error">Could not load characters.</Alert>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
        {(characterDefs.data ?? []).map((c) => {
          const powerLevel = ascendantShop[charNodeKey(c.charKey, 'power')] ?? 0
          const vitalityLevel = ascendantShop[charNodeKey(c.charKey, 'vitality')] ?? 0
          const powerCost = charNodeCost(powerLevel)
          const vitalityCost = charNodeCost(vitalityLevel)
          return (
            <div key={c.charKey} className="atom-heavy" style={{
              borderRadius: 8, border: '2px solid var(--color-gold-dark)', padding: 14,
              display: 'flex', flexDirection: 'column', gap: 8,
              background: 'linear-gradient(180deg, #1c080a 0%, #110305 100%)',
            }}>
              <p style={{ color: 'var(--color-gold-light)', fontSize: 13, fontWeight: 'bold' }}>{c.name}</p>
              <p style={{ color: 'var(--color-text-muted)', fontSize: 11 }}>{c.charClass}</p>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--color-text-primary)', fontSize: 12 }}>Power (Lv {powerLevel})</span>
                <PrimaryButton
                  disabled={ascendantShards < powerCost || purchase.isPending}
                  onClick={() => purchase.mutate(charNodeKey(c.charKey, 'power'))}
                >
                  {powerCost.toLocaleString()}
                </PrimaryButton>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--color-text-primary)', fontSize: 12 }}>Vitality (Lv {vitalityLevel})</span>
                <PrimaryButton
                  disabled={ascendantShards < vitalityCost || purchase.isPending}
                  onClick={() => purchase.mutate(charNodeKey(c.charKey, 'vitality'))}
                >
                  {vitalityCost.toLocaleString()}
                </PrimaryButton>
              </div>
            </div>
          )
        })}
      </div>

      {purchase.error && (
        <div style={{ marginTop: 12 }}>
          <Alert variant="error">{purchase.error instanceof Error ? purchase.error.message : 'Could not purchase upgrade'}</Alert>
        </div>
      )}
    </div>
  )
}

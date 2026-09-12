// src/features/reset/components/EchoShopGrid.tsx
import { Alert } from '@/components/atoms/Alert'
import { PrimaryButton } from '@/components/atoms/Button'
import { ECHO_SHOP_NODES, nodeCost, effectPercent, MAX_PROTECTED_SLOTS } from '@/lib/echoShop'
import { usePurchaseEchoShopNode } from '../hooks'

// The permanent purchase grid (ADR-0053) — levels persist across every Reset; this is the
// "visual cue" that past investment survives (spec §6).
export function EchoShopGrid({ echoes, echoShop }: { echoes: number; echoShop: Record<string, number> }) {
  const purchase = usePurchaseEchoShopNode()
  const nodes = Object.values(ECHO_SHOP_NODES)

  return (
    <div>
      <p style={{ color: 'var(--color-text-muted)', fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 }}>
        Echo Shop — {echoes.toLocaleString()} Echoes
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
        {nodes.map((node) => {
          const level = echoShop[node.key] ?? 0
          const cost = nodeCost(node, level)
          const canAfford = echoes >= cost
          return (
            <div key={node.key} className="atom-heavy" style={{
              borderRadius: 8, border: '2px solid var(--color-gold-dark)', padding: 14,
              display: 'flex', flexDirection: 'column', gap: 8,
              background: 'linear-gradient(180deg, #1c080a 0%, #110305 100%)',
            }}>
              <p style={{ color: 'var(--color-gold-light)', fontSize: 13, fontWeight: 'bold' }}>{node.label}</p>
              <p style={{ color: 'var(--color-text-muted)', fontSize: 11 }}>{node.description}</p>
              <p style={{ color: 'var(--color-text-primary)', fontSize: 12 }}>
                {node.key === 'protectedSlots'
                  ? <>Level {level} <span style={{ color: 'var(--color-text-gold)' }}>({level} / {MAX_PROTECTED_SLOTS} slots)</span></>
                  : <>Level {level} <span style={{ color: 'var(--color-text-gold)' }}>(+{Math.round(effectPercent(node.effect.kind, level))}%)</span></>}
              </p>
              <PrimaryButton
                disabled={!canAfford || purchase.isPending || (node.key === 'protectedSlots' && level >= MAX_PROTECTED_SLOTS)}
                onClick={() => purchase.mutate(node.key)}
              >
                {node.key === 'protectedSlots' && level >= MAX_PROTECTED_SLOTS
                  ? 'Maximum reached'
                  : purchase.isPending ? 'Buying...' : `Buy — ${cost.toLocaleString()} Echoes`}
              </PrimaryButton>
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

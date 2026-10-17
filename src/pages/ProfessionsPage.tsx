import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Alert } from '@/components/atoms/Alert'
import { PROFESSION_DEFS, xpToNextProfessionLevel, PROFESSION_LEVEL_CAP } from '@/lib/professions'
import { learnProfessionRecipe } from '@/services/professions'
import { useProfile } from '@/hooks/useProfile'

// Profession-expert page (docs/superpowers/specs/2026-10-16-profession-system-design.md Decision
// 6): shows each profession's level/XP and known recipes. Buying unlearned recipes is wired here;
// quest turn-ins follow in each profession's own content follow-up spec (ADR-0061 sequencing) —
// this page's quest section is intentionally a placeholder list until that content exists.

export default function ProfessionsPage() {
  const { data: profile } = useProfile()
  const [selected, setSelected] = useState(PROFESSION_DEFS[0].professionKey)
  const qc = useQueryClient()
  const learn = useMutation({
    mutationFn: learnProfessionRecipe,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['profile'] }),
  })

  const state = profile?.professions?.[selected] ?? { level: 1, xp: 0, knownRecipes: [] }
  const needed = xpToNextProfessionLevel(state.level)

  return (
    <div>
      <h1 style={{ color: 'var(--color-gold-light)', fontSize: '22px', letterSpacing: '1px', textShadow: '0 0 12px rgba(240,208,96,0.35)' }}>
        Professions
      </h1>
      <div style={{ display: 'flex', gap: '18px', marginTop: '16px' }}>
        <div style={{ width: '200px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {PROFESSION_DEFS.map((p) => (
            <button
              key={p.professionKey}
              onClick={() => setSelected(p.professionKey)}
              style={{
                textAlign: 'left', padding: '10px 12px', borderRadius: '6px', cursor: 'pointer',
                border: `2px solid ${selected === p.professionKey ? 'var(--color-gold-light)' : 'var(--color-gold-dark)'}`,
                background: selected === p.professionKey ? 'rgba(200,145,42,0.12)' : 'transparent',
                color: 'var(--color-text-primary)',
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ color: 'var(--color-text-primary)', fontSize: 14 }}>
            Level {state.level}{state.level >= PROFESSION_LEVEL_CAP ? ' (MAX)' : ` — ${state.xp} / ${needed} XP`}
          </p>
          <p style={{ color: 'var(--color-text-muted)', fontSize: 12, marginTop: '8px' }}>
            Known recipes: {state.knownRecipes.length === 0 ? 'none yet' : state.knownRecipes.join(', ')}
          </p>
          {learn.error && (
            <Alert variant="error">{learn.error instanceof Error ? learn.error.message : 'Could not learn recipe'}</Alert>
          )}
          <p style={{ color: 'var(--color-text-muted)', fontSize: 12, fontStyle: 'italic', marginTop: '16px' }}>
            Buyable recipes and quests for this profession are authored per-profession — none
            exist yet (Alchemy/Carving/Prospecting/Tempering/Arcane Writing are each their own
            follow-up content spec).
          </p>
        </div>
      </div>
    </div>
  )
}

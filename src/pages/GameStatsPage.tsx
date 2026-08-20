import { GUIDE_SECTIONS, type GuideSection } from './gameStatsContent'
import { IconSlot } from '@/components/atoms/IconSlot'

// Game Stats — a player-facing guide to the character stats and the general workings of the game.
// All content lives in gameStatsContent.ts (kept in sync with rule changes); this file only renders.

const NOTE: React.CSSProperties = { color: 'var(--color-text-muted)', fontSize: 12, fontStyle: 'italic' }

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{
      color: 'var(--color-gold-mid)', fontSize: 12, letterSpacing: 3, textTransform: 'uppercase',
      marginBottom: 6, paddingBottom: 6, borderBottom: '1px solid var(--color-gold-dark)',
    }}>{children}</h2>
  )
}

function Section({ section }: { section: GuideSection }) {
  return (
    <section style={{ marginBottom: 32 }}>
      <SectionHeading>{section.title}</SectionHeading>
      {section.intro && (
        <p style={{ color: 'var(--color-text)', fontSize: 13, lineHeight: 1.7, marginBottom: 12, maxWidth: 720 }}>
          {section.intro}
        </p>
      )}
      {section.entries && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 12 }}>
          {section.entries.map((e) => (
            <div key={e.name} className="atom-heavy" style={{ padding: '12px 14px', borderRadius: 6 }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--color-gold-light)', fontSize: 13, marginBottom: 6 }}>
                {/* entry.icon stays as data; render a placeholder until real icons land (no emoji icons) */}
                {e.icon && <IconSlot size={13} />}
                {e.name}
              </h3>
              <p style={{ color: 'var(--color-text-muted)', fontSize: 12.5, lineHeight: 1.65 }}>{e.body}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

export default function GameStatsPage() {
  return (
    <div>
      <SectionHeading>Game Stats</SectionHeading>
      <p style={{ ...NOTE, marginBottom: 24 }}>
        How your heroes work — the stats, the fights, and the ways to get stronger.
      </p>
      {GUIDE_SECTIONS.map((s) => <Section key={s.title} section={s} />)}
    </div>
  )
}

import type { CSSProperties, ReactNode } from 'react'

// ── Art-direction comparison (prototype, /design only) ──────────────────────────────
// Three candidate looks for the whole game, each rendering the SAME sample UI (a mine-like
// panel + controls) so the skins compare honestly. Grounded in genre research:
//  A. Gilded Reliquary — the current dark-red/gold carved-metal language, matured
//     (classic dark-fantasy UI: stone/metal frames, warm gold hierarchy).
//  B. Ink & Vellum — Darkest Dungeon lineage: ink/woodcut chiaroscuro, warm limited
//     palette (no dead grays), one blood accent, hard edges, engraved type.
//  C. Emberglass — modern minimal dark fantasy (Diablo IV-adjacent) filtered through
//     idle-genre readability-first findings: near-black neutrals, hairline borders,
//     a single ember accent reserved for what's alive/interactive.

type Direction = {
  name: string
  tagline: string
  notes: string
  fontNote: string
  font: string
  well: CSSProperties
  swatches: { label: string; value: string }[]
  panel: CSSProperties
  headerBar: CSSProperties
  title: CSSProperties
  subtitle: CSSProperties
  statStrip: CSSProperties
  statValue: CSSProperties
  statLabel: CSSProperties
  bodyText: CSSProperties
  chip: CSSProperties
  track: CSSProperties
  fill: CSSProperties
  primaryBtn: CSSProperties
  secondaryBtn: CSSProperties
}

const GILDED: Direction = {
  name: 'A · Gilded Reliquary',
  tagline: 'The current language, matured — carved metal, warm gold hierarchy, treasure-box weight.',
  notes: 'Keeps the established dark-red/gold identity and pushes materiality: deeper bevels, engraved dividers, stronger glow discipline (glow = active/interactive only).',
  fontNote: 'Display: engraved serif small-caps (Georgia now; Cinzel-class later) · Body: Georgia',
  font: 'Georgia, serif',
  well: { background: '#140406' },
  swatches: [
    { label: 'bg', value: '#1e0a0c' }, { label: 'panel', value: '#2d0d10' },
    { label: 'gold', value: '#c9922a' }, { label: 'gold-light', value: '#f0d060' },
    { label: 'text', value: '#f5e8d0' }, { label: 'success', value: '#4a8c3f' },
  ],
  panel: {
    borderRadius: 8, border: '3px solid #c9922a',
    background: 'linear-gradient(180deg, #1e0a0c 0%, #130406 100%)',
    boxShadow: '0 0 0 1px #080101, inset 0 1px 0 rgba(255,255,255,0.07), inset 0 2px 8px rgba(0,0,0,0.6), 0 0 18px rgba(200,140,30,0.15), 0 6px 18px rgba(0,0,0,0.75)',
    overflow: 'hidden',
  },
  headerBar: {
    padding: '10px 14px', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8,
    background: 'linear-gradient(180deg, rgba(184,115,51,0.38) 0%, rgba(184,115,51,0.08) 100%)',
    borderBottom: '2px solid rgba(184,115,51,0.9)',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.07)',
  },
  title: { color: '#f0d060', fontSize: 15, fontWeight: 'bold', letterSpacing: 1, textShadow: '0 1px 2px rgba(0,0,0,0.9), 0 0 10px rgba(240,208,96,0.35)' },
  subtitle: { color: '#a08060', fontSize: 9, letterSpacing: 2, textTransform: 'uppercase' },
  statStrip: {
    display: 'flex', justifyContent: 'space-between', padding: '7px 14px',
    background: 'linear-gradient(180deg, #0b0203 0%, #150506 100%)',
    borderBottom: '1px solid #7a4f10', boxShadow: 'inset 0 2px 5px rgba(0,0,0,0.65)',
  },
  statValue: { color: '#e8c050', fontSize: 13, fontWeight: 'bold' },
  statLabel: { color: '#a08060', fontSize: 11 },
  bodyText: { color: '#f5e8d0', fontSize: 12 },
  chip: {
    padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 'bold',
    border: '1px solid rgba(74,140,63,0.6)', color: '#4a8c3f',
    background: 'linear-gradient(180deg, rgba(74,140,63,0.18) 0%, rgba(74,140,63,0.06) 100%)',
    textShadow: '0 0 8px rgba(74,140,63,0.5)',
  },
  track: { height: 12, borderRadius: 4, border: '2px solid #7a4f10', background: '#0a0203', boxShadow: 'inset 0 3px 6px rgba(0,0,0,0.7)', overflow: 'hidden' },
  fill: { height: '100%', width: '62%', background: 'linear-gradient(180deg, #f0d060 0%, #c9922a 100%)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.28)' },
  primaryBtn: {
    padding: '8px 18px', borderRadius: 5, cursor: 'pointer', fontFamily: 'Georgia, serif', fontSize: 12, fontWeight: 'bold', letterSpacing: 1, textTransform: 'uppercase',
    border: '2px solid #f0d060', color: '#1a0608',
    background: 'linear-gradient(180deg, #f0d060 0%, #c9922a 55%, #9a6a18 100%)',
    boxShadow: '0 0 0 1px #080101, inset 0 1px 0 rgba(255,255,255,0.35), 0 3px 8px rgba(0,0,0,0.6)',
    textShadow: '0 1px 1px rgba(255,255,255,0.25)',
  },
  secondaryBtn: {
    padding: '8px 18px', borderRadius: 5, cursor: 'pointer', fontFamily: 'Georgia, serif', fontSize: 12, letterSpacing: 1, textTransform: 'uppercase',
    border: '2px solid #7a4f10', color: '#e8c050',
    background: 'linear-gradient(180deg, #2a0f12 0%, #1a0608 100%)',
    boxShadow: '0 0 0 1px #080101, inset 0 1px 0 rgba(255,255,255,0.06)',
  },
}

// The identical sample UI every direction renders — a mine-like panel with real content shapes.
function Sample({ d }: { d: Direction }) {
  return (
    <div style={{ ...d.panel, width: 300, fontFamily: d.font }}>
      <div style={d.headerBar}>
        <span style={d.title}>Copper Mine</span>
        <span style={d.subtitle}>Ore · Tier I</span>
      </div>
      <div style={d.statStrip}>
        <span><span style={d.statValue}>+5</span> <span style={d.statLabel}>/ 30s</span></span>
        <span><span style={{ ...d.statLabel, fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase' }}>Owned </span><span style={d.statValue}>1,240</span></span>
      </div>
      <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <span style={d.bodyText}>Mordrek Graveborn</span>
          <span style={d.chip}>+45</span>
        </div>
        <div style={d.track}><div style={d.fill} /></div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button style={d.secondaryBtn}>Collect</button>
          <button style={d.primaryBtn}>Assign</button>
        </div>
      </div>
    </div>
  )
}

function Swatches({ d }: { d: Direction }) {
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {d.swatches.map((s) => (
        <div key={s.label} style={{ textAlign: 'center' }}>
          <div style={{ width: 44, height: 30, borderRadius: 4, background: s.value, border: '1px solid rgba(255,255,255,0.15)', boxShadow: '0 2px 6px rgba(0,0,0,0.5)' }} />
          <p style={{ color: 'var(--color-text-muted)', fontSize: 9, marginTop: 3 }}>{s.label}</p>
        </div>
      ))}
    </div>
  )
}

function DirectionBlock({ d }: { d: Direction }) {
  return (
    <div style={{
      flex: '1 1 340px', maxWidth: 420, borderRadius: 10, padding: 20,
      border: '1px solid var(--color-gold-dark)', ...d.well,
    }}>
      <h3 style={{ color: 'var(--color-gold-light)', fontSize: 15, letterSpacing: 1.5, marginBottom: 4 }}>{d.name}</h3>
      <p style={{ color: 'var(--color-text-primary)', fontSize: 12, marginBottom: 6, lineHeight: 1.45 }}>{d.tagline}</p>
      <p style={{ color: 'var(--color-text-muted)', fontSize: 11, marginBottom: 14, lineHeight: 1.5 }}>{d.notes}</p>
      <div style={{ marginBottom: 14 }}><Swatches d={d} /></div>
      <Sample d={d} />
      <p style={{ color: 'var(--color-text-muted)', fontSize: 10, marginTop: 12, fontStyle: 'italic' }}>{d.fontNote}</p>
    </div>
  )
}

export function ArtDirectionOptions({ heading }: { heading: ReactNode }) {
  return (
    <section style={{ marginBottom: 56 }}>
      {heading}
      <p style={{ color: 'var(--color-text-muted)', fontSize: 12, marginBottom: 20, maxWidth: 720, lineHeight: 1.6 }}>
        Chosen direction: Gilded Reliquary — carved metal, warm gold hierarchy, treasure-box weight.
        The sample panel below is the reference for this language applied to in-game UI.
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 18, alignItems: 'stretch' }}>
        <DirectionBlock d={GILDED} />
      </div>
    </section>
  )
}

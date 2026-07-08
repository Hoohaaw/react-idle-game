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
  fill: { height: '100%', width: '62%', background: 'linear-gradient(180deg, #f0d060 0%, #c9922a 100%)' },
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

const INK: Direction = {
  name: 'B · Ink & Vellum',
  tagline: 'Darkest Dungeon lineage — ink & woodcut chiaroscuro, vellum text, one blood accent.',
  notes: 'Warm limited palette (no dead grays — even the blacks are warm ink), hard edges, offset "woodcut" shadows, engraved uppercase display type. Grim and literary; colour is spent almost nowhere, so the one crimson reads loud.',
  fontNote: 'Display: condensed engraved serif, all-caps (IM Fell / Alegreya SC class) · Body: warm serif',
  font: 'Georgia, serif',
  well: { background: '#12100c' },
  swatches: [
    { label: 'ink', value: '#0a0806' }, { label: 'panel', value: '#1c1813' },
    { label: 'vellum', value: '#e8dcc0' }, { label: 'blood', value: '#8e1f22' },
    { label: 'antique', value: '#9c8a5a' }, { label: 'moss', value: '#5a6b3f' },
  ],
  panel: {
    borderRadius: 2, border: '2px solid #0a0806',
    background: 'radial-gradient(ellipse at 50% 0%, #221d16 0%, #1c1813 55%, #141109 100%)',
    boxShadow: '0 0 0 1px #2a241a, 5px 5px 0 rgba(6,5,3,0.85)',
    overflow: 'hidden',
  },
  headerBar: {
    padding: '9px 14px', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8,
    background: 'linear-gradient(180deg, #6e191c 0%, #4c1114 100%)',
    borderBottom: '2px solid #0a0806',
  },
  title: { color: '#e8dcc0', fontSize: 14, fontWeight: 'bold', letterSpacing: 3, textTransform: 'uppercase', textShadow: '1px 1px 0 #0a0806' },
  subtitle: { color: 'rgba(232,220,192,0.55)', fontSize: 9, letterSpacing: 2, textTransform: 'uppercase' },
  statStrip: {
    display: 'flex', justifyContent: 'space-between', padding: '7px 14px',
    background: '#0f0c08', borderBottom: '1px solid #2a241a',
  },
  statValue: { color: '#e8dcc0', fontSize: 13, fontWeight: 'bold' },
  statLabel: { color: '#9c8a5a', fontSize: 11 },
  bodyText: { color: '#cfc3a4', fontSize: 12 },
  chip: {
    padding: '2px 8px', borderRadius: 2, fontSize: 12, fontWeight: 'bold',
    border: '1px solid #0a0806', color: '#b6c48e', background: '#2a3020',
    boxShadow: '2px 2px 0 rgba(6,5,3,0.8)',
  },
  track: { height: 12, borderRadius: 2, border: '2px solid #0a0806', background: '#0f0c08', boxShadow: 'inset 2px 2px 0 rgba(6,5,3,0.8)', overflow: 'hidden' },
  fill: { height: '100%', width: '62%', background: '#8e1f22' },
  primaryBtn: {
    padding: '8px 18px', borderRadius: 2, cursor: 'pointer', fontFamily: 'Georgia, serif', fontSize: 12, fontWeight: 'bold', letterSpacing: 2, textTransform: 'uppercase',
    border: '2px solid #0a0806', color: '#e8dcc0', background: '#8e1f22',
    boxShadow: '3px 3px 0 rgba(6,5,3,0.85)', textShadow: '1px 1px 0 #0a0806',
  },
  secondaryBtn: {
    padding: '8px 18px', borderRadius: 2, cursor: 'pointer', fontFamily: 'Georgia, serif', fontSize: 12, letterSpacing: 2, textTransform: 'uppercase',
    border: '2px solid #0a0806', color: '#9c8a5a', background: '#1c1813',
    boxShadow: '3px 3px 0 rgba(6,5,3,0.85)',
  },
}

const EMBER: Direction = {
  name: 'C · Emberglass',
  tagline: 'Modern minimal dark fantasy — near-black glass, hairline gold, one ember accent.',
  notes: 'Idle-genre research says readability wins: quiet neutral surfaces, generous spacing, thin low-alpha borders, and colour reserved exclusively for progress + primary actions. Ornament comes from light (soft glow, translucency), not carving.',
  fontNote: 'Display & body: clean humanist sans (Inter class), engraved serif kept only for the logo',
  font: "'Segoe UI', system-ui, sans-serif",
  well: { background: '#0b0c0f' },
  swatches: [
    { label: 'bg', value: '#0b0c0f' }, { label: 'glass', value: '#15171c' },
    { label: 'hairline', value: '#3d3628' }, { label: 'ember', value: '#e08840' },
    { label: 'text', value: '#e6e2d8' }, { label: 'steel', value: '#7f8ea3' },
  ],
  panel: {
    borderRadius: 12, border: '1px solid rgba(224,180,120,0.22)',
    background: 'linear-gradient(180deg, rgba(255,255,255,0.035) 0%, rgba(255,255,255,0) 60%), #15171c',
    boxShadow: '0 12px 32px rgba(0,0,0,0.55)',
    overflow: 'hidden',
  },
  headerBar: {
    padding: '12px 16px', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8,
    borderBottom: '1px solid rgba(224,180,120,0.14)',
  },
  title: { color: '#e6e2d8', fontSize: 14, fontWeight: 600, letterSpacing: 0.3 },
  subtitle: { color: '#7f8ea3', fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase' },
  statStrip: {
    display: 'flex', justifyContent: 'space-between', padding: '8px 16px',
    background: 'rgba(0,0,0,0.25)', borderBottom: '1px solid rgba(255,255,255,0.05)',
  },
  statValue: { color: '#e08840', fontSize: 13, fontWeight: 600 },
  statLabel: { color: '#7f8ea3', fontSize: 11 },
  bodyText: { color: '#c9c4b8', fontSize: 12 },
  chip: {
    padding: '2px 9px', borderRadius: 999, fontSize: 12, fontWeight: 600,
    border: '1px solid rgba(224,136,64,0.4)', color: '#e08840', background: 'rgba(224,136,64,0.10)',
  },
  track: { height: 8, borderRadius: 999, background: 'rgba(255,255,255,0.07)', overflow: 'hidden' },
  fill: { height: '100%', width: '62%', borderRadius: 999, background: 'linear-gradient(90deg, #b85f24 0%, #e08840 100%)', boxShadow: '0 0 10px rgba(224,136,64,0.5)' },
  primaryBtn: {
    padding: '9px 20px', borderRadius: 8, cursor: 'pointer', fontFamily: "'Segoe UI', system-ui, sans-serif", fontSize: 12, fontWeight: 600, letterSpacing: 0.4,
    border: '1px solid rgba(224,136,64,0.55)', color: '#0b0c0f',
    background: 'linear-gradient(180deg, #eda05f 0%, #d97a2e 100%)',
    boxShadow: '0 0 14px rgba(224,136,64,0.35)',
  },
  secondaryBtn: {
    padding: '9px 20px', borderRadius: 8, cursor: 'pointer', fontFamily: "'Segoe UI', system-ui, sans-serif", fontSize: 12, fontWeight: 500, letterSpacing: 0.4,
    border: '1px solid rgba(255,255,255,0.14)', color: '#c9c4b8', background: 'rgba(255,255,255,0.04)',
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
        Three candidate looks for the whole game, each skinning the same sample panel. A evolves what
        exists; B trades ornament for ink-and-woodcut grimness (Darkest Dungeon lineage); C trades
        carving for quiet modern surfaces where colour only marks what's alive (idle-genre
        readability-first). Mix-and-match is allowed — e.g. B's type discipline on A's materials.
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 18, alignItems: 'stretch' }}>
        <DirectionBlock d={GILDED} />
        <DirectionBlock d={INK} />
        <DirectionBlock d={EMBER} />
      </div>
    </section>
  )
}

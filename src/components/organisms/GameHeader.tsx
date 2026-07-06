import { NavLink } from 'react-router-dom'
import { ResourceChip } from '../atoms/ResourceChip'
import { CoinDisplay } from '../atoms/CoinDisplay'
import { useAuthStore } from '@/stores/authStore'
import { signOut } from '@/services/auth'

const NAV = [
  { label: 'Missions', to: '/missions' },
  { label: 'Team', to: '/team' },
  { label: 'Infirmary', to: '/infirmary' },
  { label: 'Mines', to: '/mines' },
  { label: 'Upgrading', to: '/upgrading' },
  { label: 'Shop', to: '/shop' },
  { label: 'Inventory', to: '/inventory' },
  { label: 'Crafting', to: '/crafting' },
  { label: 'Upgrades', to: '/upgrades' },
  { label: 'Blessings', to: '/blessings' },
  { label: 'Transcendence', to: '/transcendence' },
  { label: 'Statistics', to: '/statistics' },
  { label: 'Design', to: '/design' }, // dev-only — remove before production
]

// Mock values for now — wired to a resources store/hook later.
const HEADER_ORES = [
  { label: 'Cu', value: 142 }, { label: 'Ag', value: 28 }, { label: 'Au', value: 5 }, { label: 'Pt', value: 0 },
]
const HEADER_MATERIALS = [
  { label: 'Wd', value: 300 }, { label: 'Co', value: 64 }, { label: 'St', value: 120 }, { label: 'Br', value: 12 }, { label: 'Fe', value: 88 },
]

function HeaderDivider() {
  return <div style={{ width: '2px', alignSelf: 'stretch', margin: '6px 4px', background: 'linear-gradient(180deg, transparent, var(--color-gold-dark), transparent)' }} />
}

function UserMenu() {
  const email = useAuthStore((s) => s.user?.email)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginLeft: 'auto' }}>
      {email && (
        <span style={{ color: 'var(--color-text-muted)', fontSize: 12, whiteSpace: 'nowrap' }}>{email}</span>
      )}
      <button
        type="button"
        onClick={() => { void signOut() }}
        className="btn btn-ghost"
        style={{
          padding: '5px 12px',
          fontFamily: 'Georgia, serif',
          fontSize: 12,
          letterSpacing: '1px',
          cursor: 'pointer',
          borderRadius: 5,
          border: '1px solid rgba(200,145,42,0.3)',
          background: 'transparent',
          color: 'var(--color-text-muted)',
          whiteSpace: 'nowrap',
        }}
      >Sign out</button>
    </div>
  )
}

export function GameHeader() {
  return (
    <header style={{
      position: 'sticky',
      top: 0,
      zIndex: 100,
      display: 'flex',
      flexDirection: 'column',
      borderBottom: '3px solid var(--color-gold-mid)',
      boxShadow: [
        '0 0 0 1px #080101',
        'inset 0 1px 0 rgba(255,255,255,0.06)',
        '0 4px 14px rgba(0,0,0,0.7)',
      ].join(', '),
    }}>
      {/* ── Tier 1: navigation ── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '14px',
        flexWrap: 'wrap',
        padding: '10px 18px',
        background: 'linear-gradient(180deg, #2a0d10 0%, #1a0608 100%)',
      }}>
        <NavLink to="/missions" style={{
          color: 'var(--color-gold-light)',
          fontSize: '15px',
          fontWeight: 'bold',
          letterSpacing: '1.5px',
          textTransform: 'uppercase',
          textShadow: '0 0 12px rgba(240,208,96,0.5), 0 2px 3px rgba(0,0,0,0.9)',
          whiteSpace: 'nowrap',
          textDecoration: 'none',
        }}>⚔ The Idle Game</NavLink>
        <nav style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center' }}>
          {NAV.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => isActive ? 'nav-link nav-link--active' : 'nav-link'}
            >{item.label}</NavLink>
          ))}
        </nav>
        <UserMenu />
      </div>

      {/* ── Tier 2: resources + currency (sunken strip, always shown) ── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-start',
        gap: '6px',
        flexWrap: 'wrap',
        padding: '8px 18px',
        borderTop: '2px solid var(--color-gold-dark)',
        background: 'linear-gradient(180deg, #0c0203 0%, #140405 100%)',
        boxShadow: 'inset 0 3px 8px rgba(0,0,0,0.6)',
      }}>
        {HEADER_ORES.map(r => <ResourceChip key={r.label} label={r.label} value={r.value} />)}
        <HeaderDivider />
        {HEADER_MATERIALS.map(r => <ResourceChip key={r.label} label={r.label} value={r.value} />)}
        <HeaderDivider />
        <CoinDisplay amount={1420} />
      </div>
    </header>
  )
}

import { NavLink } from 'react-router-dom'
import { ResourceChip } from '../atoms/ResourceChip'
import { CoinDisplay } from '../atoms/CoinDisplay'
import { IconSlot } from '../atoms/IconSlot'
import { useAuthStore } from '@/stores/authStore'
import { signOut } from '@/services/auth'
import { useProfile } from '@/hooks/useProfile'
import { CURRENCY_KEYS } from '@/lib/currencies'
import { RESOURCE_COLOR } from '@/lib/resources'

// Registry-driven display order for the resource strip (mine resources, in registry order).
const RESOURCE_ORDER = Object.keys(RESOURCE_COLOR)
const PRIMARY_CURRENCY = CURRENCY_KEYS[0] // 'gold'

const NAV = [
  { label: 'Missions', to: '/missions' },
  { label: 'Team', to: '/team' },
  { label: 'Recruits', to: '/recruits' },
  { label: 'Infirmary', to: '/infirmary' },
  { label: 'Mines', to: '/mines' },
  { label: 'Upgrading', to: '/upgrading' },
  { label: 'Shop', to: '/shop' },
  { label: 'Inventory', to: '/inventory' },
  { label: 'Crafting', to: '/crafting' },
  { label: 'Upgrades', to: '/upgrades' },
  { label: 'Blessings', to: '/blessings' },
  { label: 'Respec', to: '/respec' },
  { label: 'Transcendence', to: '/transcendence' },
  { label: 'Statistics', to: '/statistics' },
  { label: 'Game Stats', to: '/game-stats' },
  { label: 'Design', to: '/design' }, // dev-only — remove before production
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
  const { data: profile } = useProfile()
  const gold = profile?.currencies?.[PRIMARY_CURRENCY] ?? 0
  // Registry order, but only resources the player actually owns (>0) — ADR-0018.
  const ownedResources = RESOURCE_ORDER
    .map((key) => ({ label: key, value: profile?.resources?.[key] ?? 0 }))
    .filter((r) => r.value > 0)

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
          display: 'inline-flex', alignItems: 'center', gap: 7,
        }}><IconSlot size={15} />The Idle Game</NavLink>
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
        {ownedResources.map(r => <ResourceChip key={r.label} label={r.label} value={r.value} />)}
        {ownedResources.length > 0 && <HeaderDivider />}
        <CoinDisplay amount={gold} />
      </div>
    </header>
  )
}

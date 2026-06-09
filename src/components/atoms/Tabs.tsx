import { useState } from 'react'

export function Tabs({ tabs }: { tabs: string[] }) {
  const [active, setActive] = useState(tabs[0])
  return (
    <div style={{ display: 'flex', borderBottom: '2px solid var(--color-gold-dark)' }}>
      {tabs.map(t => (
        <button key={t} onClick={() => setActive(t)} className={active === t ? 'tab tab--active' : 'tab'}>{t}</button>
      ))}
    </div>
  )
}

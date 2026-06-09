import { useState } from 'react'

export function SegmentedControl({ options }: { options: string[] }) {
  const [active, setActive] = useState(options[0])
  return (
    <div className="segmented">
      {options.map(o => (
        <button key={o} onClick={() => setActive(o)} className={active === o ? 'is-active' : ''}>{o}</button>
      ))}
    </div>
  )
}

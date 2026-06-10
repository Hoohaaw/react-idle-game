import { useState } from 'react'

// Segmented filter/toggle. Works uncontrolled (manages its own active option) or
// controlled when `value` + `onChange` are passed (so it can drive a parent's view).
export function SegmentedControl({ options, value, onChange }: {
  options: string[]
  value?: string
  onChange?: (value: string) => void
}) {
  const [internal, setInternal] = useState(options[0])
  const active = value ?? internal
  const select = (o: string) => { setInternal(o); onChange?.(o) }
  return (
    <div className="segmented">
      {options.map(o => (
        <button key={o} onClick={() => select(o)} className={active === o ? 'is-active' : ''}>{o}</button>
      ))}
    </div>
  )
}

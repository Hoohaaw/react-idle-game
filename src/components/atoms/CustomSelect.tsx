import { useState } from 'react'

// Custom dropdown — fully styled list (native <select> can't restyle its open menu).
export function CustomSelect({ options, initial }: { options: { value: string; label: string }[]; initial?: string }) {
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState(initial ?? options[0].value)
  const current = options.find(o => o.value === value) ?? options[0]
  return (
    <div style={{ position: 'relative', maxWidth: 240 }}>
      <button
        type="button"
        className="select-fantasy"
        onClick={() => setOpen(o => !o)}
        style={{ width: '100%', textAlign: 'left' }}
      >{current.label}</button>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 50 }} />
          <ul className="select-list" style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 51 }}>
            {options.map(o => (
              <li key={o.value}>
                <button
                  type="button"
                  className={o.value === value ? 'select-option is-selected' : 'select-option'}
                  onClick={() => { setValue(o.value); setOpen(false) }}
                >{o.label}</button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

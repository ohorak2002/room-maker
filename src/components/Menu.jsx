import { useEffect, useRef, useState } from 'react'

/**
 * A small dropdown menu: a trigger button and a list of actions. Closes on
 * outside click, Escape, or after an action runs. Items: { label, onSelect,
 * disabled, hidden }.
 */
export default function Menu({ label, trigger, items, align = 'end', disabled, className = '' }) {
  const [open, setOpen] = useState(false)
  const root = useRef(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e) => { if (!root.current?.contains(e.target)) setOpen(false) }
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('pointerdown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  // Move focus into the list so arrow keys and Escape work straight away.
  useEffect(() => {
    if (open) root.current?.querySelector('[role="menuitem"]:not(:disabled)')?.focus()
  }, [open])

  const onListKey = (e) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    e.preventDefault()
    const all = [...root.current.querySelectorAll('[role="menuitem"]:not(:disabled)')]
    const i = all.indexOf(document.activeElement)
    const next = e.key === 'ArrowDown' ? (i + 1) % all.length : (i - 1 + all.length) % all.length
    all[next]?.focus()
  }

  return (
    <div className={`menu ${className}`} ref={root}>
      <button
        type="button"
        className="menu-trigger"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
      >
        {trigger}
      </button>
      {open && (
        <div className={`menu-list align-${align}`} role="menu" onKeyDown={onListKey}>
          {items.filter((i) => !i.hidden).map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              className="menu-item"
              disabled={item.disabled}
              onClick={() => { setOpen(false); item.onSelect() }}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

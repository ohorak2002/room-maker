import { useEffect } from 'react'

const GROUPS = [
  {
    title: 'Moving a piece',
    rows: [
      ['Click a piece', ['Click']],
      ['Drag it anywhere on the floor', ['Drag']],
      ['Nudge a small step', ['←', '→', '↑', '↓']],
      ['Nudge a big step', ['Shift', '+ arrow']],
      ['Rotate 22.5°', ['R']],
      ['Remove it', ['Delete']],
    ],
  },
  {
    title: 'The room',
    rows: [
      ['Orbit the camera', ['Drag empty space']],
      ['Zoom in and out', ['Scroll']],
      ['Undo the last change', ['Ctrl', 'Z']],
      ['Re-run the layout solver', ['Auto-arrange']],
    ],
  },
  {
    title: 'This sheet',
    rows: [
      ['Open shortcuts', ['?']],
      ['Close', ['Esc']],
    ],
  },
]

export default function Shortcuts({ open, onClose }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="shortcuts-scrim"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard shortcuts"
    >
      <div className="shortcuts-card" onClick={(e) => e.stopPropagation()}>
        <h2>Shortcuts</h2>
        <p className="shortcuts-sub">Everything here works while the 3D view has focus.</p>

        {GROUPS.map((g) => (
          <div key={g.title} className="shortcuts-group">
            <h3>{g.title}</h3>
            {g.rows.map(([label, keys]) => (
              <div key={label} className="shortcut-row">
                <span>{label}</span>
                <span className="shortcut-keys">
                  {keys.map((k) => (
                    <kbd key={k}>{k}</kbd>
                  ))}
                </span>
              </div>
            ))}
          </div>
        ))}

        <button className="btn-primary" onClick={onClose}>
          Got it
        </button>
      </div>
    </div>
  )
}

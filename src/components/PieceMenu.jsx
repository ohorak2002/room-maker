import { useEffect, useRef } from 'react'
import './PieceMenu.css'

/**
 * Right-click menu for a piece in the room. Desktop users reach for this before
 * they look for a toolbar, and it puts duplicate/rotate/remove one click away
 * instead of behind keyboard shortcuts nobody has discovered yet.
 */
export default function PieceMenu({ menu, onAction, onClose }) {
  const ref = useRef(null)

  useEffect(() => {
    if (!menu) return
    const onKey = (e) => e.key === 'Escape' && onClose()
    const onDown = (e) => {
      if (!ref.current?.contains(e.target)) onClose()
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('pointerdown', onDown, true)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('pointerdown', onDown, true)
    }
  }, [menu, onClose])

  if (!menu) return null

  // Keep the menu on screen when the click lands near an edge.
  const style = {
    left: Math.min(menu.x, window.innerWidth - 210),
    top: Math.min(menu.y, window.innerHeight - 190),
  }

  const items = [
    { id: 'duplicate', label: 'Duplicate', keys: null },
    { id: 'rotate', label: 'Rotate 45°', keys: 'R' },
    { id: 'center', label: 'Send to centre', keys: null },
    { id: 'sep' },
    { id: 'remove', label: 'Remove', keys: 'Del', danger: true },
  ]

  return (
    <div ref={ref} className="piece-menu" style={style} role="menu">
      <p className="piece-menu-title">{menu.name}</p>
      {items.map((it, i) =>
        it.id === 'sep' ? (
          <hr key={i} className="piece-menu-sep" />
        ) : (
          <button
            key={it.id}
            role="menuitem"
            className={`piece-menu-item ${it.danger ? 'danger' : ''}`}
            onClick={() => {
              onAction(it.id, menu)
              onClose()
            }}
          >
            <span>{it.label}</span>
            {it.keys && <kbd>{it.keys}</kbd>}
          </button>
        )
      )}
    </div>
  )
}

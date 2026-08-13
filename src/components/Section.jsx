import { useState } from 'react'

/**
 * A collapsible panel section. On a phone the Design panel is only ~46% of the
 * screen, and an always-expanded palette list pushed everything else below the
 * fold — collapsing is what makes the rest of the controls reachable.
 */
export default function Section({ title, summary, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <section className={`ctl-section ${open ? 'is-open' : ''}`}>
      <button
        className="ctl-head"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="ctl-title">{title}</span>
        {summary && <span className="ctl-summary">{summary}</span>}
        <svg className="ctl-chevron" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
          <path
            d="M4 6l4 4 4-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      {open && <div className="ctl-body">{children}</div>}
    </section>
  )
}

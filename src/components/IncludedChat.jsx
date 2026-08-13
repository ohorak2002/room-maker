import { useState } from 'react'
import { useRoomStore } from '../store/roomStore'
import { byId } from '../data/catalog'
import { parsePrefurnished } from '../data/prefurnishedParser'
import './IncludedChat.css'

/**
 * Type what your place came with, in your own words.
 *
 * See src/data/prefurnishedParser.js for how the matching works — the short
 * version is keyword matching against a synonym table, not a language model.
 */
export default function IncludedChat() {
  const store = useRoomStore()
  const [text, setText] = useState('')
  const [unmatched, setUnmatched] = useState([])

  const submit = (e) => {
    e?.preventDefault()
    if (!text.trim()) return
    const { found, leftovers } = parsePrefurnished(text)
    if (found.length) {
      const next = [...new Set([...store.prefurnished, ...found])]
      store.set('prefurnished', next)
    }
    setUnmatched(found.length ? [] : leftovers.slice(0, 3))
    setText('')
  }

  const drop = (id) =>
    store.set('prefurnished', store.prefurnished.filter((p) => p !== id))

  return (
    <div className="included">
      <p className="note">
        Tell us what your place already came with, in plain words — those pieces get flagged in the
        shop so you don't buy them twice.
      </p>

      <form className="included-form" onSubmit={submit}>
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="e.g. it came with a bed, blinds and a desk"
          aria-label="What came with your place"
        />
        <button type="submit" className="btn-primary">
          Add
        </button>
      </form>

      {unmatched.length > 0 && (
        <p className="unmatched">
          Didn't recognise {unmatched.map((u) => `"${u}"`).join(', ')}. Try naming the piece the way
          a store would — "couch", "nightstand", "blinds".
        </p>
      )}

      {store.prefurnished.length > 0 && (
        <ul className="included-list">
          {store.prefurnished.map((id) => (
            <li key={id}>
              <span>{byId(id)?.name || id}</span>
              <button onClick={() => drop(id)} aria-label={`Remove ${byId(id)?.name || id}`}>
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

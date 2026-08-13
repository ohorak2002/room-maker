import { useState } from 'react'
import { useRoomStore } from '../store/roomStore'
import { CATALOG, byId } from '../data/catalog'
import './IncludedChat.css'

/**
 * Type what your place came with, in your own words.
 *
 * This is keyword matching against the catalog, not a language model — there is
 * no API key in this app and no server to hold one. It handles the phrasings
 * people actually use ("it came with a queen bed and blinds") by matching item
 * names, categories, and a synonym table. Anything it can't place is listed back
 * so you know it wasn't understood, rather than silently dropped.
 */

// Words people use that don't appear in any product name.
const SYNONYMS = {
  bed: ['bed', 'mattress', 'queen', 'full size', 'twin', 'king', 'bedframe', 'bed frame'],
  desk: ['desk', 'workspace', 'study table', 'writing table'],
  'desk-chair': ['desk chair', 'office chair', 'task chair', 'rolling chair', 'swivel'],
  sofa: ['sofa', 'couch', 'loveseat', 'settee'],
  bookshelf: ['bookshelf', 'shelving', 'shelves', 'bookcase', 'storage unit'],
  curtains: ['curtain', 'curtains', 'blinds', 'shades', 'drapes', 'window covering'],
  nightstand: ['nightstand', 'night stand', 'bedside table', 'side table'],
  'coffee-table': ['coffee table', 'centre table', 'center table'],
  rug: ['rug', 'carpet', 'carpeting', 'area rug'],
  'floor-lamp': ['floor lamp', 'standing lamp', 'lamp'],
  'desk-lamp': ['desk lamp', 'table lamp', 'reading lamp'],
  tv: ['tv', 'television', 'smart tv', 'flatscreen', 'flat screen'],
  'floor-mirror': ['mirror', 'full length mirror', 'floor mirror'],
  monitor: ['monitor', 'display', 'screen'],
  'pc-tower': ['pc', 'computer', 'desktop', 'tower'],
}

/** Longest phrases first so "desk chair" wins over "desk". */
const MATCHERS = Object.entries(SYNONYMS)
  .flatMap(([id, words]) => words.map((w) => ({ id, w: w.toLowerCase() })))
  .concat(CATALOG.map((i) => ({ id: i.id, w: i.name.toLowerCase() })))
  .sort((a, b) => b.w.length - a.w.length)

function parse(text) {
  let hay = ` ${text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ')} `
  const found = []
  for (const { id, w } of MATCHERS) {
    if (found.includes(id)) continue
    if (hay.includes(` ${w} `) || hay.includes(` ${w}s `)) {
      found.push(id)
      // Consume the phrase so "desk chair" doesn't also register as "desk".
      hay = hay.split(` ${w} `).join(' ').split(` ${w}s `).join(' ')
    }
  }
  // Whatever's left that looked like a noun phrase and matched nothing. Filler
  // is stripped from both ends so we quote the actual noun back, not
  // "the place has a flurgle".
  const FILLER = /^(it|the|a|an|and|with|has|have|had|came|comes|come|my|is|are|was|were|there|also|already|plus|some|place|apartment|flat|room|unit|building|includes|included|including|got|we|i|they)$/
  const leftovers = hay
    .split(/\band\b|,|\bplus\b/)
    .map((s) => {
      const words = s.trim().split(/\s+/).filter(Boolean)
      while (words.length && FILLER.test(words[0])) words.shift()
      while (words.length && FILLER.test(words[words.length - 1])) words.pop()
      return words.join(' ')
    })
    .filter((s) => s.length > 2)
  return { found, leftovers }
}

export default function IncludedChat() {
  const store = useRoomStore()
  const [text, setText] = useState('')
  const [unmatched, setUnmatched] = useState([])

  const submit = (e) => {
    e?.preventDefault()
    if (!text.trim()) return
    const { found, leftovers } = parse(text)
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

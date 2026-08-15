import { useRef, useState } from 'react'
import { useRoomStore } from '../store/roomStore'
import PillowMark from './PillowMark'
import HeroRoom from './HeroRoom'
import AddressField from './AddressField'
import MoodPreview from './MoodPreview'
import LightPreview from './LightPreview'
import MaterialPreview from './MaterialPreview'
import { PALETTES, MOODS, LIGHTING, WALL_MATERIALS, ROOM_TYPES, rectShapeFromFeet, mToFt } from '../data/presets'
import { parsePrefurnished } from '../data/prefurnishedParser'
import { byId } from '../data/catalog'
import './Onboarding.css'

const PREFURNISHED = [
  { id: 'bed', label: 'Bed frame' },
  { id: 'desk', label: 'Desk' },
  { id: 'desk-chair', label: 'Desk chair' },
  { id: 'sofa', label: 'Couch' },
  { id: 'bookshelf', label: 'Shelving' },
  { id: 'nightstand', label: 'Nightstand' },
  { id: 'coffee-table', label: 'Coffee table' },
  { id: 'rug', label: 'Rug or carpet' },
  { id: 'curtains', label: 'Blinds or curtains' },
  { id: 'floor-lamp', label: 'Floor lamp' },
  { id: 'floor-mirror', label: 'Mirror' },
  { id: 'tv', label: 'TV' },
]

const STEPS = [
  {
    key: 'residence',
    type: 'residence',
    question: 'Where are you living?',
    hint: 'Optional — helps us personalize the starting size on the last step.',
  },
  {
    key: 'palette',
    question: 'What colors do you want to live in?',
    hint: 'Pick the one you would not get tired of.',
    options: PALETTES,
    render: (p) => (
      <div className="swatch-row">
        {[p.wall, p.floor, p.trim, p.accent, p.secondary].map((c, i) => (
          <span key={i} className="swatch" style={{ background: c }} />
        ))}
      </div>
    ),
  },
  {
    key: 'mood',
    question: 'How should the room feel?',
    hint: 'A picture of the feeling, not just the word for it.',
    options: MOODS,
    render: (m) => <MoodPreview moodId={m.id} />,
  },
  {
    key: 'lighting',
    question: 'What kind of light?',
    hint: 'Light changes a room more than paint does.',
    options: LIGHTING,
    render: (l) => <LightPreview kelvin={l.kelvin} id={l.id} />,
  },
  {
    key: 'wallMaterial',
    question: 'What are the walls made of?',
    hint: "The surface, not the colour — exposed brick stays brick whatever you paint the room.",
    options: WALL_MATERIALS,
    render: (m) => <MaterialPreview id={m.id} />,
  },
  { key: 'size', type: 'size', question: 'How big is the room?', hint: 'Start from a realistic size, then dial it in exactly.' },
]

export default function Onboarding() {
  const store = useRoomStore()
  const [step, setStep] = useState(-1)
  const [leaving, setLeaving] = useState(false)

  const go = (next) => {
    setLeaving(true)
    setTimeout(() => {
      setStep(next)
      setLeaving(false)
    }, 180)
  }

  const finish = () => {
    setLeaving(true)
    setTimeout(() => store.finishOnboarding(), 180)
  }

  if (step === -1) {
    return (
      <div className="onboard">
        <HouseMark />
        <HeroRoom palette={store.palette} />
        <div className={`onboard-stage welcome ${leaving ? 'is-leaving' : 'is-entering'}`}>
          <div className="brand-lockup">
            <PillowMark size={116} className="hero-mark" />
            <p className="wordmark">Nested</p>
          </div>
          <h1>You don't have to picture it.</h1>
          <p className="lede">
            Answer five questions about your space and what you like. We'll build the room from your
            answers, arrange it for you, and let you drag anything you want to move.
          </p>
          <div className="welcome-actions">
            <button className="btn-primary" onClick={() => go(0)}>
              Start
            </button>
            {/* Every answer already has a sensible default, so the survey is a
                way to get a better room rather than a gate in front of one.
                Making someone answer six questions before they can see whether
                the thing is worth their time is how you lose the ones who were
                only curious. Everything here is changeable afterwards in the
                Design panel. */}
            <button className="btn-quiet" onClick={finish}>
              Skip to the room
            </button>
          </div>
        </div>
      </div>
    )
  }

  const s = STEPS[step]
  const isLast = step === STEPS.length - 1

  return (
    <div className="onboard">
      <HouseMark />
      <div className="onboard-top">
        <PillowMark size={20} className="progress-mark" />
        <div className="progress" role="group" aria-label={`Step ${step + 1} of ${STEPS.length}`}>
          {STEPS.map((_, i) => (
            <span key={i} className={`tick ${i <= step ? 'done' : ''}`} />
          ))}
        </div>
        <span className="step-count">
          {step + 1} / {STEPS.length}
        </span>
      </div>

      <div className={`onboard-stage ${leaving ? 'is-leaving' : 'is-entering'}`} key={s.key}>
        <h2>{s.question}</h2>
        <p className="hint">{s.hint}</p>

        {s.type === 'residence' && <ResidenceStep store={store} />}
        {s.type === 'size' && <RoomSizeStep store={store} />}
        {!s.type && (
          <div className="option-grid">
            {s.options.map((opt) => (
              <button
                key={opt.id}
                className={`option-card ${store[s.key] === opt.id ? 'selected' : ''}`}
                aria-pressed={store[s.key] === opt.id}
                onClick={() => store.set(s.key, opt.id)}
              >
                {s.render && s.render(opt)}
                <span className="option-name">{opt.name}</span>
                <span className="option-blurb">{opt.blurb}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="onboard-nav">
        <button className="btn-quiet" onClick={() => go(step - 1)}>
          {step === 0 ? 'Back' : 'Previous'}
        </button>
        <div className="nav-right">
          {!isLast && (
            <button className="btn-quiet" onClick={finish}>
              Skip the rest
            </button>
          )}
          <button className="btn-primary" onClick={() => (isLast ? finish() : go(step + 1))}>
            {isLast ? 'Build my room' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------

/**
 * A sectional drawing of a house — two floors, a pitched roof, and furnished
 * rooms — sitting behind the questions at low opacity. It's the subject of the
 * app rendered the way an architect would draw it, rather than a stock photo.
 * Strokes use currentColor so it reads correctly in both themes.
 */
function HouseMark() {
  return (
    <svg className="house-mark" viewBox="0 0 520 360" fill="none" aria-hidden="true">
      <g stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
        {/* roof */}
        <path d="M40 150 L260 24 L480 150" />
        <path d="M40 150 L480 150" />
        {/* outer walls */}
        <path d="M70 150 L70 336 L450 336 L450 150" />
        {/* floor slab */}
        <path d="M70 244 L450 244" />
        {/* interior partitions */}
        <path d="M215 244 L215 336" />
        <path d="M320 150 L320 244" />
        <path d="M20 336 L500 336" strokeWidth="3" />
      </g>

      <g stroke="currentColor" strokeWidth="1.6">
        {/* upper left: bed + nightstand */}
        <rect x="100" y="196" width="70" height="44" rx="3" />
        <path d="M100 210 L170 210" />
        <rect x="176" y="222" width="18" height="18" rx="2" />
        {/* upper right: desk + chair */}
        <rect x="346" y="182" width="76" height="20" rx="2" />
        <circle cx="384" cy="220" r="13" />
        {/* lower left: sofa + table */}
        <rect x="96" y="286" width="88" height="34" rx="4" />
        <path d="M96 298 L184 298" />
        <circle cx="140" cy="266" r="14" />
        {/* lower right: shelving + plant */}
        <rect x="360" y="272" width="60" height="60" rx="2" />
        <path d="M360 292 L420 292 M360 312 L420 312" />
        <path d="M262 332 L262 300" />
        <path d="M262 300 q-16 -4 -14 -20 q16 2 14 20" />
        <path d="M262 306 q16 -4 14 -22 q-16 4 -14 22" />
        {/* windows in the roof gable */}
        <rect x="238" y="86" width="44" height="34" rx="2" />
        <path d="M260 86 L260 120 M238 103 L282 103" />
      </g>
    </svg>
  )
}

function ResidenceStep({ store }) {
  const [otherText, setOtherText] = useState('')
  const [unmatched, setUnmatched] = useState([])

  const toggle = (id) => {
    const has = store.prefurnished.includes(id)
    store.set('prefurnished', has ? store.prefurnished.filter((p) => p !== id) : [...store.prefurnished, id])
  }

  const addOther = (e) => {
    e.preventDefault()
    if (!otherText.trim()) return
    const { found, leftovers } = parsePrefurnished(otherText)
    if (found.length) {
      store.set('prefurnished', [...new Set([...store.prefurnished, ...found])])
    }
    setUnmatched(found.length ? [] : leftovers.slice(0, 3))
    setOtherText('')
  }

  return (
    <div className="residence">
      <label className="field">
        <span className="field-label">Address, apartment complex, etc.</span>
        <AddressField
          value={store.residence}
          onChange={(v) => store.set('residence', v)}
          placeholder="Start typing an address or building name"
        />
      </label>

      <p className="privacy-note">
        Stays on your device. Address suggestions come from a public map service as you type; nothing
        else about you is ever sent anywhere.
      </p>

      <fieldset className="prefurn">
        <legend className="field-label">What came with the place?</legend>
        <p className="field-hint">
          We'll skip these in recommendations so you don't buy what you already have.
        </p>
        <div className="prefurn-grid">
          {PREFURNISHED.map((p) => (
            <label key={p.id} className={`prefurn-item ${store.prefurnished.includes(p.id) ? 'on' : ''}`}>
              <input
                type="checkbox"
                checked={store.prefurnished.includes(p.id)}
                onChange={() => toggle(p.id)}
              />
              <span>{p.label}</span>
            </label>
          ))}
        </div>

        <form className="prefurn-other" onSubmit={addOther}>
          <input
            type="text"
            value={otherText}
            onChange={(e) => setOtherText(e.target.value)}
            placeholder="Other — describe it, e.g. &quot;a dresser and a ceiling fan&quot;"
            aria-label="Other items that came with the place"
          />
          <button type="submit" className="btn-quiet bordered">
            Add
          </button>
        </form>
        {unmatched.length > 0 && (
          <p className="unmatched">
            Didn't recognize {unmatched.map((u) => `"${u}"`).join(', ')} — try naming it the way a
            store would.
          </p>
        )}

        {store.prefurnished.length > 0 && (
          <ul className="prefurn-tags">
            {store.prefurnished.map((id) => (
              <li key={id}>
                {byId(id)?.name || id}
                <button type="button" onClick={() => toggle(id)} aria-label={`Remove ${id}`}>
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </fieldset>
    </div>
  )
}

function RoomSizeStep({ store }) {
  const fileRef = useRef(null)
  const current = store.dims()
  const [ft, setFt] = useState({
    w: round1(mToFt(current.w)),
    d: round1(mToFt(current.d)),
    h: round1(mToFt(current.h)),
  })
  const [typeId, setTypeId] = useState(null)

  const apply = (next) => {
    setFt(next)
    store.set('customShape', rectShapeFromFeet(next.w, next.d, next.h))
  }

  const pickType = (t) => {
    setTypeId(t.id)
    apply({ w: t.wFt, d: t.dFt, h: t.hFt })
  }

  const onPlan = (file) => {
    if (!file || !file.type.startsWith('image/')) return
    const fr = new FileReader()
    fr.onload = () => store.set('planImage', fr.result)
    fr.readAsDataURL(file)
  }

  return (
    <div className="room-size">
      <p className="field-label">
        {store.residence ? `Typical size, so you're not starting from nothing` : 'What kind of room is this?'}
      </p>
      <div className="type-grid">
        {ROOM_TYPES.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`type-card ${typeId === t.id ? 'selected' : ''}`}
            onClick={() => pickType(t)}
          >
            <span className="type-name">{t.name}</span>
            <span className="type-blurb">{t.blurb}</span>
          </button>
        ))}
      </div>
      <p className="field-hint">
        These are published U.S. averages for that kind of room — not your specific unit, since no
        public source maps an address to a real floorplan. Use them as a realistic starting point,
        then set your exact numbers below.
      </p>

      <div className="exact-dims">
        <h3 className="field-label">Exact dimensions</h3>
        <div className="dims-grid">
          {[
            ['w', 'Width'],
            ['d', 'Depth'],
            ['h', 'Ceiling'],
          ].map(([k, label]) => (
            <label key={k} className="field">
              <span className="field-label">{label} (ft)</span>
              <input
                type="number"
                min="5"
                max="60"
                step="0.5"
                value={ft[k]}
                onChange={(e) => apply({ ...ft, [k]: Number(e.target.value) })}
              />
            </label>
          ))}
        </div>
        <p className="field-hint">
          Rounds to the nearest half-meter for the 3D grid — close enough to plan a real layout
          around.
        </p>
      </div>

      <div className="plan-upload">
        <button className="btn-quiet bordered" onClick={() => fileRef.current?.click()}>
          {store.planImage ? 'Replace floorplan image' : 'Upload your floorplan'}
        </button>
        {store.planImage && (
          <button className="link-btn" onClick={() => store.set('planImage', null)}>
            Remove
          </button>
        )}
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => onPlan(e.target.files?.[0])} />
      </div>

      {store.planImage && (
        <div className="plan-preview">
          <img src={store.planImage} alt="Your uploaded floorplan" />
          <p className="field-hint">
            Reference only — you can trace an exact non-rectangular shape from this later, in
            Design → Room shape.
          </p>
        </div>
      )}
    </div>
  )
}

const round1 = (n) => Math.round(n * 10) / 10

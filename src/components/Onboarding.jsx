import { useRef, useState } from 'react'
import { useRoomStore } from '../store/roomStore'
import PillowMark from './PillowMark'
import HeroRoom from './HeroRoom'
import { PALETTES, MOODS, LIGHTING, ROOM_SHAPES, CELL } from '../data/presets'
import './Onboarding.css'

const PREFURNISHED = [
  { id: 'bed', label: 'Bed frame' },
  { id: 'desk', label: 'Desk' },
  { id: 'desk-chair', label: 'Desk chair' },
  { id: 'sofa', label: 'Couch' },
  { id: 'bookshelf', label: 'Shelving' },
  { id: 'curtains', label: 'Blinds or curtains' },
]

const STEPS = [
  { key: 'residence', type: 'residence', question: 'Where are you living?', hint: 'Optional — this only shapes the starting dimensions.' },
  {
    key: 'palette',
    question: 'What colors do you want to live in?',
    hint: 'Pick the one you would not get tired of.',
    options: PALETTES,
    render: (p) => (
      <div className="swatch-row">
        {[p.wall, p.floor, p.trim, p.accent].map((c) => (
          <span key={c} className="swatch" style={{ background: c }} />
        ))}
      </div>
    ),
  },
  {
    key: 'mood',
    question: 'How should the room feel?',
    hint: 'This drives which pieces get recommended to you.',
    options: MOODS,
  },
  {
    key: 'lighting',
    question: 'What kind of light?',
    hint: 'Light changes a room more than paint does.',
    options: LIGHTING,
    render: (l) => (
      <div className="kelvin-bar">
        <span className="kelvin-dot" style={{ background: kelvinToHex(l.kelvin) }} />
        <span className="kelvin-label">{l.kelvin}K</span>
      </div>
    ),
  },
  {
    key: 'floorplan',
    type: 'floorplan',
    question: 'How much room are we working with?',
    hint: "Pick the closest shape — you can paint your exact footprint later.",
    options: ROOM_SHAPES,
    render: (f) => (
      <div className="dims">
        {(f.cols * CELL).toFixed(1)}m × {(f.rows * CELL).toFixed(1)}m
      </div>
    ),
  },
]

function kelvinToHex(k) {
  if (k <= 2400) return '#FFB16B'
  if (k <= 3000) return '#FFD1A3'
  if (k <= 5000) return '#FFF1DE'
  if (k <= 6000) return '#FFFFFF'
  return '#DCE9FF'
}

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
          <p className="eyebrow">
            <PillowMark size={20} className="eyebrow-mark" />
            Room Maker
          </p>
          <h1>You don't have to picture it.</h1>
          <p className="lede">
            Answer five questions about your space and what you like. We'll build the room from your
            answers, arrange it for you, and let you drag anything you want to move.
          </p>
          <div className="welcome-actions">
            <button className="btn-primary" onClick={() => go(0)}>
              Start
            </button>
            <button className="btn-quiet" onClick={finish}>
              Skip to the editor
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
        <PillowMark size={18} className="progress-mark" />
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

        {s.type === 'residence' ? (
          <ResidenceStep store={store} />
        ) : (
          <>
            <div className="option-grid">
              {s.options.map((opt) => (
                <button
                  key={opt.id}
                  className={`option-card ${store[s.key] === opt.id && !store.customDims ? 'selected' : ''}`}
                  aria-pressed={store[s.key] === opt.id}
                  onClick={() => {
                    store.set(s.key, opt.id)
                    if (s.type === 'floorplan') store.set('customDims', null)
                  }}
                >
                  {s.render && s.render(opt)}
                  <span className="option-name">{opt.name}</span>
                  <span className="option-blurb">{opt.blurb}</span>
                </button>
              ))}
            </div>
            {s.type === 'floorplan' && <ExactDims store={store} />}
          </>
        )}
      </div>

      <div className="onboard-nav">
        <button className="btn-quiet" onClick={() => go(step - 1)}>
          {step === 0 ? 'Back' : 'Previous'}
        </button>
        <div className="nav-right">
          {/* Every question has a sensible default, so nothing here is required. */}
          <button className="btn-quiet" onClick={finish}>
            Skip the rest
          </button>
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
  const toggle = (id) => {
    const has = store.prefurnished.includes(id)
    store.set('prefurnished', has ? store.prefurnished.filter((p) => p !== id) : [...store.prefurnished, id])
  }

  return (
    <div className="residence">
      <label className="field">
        <span className="field-label">Building or complex</span>
        <input
          type="text"
          placeholder="e.g. The Hub Athens"
          value={store.residence}
          onChange={(e) => store.set('residence', e.target.value)}
        />
      </label>

      <p className="privacy-note">
        Stored in this browser only — never sent anywhere, and we don't ask for a unit number.
        There's no public data feed for apartment floorplans, so this doesn't look anything up. Grab
        the floorplan PDF your complex sent with your lease and type the dimensions in on the last
        step — that's how you get an exact match.
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
      </fieldset>
    </div>
  )
}

function ExactDims({ store }) {
  const fileRef = useRef(null)
  const d = store.customDims || store.dims()
  const on = !!store.customDims

  const update = (k, v) => {
    const next = { ...(store.customDims || store.dims()), [k]: Number(v) }
    store.set('customDims', next)
  }

  const onPlan = (file) => {
    if (!file || !file.type.startsWith('image/')) return
    const fr = new FileReader()
    fr.onload = () => store.set('planImage', fr.result)
    fr.readAsDataURL(file)
  }

  return (
    <div className="exact-dims">
      <div className="exact-head">
        <h3 className="field-label">Exact dimensions</h3>
        {on && (
          <button className="link-btn" onClick={() => store.set('customDims', null)}>
            Use a preset instead
          </button>
        )}
      </div>

      <div className="dims-grid">
        {[
          ['w', 'Width'],
          ['d', 'Depth'],
          ['h', 'Ceiling'],
        ].map(([k, label]) => (
          <label key={k} className="field">
            <span className="field-label">{label} (m)</span>
            <input
              type="number"
              min="1.5"
              max="20"
              step="0.1"
              value={d[k]}
              onChange={(e) => update(k, e.target.value)}
            />
          </label>
        ))}
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
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => onPlan(e.target.files?.[0])}
        />
      </div>

      {store.planImage && (
        <div className="plan-preview">
          <img src={store.planImage} alt="Your uploaded floorplan" />
          <p className="field-hint">
            Reference only — read the dimensions off this and type them above.
          </p>
        </div>
      )}
    </div>
  )
}

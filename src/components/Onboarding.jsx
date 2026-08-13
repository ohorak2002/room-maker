import { useState } from 'react'
import { useRoomStore } from '../store/roomStore'
import { PALETTES, MOODS, LIGHTING, FLOORPLANS } from '../data/presets'
import './Onboarding.css'

const STEPS = [
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
    hint: 'This shapes proportion, materials, and how much empty space you keep.',
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
    question: 'How much room are we working with?',
    hint: 'You can change the dimensions later.',
    options: FLOORPLANS,
    render: (f) => (
      <div className="dims">
        {f.w}m × {f.d}m
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
  const [step, setStep] = useState(-1) // -1 is the welcome card
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
        <div className={`onboard-stage welcome ${leaving ? 'is-leaving' : 'is-entering'}`}>
          <p className="eyebrow">Room Maker</p>
          <h1>You don't have to picture it.</h1>
          <p className="lede">
            Answer four questions about what you like — color, feeling, light, size. We'll build the
            room from your answers, then you can shop it piece by piece.
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
  const selected = store[s.key]
  const isLast = step === STEPS.length - 1

  return (
    <div className="onboard">
      <div className="onboard-top">
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

        <div className="option-grid">
          {s.options.map((opt) => (
            <button
              key={opt.id}
              className={`option-card ${selected === opt.id ? 'selected' : ''}`}
              aria-pressed={selected === opt.id}
              onClick={() => store.set(s.key, opt.id)}
            >
              {s.render && s.render(opt)}
              <span className="option-name">{opt.name}</span>
              <span className="option-blurb">{opt.blurb}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="onboard-nav">
        <button className="btn-quiet" onClick={() => go(step - 1)}>
          {step === 0 ? 'Back' : 'Previous'}
        </button>
        <button className="btn-primary" onClick={() => (isLast ? finish() : go(step + 1))}>
          {isLast ? 'Build my room' : 'Next'}
        </button>
      </div>
    </div>
  )
}

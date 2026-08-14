import { useState } from 'react'
import { useRoomStore } from '../store/roomStore'
import { generateHome, roomSqft, ROOM_KIND_COLORS } from '../data/homeLayout'
import FloorplanTracer from './FloorplanTracer'
import './HomePanel.css'

const PRESETS = [
  { label: 'Studio apartment', beds: 0, baths: 1, sqft: 500 },
  { label: '1 bed apartment', beds: 1, baths: 1, sqft: 750 },
  { label: '2 bed apartment', beds: 2, baths: 2, sqft: 1100 },
  { label: 'Student 4×4', beds: 4, baths: 4, sqft: 1400 },
  { label: 'Student 5×4', beds: 5, baths: 4, sqft: 1650 },
  { label: '3 bed house', beds: 3, baths: 2, sqft: 1800 },
  { label: '4 bed house', beds: 4, baths: 3, sqft: 2600 },
]

export default function HomePanel() {
  const store = useRoomStore()
  const [beds, setBeds] = useState(store.home?.beds ?? 2)
  const [baths, setBaths] = useState(store.home?.baths ?? 1)
  const [sqft, setSqft] = useState(store.home?.sqft ?? 1000)
  const [ceilingFt, setCeilingFt] = useState(9)
  const [tracing, setTracing] = useState(false)

  const build = () => store.setHome(generateHome({ beds, baths, sqft, ceilingFt }))

  const applyPreset = (p) => {
    setBeds(p.beds)
    setBaths(p.baths)
    setSqft(p.sqft)
    store.setHome(generateHome({ beds: p.beds, baths: p.baths, sqft: p.sqft, ceilingFt }))
  }

  return (
    <div className="home-panel">
      <div className="scope-toggle" role="group" aria-label="What are you designing?">
        <button
          className={`scope-btn ${store.scope === 'room' ? 'active' : ''}`}
          onClick={() => store.setScope('room')}
        >
          <span className="scope-title">Just one room</span>
          <span className="scope-sub">Design a single space in detail</span>
        </button>
        <button
          className={`scope-btn ${store.scope === 'home' ? 'active' : ''}`}
          onClick={() => store.setScope('home')}
        >
          <span className="scope-title">The whole place</span>
          <span className="scope-sub">Generate a full floorplan, then pick rooms</span>
        </button>
      </div>

      {store.scope === 'home' && (
        <>
          <p className="note">
            No public data source maps an address to a real floorplan — Zillow retired its API and
            the paid property databases return square footage and bed/bath counts, never room
            dimensions. So this generates a realistic plan from those three numbers instead, using
            published averages for how floor area is normally divided up. It's a plausible home of
            the right size and make-up, not a copy of your actual unit.
          </p>

          {/* The one way to get the user's real plan: they almost always have
              the image, even though no API has the data behind it. */}
          <div className="trace-cta">
            <div>
              <strong>Have the actual floorplan?</strong>
              <span>Trace over it and get your real layout instead of a generated one.</span>
            </div>
            <button className="btn-quiet bordered" onClick={() => setTracing(true)}>
              {store.planImage ? 'Trace it' : 'Upload & trace'}
            </button>
          </div>

          {tracing && (
            <FloorplanTracer onDone={() => setTracing(false)} onCancel={() => setTracing(false)} />
          )}

          <div className="preset-row">
            {PRESETS.map((p) => (
              <button key={p.label} className="chip tiny" onClick={() => applyPreset(p)}>
                {p.label}
              </button>
            ))}
          </div>

          <div className="home-fields">
            <label className="override">
              <span>Bedrooms</span>
              <input type="number" min="0" max="8" value={beds} onChange={(e) => setBeds(Number(e.target.value))} />
            </label>
            <label className="override">
              <span>Bathrooms</span>
              <input type="number" min="1" max="8" step="0.5" value={baths} onChange={(e) => setBaths(Number(e.target.value))} />
            </label>
            <label className="override">
              <span>Total sq ft</span>
              <input type="number" min="250" max="8000" step="50" value={sqft} onChange={(e) => setSqft(Number(e.target.value))} />
            </label>
            <label className="override">
              <span>Ceiling (ft)</span>
              <input type="number" min="7" max="16" step="0.5" value={ceilingFt} onChange={(e) => setCeilingFt(Number(e.target.value))} />
            </label>
          </div>

          <button className="btn-primary full" onClick={build}>
            {store.home ? 'Regenerate floorplan' : 'Generate floorplan'}
          </button>

          {store.home && (
            <div className="room-list">
              <h4>Rooms</h4>
              {store.home.rooms.map((r) => {
                const n = (r.items || []).reduce((s, i) => s + i.qty, 0)
                return (
                  <button
                    key={r.id}
                    className={`room-row ${store.focusedRoom === r.id ? 'active' : ''}`}
                    onClick={() => store.focusRoom(r.id)}
                  >
                    <span className="room-dot" style={{ background: ROOM_KIND_COLORS[r.kind] }} />
                    <span className="room-name">{r.name}</span>
                    <span className="room-meta mono">
                      {roomSqft(r)} sq ft{n > 0 ? ` · ${n}` : ''}
                    </span>
                  </button>
                )
              })}
              <button className="link-btn" onClick={() => store.exitRoom()}>
                See the whole plan
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

import { Component } from 'react'
import PillowMark from './PillowMark'
import './ErrorBoundary.css'

/**
 * Catches render/runtime errors anywhere below it so a failure shows an
 * explanation instead of a blank white page. The most likely cause in this app
 * is WebGL being unavailable — old hardware, a locked-down browser, or hardware
 * acceleration switched off — so that case gets its own message.
 */
export default class ErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('Nested crashed:', error, info)
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    const webglMissing = !supportsWebGL()

    return (
      <div className="crash">
        <div className="crash-card">
          <p className="crash-eyebrow">
            <PillowMark size={20} className="eyebrow-mark" />
            Nested
          </p>
          {webglMissing ? (
            <>
              <h1>This browser can't render 3D.</h1>
              <p>
                Nested needs WebGL to draw your room. It's usually switched off rather than
                missing — try turning on hardware acceleration in your browser settings, or open the
                site in Chrome, Edge, Safari, or Firefox.
              </p>
            </>
          ) : (
            <>
              <h1>Something broke.</h1>
              <p>
                An unexpected error stopped the page. Your design is saved in this browser, so
                reloading usually gets you back to where you were.
              </p>
              <pre className="crash-detail">{String(error?.message || error)}</pre>
            </>
          )}

          <div className="crash-actions">
            <button className="btn-primary" onClick={() => window.location.reload()}>
              Reload
            </button>
            <button
              className="btn-quiet"
              onClick={() => {
                localStorage.removeItem('room-maker-v1')
                window.location.reload()
              }}
            >
              Reset my design and reload
            </button>
          </div>
        </div>
      </div>
    )
  }
}

function supportsWebGL() {
  try {
    const canvas = document.createElement('canvas')
    return !!(canvas.getContext('webgl2') || canvas.getContext('webgl'))
  } catch {
    return false
  }
}

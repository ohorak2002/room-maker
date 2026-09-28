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
              <h1>3D graphics aren't available.</h1>
              <p>
                Nested needs GPU acceleration to draw your room. Updating the graphics driver
                usually fixes this; remote-desktop sessions often have it switched off.
              </p>
            </>
          ) : (
            <>
              <h1>Something broke.</h1>
              <p>
                An unexpected error stopped the editor. A recovery copy of your project is kept on
                this computer, and reloading offers to restore it.
              </p>
              <pre className="crash-detail">{String(error?.message || error)}</pre>
            </>
          )}

          <div className="crash-actions">
            <button className="btn-primary" onClick={() => window.location.reload()}>
              Reload
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

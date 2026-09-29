import { useEffect, useRef, useState } from 'react'
import { renderThumbnail } from '../three/thumbnail'
import { preloadMaterials } from '../three/photoMaterials'
import { PILOT_MATERIALS } from '../data/materialSources'

/**
 * A 3D preview of a catalog item. Renders lazily — only once the row scrolls
 * into view — so opening the Shop tab doesn't draw 47 objects up front.
 * Falls back to the item's color swatch if WebGL is unavailable.
 */
export default function ItemThumb({ item, size = 46, className = 'item-thumb' }) {
  const ref = useRef(null)
  const [url, setUrl] = useState(null)
  const [seen, setSeen] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el || seen) return
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setSeen(true)
          io.disconnect()
        }
      },
      { rootMargin: '150px' }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [seen])

  useEffect(() => {
    if (!seen) return
    // Pieces with photographic maps wait for them, or the preview would be
    // cached with the plain fallback colour.
    if (item.materialSet === 'pilot') {
      let live = true
      preloadMaterials(Object.values(PILOT_MATERIALS)).then(() => live && setUrl(renderThumbnail(item)))
      return () => { live = false }
    }
    // Yield a frame so a burst of newly visible rows doesn't block scrolling.
    const id = requestAnimationFrame(() => setUrl(renderThumbnail(item)))
    return () => cancelAnimationFrame(id)
  }, [seen, item])

  return (
    <span
      ref={ref}
      className={className}
      // size={null}: the stylesheet sizes it (the Shop cards).
      style={size ? { width: size, height: size, background: url ? undefined : item.color } : undefined}
    >
      {url && <img src={url} alt="" width={size || 256} height={size || 256} loading="lazy" />}
      {!url && !size && <span className="thumb-swatch" style={{ background: item.color }} />}
    </span>
  )
}

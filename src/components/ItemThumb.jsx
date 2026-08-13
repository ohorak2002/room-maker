import { useEffect, useRef, useState } from 'react'
import { renderThumbnail } from '../three/thumbnail'

/**
 * A 3D preview of a catalog item. Renders lazily — only once the row scrolls
 * into view — so opening the Shop tab doesn't draw 47 objects up front.
 * Falls back to the item's color swatch if WebGL is unavailable.
 */
export default function ItemThumb({ item, size = 46 }) {
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
    // Yield a frame so a burst of newly visible rows doesn't block scrolling.
    const id = requestAnimationFrame(() => setUrl(renderThumbnail(item)))
    return () => cancelAnimationFrame(id)
  }, [seen, item])

  return (
    <span
      ref={ref}
      className="item-thumb"
      style={{ width: size, height: size, background: url ? undefined : item.color }}
    >
      {url && <img src={url} alt="" width={size} height={size} loading="lazy" />}
    </span>
  )
}

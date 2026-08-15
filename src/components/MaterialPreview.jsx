import { useMemo } from 'react'
import { surfacePreview } from '../three/textures'
import { getWallMaterial } from '../data/presets'

/**
 * A swatch of the actual wall surface.
 *
 * Drawn by the same generator that textures the room, so the tile you pick in
 * the survey is the wall you get. Approximating these in CSS would look neater
 * and would start lying the moment either side was tuned — and brick in
 * particular is chosen on how it looks, so a swatch that flatters is worse
 * than no swatch.
 */
export default function MaterialPreview({ id }) {
  const mat = getWallMaterial(id)
  const src = useMemo(
    () => surfacePreview(mat.surface, { size: 104, tint: mat.tint || '#ddd6cb', repeat: 1 }),
    [mat.surface, mat.tint]
  )

  if (!src) return <div className="mat-swatch mat-swatch-empty" aria-hidden="true" />
  return <img className="mat-swatch" src={src} alt="" aria-hidden="true" draggable={false} />
}

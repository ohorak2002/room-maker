/**
 * The app's mark: a soft pillow. Used in the top bar, on the welcome screen,
 * and as the favicon, so the same shape identifies the product everywhere.
 *
 * Drawn rather than imported so it inherits currentColor and stays crisp at any
 * size — a raster logo would need three exports and still blur on a retina tab.
 */
export default function PillowMark({ size = 22, className = '' }) {
  return (
    <svg
      className={`pillow-mark ${className}`}
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden="true"
    >
      {/* puffed body, pinched at the corners */}
      <path
        d="M14 22 Q32 16 50 22 Q56 32 50 42 Q32 48 14 42 Q8 32 14 22 Z"
        fill="var(--pillow-fill, #F6F1E8)"
        stroke="var(--pillow-line, #C9BCA8)"
        strokeWidth="2.4"
        strokeLinejoin="round"
      />
      {/* seam */}
      <path
        d="M18 25 Q32 21 46 25"
        stroke="var(--pillow-line, #C9BCA8)"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.8"
      />
      {/* highlight, so it reads as soft rather than flat */}
      <path
        d="M21 29 Q26 25.5 31 27.5"
        stroke="#FFFFFF"
        strokeWidth="3"
        strokeLinecap="round"
        opacity="0.9"
      />
      {/* corner tufts */}
      <circle cx="14" cy="22" r="2.1" fill="var(--pillow-line, #C9BCA8)" />
      <circle cx="50" cy="22" r="2.1" fill="var(--pillow-line, #C9BCA8)" />
      <circle cx="14" cy="42" r="2.1" fill="var(--pillow-line, #C9BCA8)" />
      <circle cx="50" cy="42" r="2.1" fill="var(--pillow-line, #C9BCA8)" />
    </svg>
  )
}

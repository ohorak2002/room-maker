// Stroke icons for the interface. Decorative: every button that uses one also
// carries a visible label or an aria-label.
const PATHS = {
  home: <><path d="M3 11.5 12 4l9 7.5" /><path d="M5.5 10v9.5h13V10" /><path d="M9.5 19.5v-5h5v5" /></>,
  help: <><circle cx="12" cy="12" r="9" /><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .8-1 1.5v.4" /><path d="M12 17h.01" /></>,
  chevron: <path d="m6 9 6 6 6-6" />,
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  check: <path d="m5 12 5 5 9-10" />,
  undo: <><path d="M9 14 4 9l5-5" /><path d="M4 9h11a5 5 0 0 1 0 10h-3" /></>,
  arrange: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>,
  camera: <><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="12" cy="12" r="3.2" /></>,
  rotate: <><path d="M20 12a8 8 0 1 1-2.3-5.7" /><path d="M20 4v5h-5" /></>,
  copy: <><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" /></>,
  trash: <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />,
  panel: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M9 4v16" /></>,
  more: <><circle cx="5" cy="12" r="1.2" /><circle cx="12" cy="12" r="1.2" /><circle cx="19" cy="12" r="1.2" /></>,
  folder: <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />,
  back: <path d="m15 6-6 6 6 6" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  focus: <><circle cx="12" cy="12" r="3" /><path d="M4 9V5a1 1 0 0 1 1-1h4M15 4h4a1 1 0 0 1 1 1v4M20 15v4a1 1 0 0 1-1 1h-4M9 20H5a1 1 0 0 1-1-1v-4" /></>,
  present: <><path d="M4 9V5h4M20 9V5h-4M4 15v4h4M20 15v4h-4" /></>,
  room: <><path d="M12 3 4 7.5v9L12 21l8-4.5v-9z" /><path d="M4 7.5 12 12l8-4.5M12 12v9" /></>,
  pieces: <><path d="M5 12V9a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v3" /><path d="M3 12a2 2 0 0 1 2 2v2h14v-2a2 2 0 0 1 4 0v4H1v-4a2 2 0 0 1 2-2z" transform="translate(0 -1)" /><path d="M5 20v1.5M19 20v1.5" /></>,
  finishes: <><rect x="3" y="3" width="8" height="18" rx="2" /><path d="M11 8.5 16 6l3 5-8 4.5" /><path d="M8 17h.01" /></>,
  light: <><circle cx="12" cy="12" r="4" /><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8" /></>,
  views: <><circle cx="12" cy="12" r="9" /><path d="m14.3 6.3-3 5.4M17.6 14.3l-5.4-3M9.7 17.6l3-5.4M6.4 9.7l5.4 3" /></>,
  sunset: <><path d="M4 18h16M7 14a5 5 0 0 1 10 0M12 4v3M5 8l2 2M19 8l-2 2" /></>,
  moon: <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />,
  bookmark: <><path d="M6 4h12v17l-6-4-6 4z" /><path d="M12 8v5M9.5 10.5h5" /></>,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7.5h.01" /></>,
}

export default function Icon({ name, size = 16, strokeWidth = 1.8, className }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  )
}

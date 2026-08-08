export function LogoMark({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" aria-hidden="true">
      <defs>
        <linearGradient id="logo-grad" x1="0" y1="0" x2="512" y2="512" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ff375f" />
          <stop offset="55%" stopColor="#c026d3" />
          <stop offset="100%" stopColor="#7c3aed" />
        </linearGradient>
        <mask id="logo-heart">
          <path
            transform="scale(21.333)"
            d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 1 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"
            fill="#fff"
          />
          <rect x="196" y="205" width="30" height="120" rx="15" fill="#000" />
          <rect x="241" y="175" width="30" height="180" rx="15" fill="#000" />
          <rect x="286" y="205" width="30" height="120" rx="15" fill="#000" />
        </mask>
      </defs>
      <rect width="512" height="512" rx="112" ry="112" fill="url(#logo-grad)" />
      <rect width="512" height="512" fill="#ffffff" mask="url(#logo-heart)" />
    </svg>
  )
}

export function Logo({ size = 24 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-2">
      <LogoMark size={size} />
      <span className="text-lg font-semibold tracking-tight">PsalmTune</span>
    </span>
  )
}

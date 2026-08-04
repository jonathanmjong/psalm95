export function LogoMark({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" aria-hidden="true">
      <defs>
        <linearGradient id="logo-grad" x1="0" y1="0" x2="512" y2="512" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ff375f" />
          <stop offset="55%" stopColor="#c026d3" />
          <stop offset="100%" stopColor="#7c3aed" />
        </linearGradient>
      </defs>
      <rect width="512" height="512" rx="112" ry="112" fill="url(#logo-grad)" />
      <g fill="#ffffff">
        <rect x="88" y="166" width="48" height="180" rx="24" />
        <rect x="160" y="106" width="48" height="300" rx="24" />
        <rect x="232" y="56" width="48" height="400" rx="24" />
        <rect x="304" y="126" width="48" height="260" rx="24" />
        <rect x="376" y="86" width="48" height="340" rx="24" />
      </g>
    </svg>
  )
}

export function Logo({ size = 24 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-2">
      <LogoMark size={size} />
      <span className="text-lg font-semibold tracking-tight">psalm95</span>
    </span>
  )
}

/** The house glyph from the app icon, on the Night palette. */
export function BrandMark({ size = 36, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 192 192"
      aria-hidden="true"
      className={className}
      style={{ flex: '0 0 auto', display: 'block' }}
    >
      <defs>
        <linearGradient id="hh-brand" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ff6aa0" />
          <stop offset="1" stopColor="#f2508c" />
        </linearGradient>
      </defs>
      <rect width="192" height="192" rx="52" fill="url(#hh-brand)" />
      <path
        d="M42 75 96 34l54 41v72a12 12 0 0 1-12 12H54a12 12 0 0 1-12-12V75Z"
        fill="#0b0c0f"
      />
      <path d="M71 71h17v20h16V71h17v55h-17v-21H88v21H71V71Z" fill="#ffffff" />
      <circle cx="132" cy="132" r="11" fill="#3b6bff" />
    </svg>
  )
}

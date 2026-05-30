const B = { blue: '#2563EB', cyan: '#22D3EE', white: '#F8FAFC' }

export default function WardenBadge({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <path d="M22 8 H42 L56 22 V42 L42 56 H22 L8 42 V22 Z" fill={B.blue} />
      <path
        d="M20 42 V22 L32 34 L44 22 V42"
        stroke={B.white}
        strokeWidth="4.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        fill="none"
      />
      <circle cx="32" cy="47" r="2.8" fill={B.cyan} />
    </svg>
  )
}

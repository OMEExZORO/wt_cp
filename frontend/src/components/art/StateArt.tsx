import { ART } from './palette'
import { ScanSlices } from './ScanSliceArt'

interface StateArtProps {
  className?: string
  alt?: string
}

function a11y(alt: string | undefined) {
  return alt ? ({ role: 'img', 'aria-label': alt } as const) : ({ 'aria-hidden': true } as const)
}

export function NotFoundArt({ className, alt }: StateArtProps) {
  return (
    <svg className={className ?? 'art art--state'} viewBox="0 0 400 300" width={400} height={300} xmlns="http://www.w3.org/2000/svg" {...a11y(alt)}>
      <rect width="400" height="300" rx="24" fill={ART.tint} />
      <ScanSlices x={200} y={150} scale={0.52} />
      <circle cx="200" cy="150" r="46" fill={ART.navy} />
      <path d="M182 136 a18 18 0 1 1 28 15 c-8 5 -10 8 -10 16" fill="none" stroke={ART.white} strokeWidth="9" strokeLinecap="round" />
      <circle cx="200" cy="184" r="6" fill={ART.orange} />
    </svg>
  )
}

export function EmptyStateArt({ className, alt }: StateArtProps) {
  return (
    <svg className={className ?? 'art art--state'} viewBox="0 0 400 300" width={400} height={300} xmlns="http://www.w3.org/2000/svg" {...a11y(alt)}>
      <rect width="400" height="300" rx="24" fill={ART.tint} />
      <rect x="120" y="60" width="160" height="190" rx="14" fill={ART.white} stroke={ART.navy} strokeWidth="6" />
      <rect x="165" y="46" width="70" height="28" rx="10" fill={ART.orange} />
      {[110, 140, 170].map((y) => (
        <rect key={y} x="145" y={y} width={y === 170 ? 70 : 110} height="10" rx="5" fill={ART.tintDeep} />
      ))}
      <circle cx="250" cy="215" r="26" fill={ART.navy} />
      <path d="M239 215 h22 M250 204 v22" stroke={ART.white} strokeWidth="6" strokeLinecap="round" />
    </svg>
  )
}

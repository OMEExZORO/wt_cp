import { ART } from './palette'

interface SlicesProps {
  x?: number
  y?: number
  scale?: number
  opacity?: number
}

export function ScanSlices({ x = 0, y = 0, scale = 1, opacity = 1 }: SlicesProps) {
  const rings = [260, 215, 170, 125, 80, 40]
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`} opacity={opacity} fill="none">
      {rings.map((r, i) => (
        <ellipse key={r} cx="0" cy="0" rx={r} ry={r * 0.82} stroke={i % 3 === 0 ? ART.orange : ART.navySoft} strokeWidth={i % 3 === 0 ? 3 : 2} strokeDasharray={i % 2 ? '3 9' : undefined} />
      ))}
      <path d="M-260 0 H260 M0 -215 V215" stroke={ART.navySoft} strokeWidth="1.5" />
    </g>
  )
}

export function ScanSliceArt({ className, alt }: { className?: string; alt?: string }) {
  const a11y = alt ? ({ role: 'img', 'aria-label': alt } as const) : ({ 'aria-hidden': true } as const)
  return (
    <svg className={className ?? 'art art--slices'} viewBox="0 0 600 400" width={600} height={400} xmlns="http://www.w3.org/2000/svg" {...a11y}>
      <rect width="600" height="400" fill={ART.navyDeep} />
      <ScanSlices x={300} y={200} scale={0.7} />
      <ScanSlices x={300} y={200} scale={0.35} />
      <circle cx="350" cy="170" r="10" fill={ART.orange} />
    </svg>
  )
}

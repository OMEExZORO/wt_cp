import { ART } from './palette'
import { Glyph, type ArtKind } from './glyphs'
import { ScanSlices } from './ScanSliceArt'

export type HeroKind = Extract<ArtKind, 'welcome' | 'usg' | 'ct' | 'biopsy'>

interface HeroArtProps {
  kind: HeroKind
  className?: string
}

export function HeroArt({ kind, className }: HeroArtProps) {
  return (
    <svg
      className={className ?? 'art art--hero'}
      viewBox="0 0 1600 900"
      width={1600}
      height={900}
      preserveAspectRatio="xMaxYMid slice"
      aria-hidden="true"
      focusable="false"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id={`hero-bg-${kind}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={ART.navyDeep} />
          <stop offset="1" stopColor={ART.navy} />
        </linearGradient>
      </defs>
      <rect width="1600" height="900" fill={`url(#hero-bg-${kind})`} />
      <ScanSlices x={1180} y={450} scale={1.9} opacity={0.35} />
      <g transform="translate(780 90) scale(1.25)">
        <Glyph kind={kind} />
      </g>
    </svg>
  )
}

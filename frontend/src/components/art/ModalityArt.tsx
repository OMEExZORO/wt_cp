import { ART } from './palette'
import { ART_LABEL, Glyph, type ArtKind } from './glyphs'

export interface ArtProps {
  kind: ArtKind
  alt?: string
  className?: string
}

export function ModalityArt({ kind, alt, className }: ArtProps) {
  return (
    <svg
      className={className ?? 'art art--modality'}
      viewBox="0 0 800 600"
      width={800}
      height={600}
      role="img"
      aria-label={alt ?? ART_LABEL[kind]}
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="800" height="600" fill={ART.white} />
      <rect width="800" height="600" fill={ART.tint} opacity="0.45" />
      <Glyph kind={kind} />
    </svg>
  )
}
